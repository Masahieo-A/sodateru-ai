import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import {
  GrammarUnit,
  MCQuestion,
  LessonMessage,
  PracticeTurn,
  TeachingHint,
  LearningSummary,
  TestResult,
  TestAnswer,
  TopicCoverage,
  TopicEvaluation,
} from "@/types";
import { getEnv } from "@/lib/db";
import { unresolvedUnknown } from "@/lib/learning/unknown";

// 教室内の応答速度と費用を重視して Flash-Lite を使う。
const MODEL = "gemini-3.5-flash-lite";

// ============================================================
// 同時実行制御（簡易セマフォ）
// 教室で30人が同時に使っても、このサーバインスタンスからの
// Gemini呼び出しを同時数本に抑えて 429（RPM制限）を踏みにくくする。
// ============================================================
const MAX_CONCURRENT_CALLS = 4;
const MAX_QUEUED_CALLS = 8;
const QUEUE_TIMEOUT_MS = 5_000;
let activeCalls = 0;
const callWaiters: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (activeCalls < MAX_CONCURRENT_CALLS) {
    activeCalls++;
    return Promise.resolve();
  }
  if (callWaiters.length >= MAX_QUEUED_CALLS) {
    return Promise.reject(new Error("Gemini call queue is full"));
  }
  return new Promise((resolve, reject) => {
    const waiter = () => {
      clearTimeout(timeout);
      activeCalls++;
      resolve();
    };
    const timeout = setTimeout(() => {
      const index = callWaiters.indexOf(waiter);
      if (index >= 0) callWaiters.splice(index, 1);
      reject(new Error("Gemini call queue timed out"));
    }, QUEUE_TIMEOUT_MS);
    callWaiters.push(waiter);
  });
}

function releaseSlot(): void {
  activeCalls--;
  callWaiters.shift()?.();
}

// ============================================================
// callGeminiWithRetry：全Gemini呼び出しの共通ラッパー
// - リトライは最大1回（合計2試行）。一時エラー時の回復性は残しつつ、
//   誤作動時の重複課金を上限付きにする。
// - 対象: 429 / 5xx / タイムアウト / ネットワーク / JSONパース失敗
// - responseSchema で構造化出力を強制し、パース失敗自体を減らす
// ============================================================
const RETRY_DELAYS_MS = [750];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GeminiCallOptions = {
  maxOutputTokens: number;
  /** 判定・採点系は 0、対話系は 0.3 */
  temperature?: number;
  responseSchema?: ResponseSchema;
  timeoutMs?: number;
};

async function callGeminiWithRetry<T>(
  prompt: string,
  opts: GeminiCallOptions
): Promise<T> {
  const apiKey = getEnv().GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opts.responseSchema,
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxOutputTokens,
    },
  });

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      const base = RETRY_DELAYS_MS[attempt - 1];
      await sleep(base + Math.random() * base * 0.5);
    }
    await acquireSlot();
    try {
      const result = await model.generateContent(prompt, {
        timeout: opts.timeoutMs ?? 25_000,
      });
      const text = result.response.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`Gemini response parse failed: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      lastError = err;
      // 4xx はリトライしても回復しない（429 のみリトライ対象）
      const status = (err as { status?: number }).status;
      if (status && status !== 429 && status < 500) throw err;
      console.warn(
        `[gemini] attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1} failed:`,
        err instanceof Error ? err.message : err
      );
    } finally {
      releaseSlot();
    }
  }
  throw lastError;
}

type DialogueFormatOptions = {
  /** 練習応答など、直近の文脈だけで足りる呼び出し用。 */
  maxMessages?: number;
  maxChars?: number;
};

/** dialogue をプロンプト用テキストに整形し、完全重複を除く。 */
function formatDialogue(
  dialogue: LessonMessage[],
  options: DialogueFormatOptions = {}
): string {
  if (dialogue.length === 0) return "（まだ何も教わっていない）";

  const unique = dialogue.filter(
    (message, index) =>
      index === 0 ||
      message.role !== dialogue[index - 1].role ||
      message.content !== dialogue[index - 1].content
  );
  const maxMessages = options.maxMessages ?? unique.length;
  const selected = unique.slice(-maxMessages);
  const lines: string[] = [];
  let usedChars = 0;
  const maxChars = options.maxChars ?? Number.POSITIVE_INFINITY;

  // 最新のやりとりを優先し、メッセージの途中で切らない。
  for (let index = selected.length - 1; index >= 0; index--) {
    const message = selected[index];
    const line = `${message.role === "teacher" ? "先生" : "生徒AI"}: ${message.content}`;
    if (lines.length > 0 && usedChars + line.length > maxChars) break;
    lines.unshift(line);
    usedChars += line.length;
  }

  return lines.join("\n");
}

/** 4択を文字列に整形 */
function formatChoices(q: MCQuestion): string {
  return q.choices.map((c) => `${c.label}. ${c.text}`).join("\n");
}

/** 問題の「もっともらしい誤答」ラベル（未習時・わざと間違える時に選ぶ） */
function untaughtAnswerLabel(question: MCQuestion): string {
  const wrong = question.choices.find(
    (c) => c.label.toUpperCase() !== question.answerLabel.toUpperCase()
  );
  return question.commonMistake?.label ?? wrong?.label ?? question.answerLabel;
}

function choiceText(question: MCQuestion, label: string): string {
  return question.choices.find((c) => c.label === label)?.text ?? "";
}

// ============================================================
// カバレッジ判定：説明が各トピックを含むかの含意判定
// ============================================================

/** 引用照合用の正規化（空白・句読点・記号を除去して小文字化） */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s、。，．,.!?！？…・:：;；\-ー「」『』（）()"'’‘”“]/g, "");
}

/**
 * 判定AIが出した根拠引用が、実際に先生の説明の中に存在するかをサーバ側で検証する。
 * 完全一致（正規化後）を基本とし、長い引用は前半/後半どちらかの一致でも許容する
 * （判定AIの軽微な引用ズレで生徒を不当に減点しないための緩和）。
 */
function verifyEvidence(evidence: string, knowledgeText: string): boolean {
  const ev = normalizeForMatch(evidence);
  const knowledge = normalizeForMatch(knowledgeText);
  if (!ev) return false;
  if (knowledge.includes(ev)) return true;
  if (ev.length >= 16) {
    const half = Math.floor(ev.length / 2);
    return (
      knowledge.includes(ev.slice(0, half)) ||
      knowledge.includes(ev.slice(half))
    );
  }
  return false;
}

export type TopicEvaluationStatus = TopicEvaluation["status"];

const coverageSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    coverage: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          topic_index: { type: SchemaType.NUMBER },
          status: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["sufficient", "partial", "absent_or_wrong"],
          },
          evidence: { type: SchemaType.STRING },
          gap: { type: SchemaType.STRING },
        },
        required: ["topic_index", "status", "evidence", "gap"],
      },
    },
    reply_answered: { type: SchemaType.BOOLEAN },
    reply_reason: { type: SchemaType.STRING },
  },
  required: ["coverage", "reply_answered", "reply_reason"],
};

type ReplyQuestionContext = { question: string; reply: string } | null;
type TopicEvaluationResult = {
  evaluations: TopicEvaluation[];
  replyAnswered: boolean;
  replyReason?: string;
};

function latestQuestionContext(dialogue: LessonMessage[]): ReplyQuestionContext {
  const teacherIndex = dialogue.map((message) => message.role).lastIndexOf("teacher");
  if (teacherIndex < 0) return null;
  const questionIndex = dialogue
    .slice(0, teacherIndex)
    .map((message) => message.role)
    .lastIndexOf("student");
  if (questionIndex < 0) return null;
  const question = dialogue[questionIndex].content.trim();
  const reply = dialogue[teacherIndex].content.trim();
  const looksLikeQuestion = /[?？]|なぜ|どうして|どのよう|どういう|何を|何が|どんな|どれ|ですか|ますか|でしょうか|教えて/.test(question);
  return looksLikeQuestion && reply ? { question, reply } : null;
}

function isBareAcknowledgment(text: string): boolean {
  const normalized = text.trim().replace(/[。.!！?？、\s]/g, "");
  return normalized.length <= 16 && /^(はい|いいえ|そうです|そうですね|分かりました|わかりました|なるほど|了解です|特にありません|特にない|特に無い|ありません|ないです|無いです|よくわかりません|わかりません)$/i.test(normalized);
}

function enforceOpenEndedQuestion(
  message: string,
  question: MCQuestion,
  topic?: string
): string {
  const boundaries = ["。", "！", "!", "\n"]
    .map((mark) => message.lastIndexOf(mark))
    .filter((index) => index >= 0);
  const clauseStart = boundaries.length ? Math.max(...boundaries) + 1 : 0;
  const lastClause = message.slice(clauseStart).trim();
  const closedEnding = /(?:(?:合っています|合ってます|合ってる|正しい|いい|大丈夫|同じ考え方でいい)(?:です)?(?:か|よね)|(?:ですか|ますか|でしょうか|ですよね|だよね|かな))[。！？?！]*$/;
  const openCue = /なぜ|どうして|どう(?:やって|判断|考え)|どのよう|どういう|どんな|何を|何が|理由|説明|根拠|比べて/.test(lastClause);
  if (!closedEnding.test(lastClause) || openCue) return message;

  const focus = topic ? `「${topic}」のルールも使って、` : "";
  const replacement = `なぜ「${question.sentence}」ではその選択肢を選ぶのか、${focus}判断の手がかりと理由を説明してください。`;
  return `${message.slice(0, clauseStart).trimEnd()}${clauseStart > 0 ? "\n" : ""}${replacement}`;
}

/**
 * カバレッジ判定器。
 * 生徒役AIの「教わっていないふり」という演技に頼らず、
 * 「先生の説明が各学習トピックを解けるレベルで含むか」を独立に判定する。
 * - ロールプレイなしの含意判定（temperature 0）なので、潜在知識の混入が構造的に起きにくい
 * - sufficient / partial の根拠引用はサーバ側で説明文と照合し、検証できなければ absent_or_wrong に倒す
 *   （ハルシネーションした根拠で「教わったことにする」のを防ぐ）
 * - topicIndices を渡すと、そのトピックだけを判定する（練習問題の1問単位で使う）
 */
export async function evaluateTopics(
  unit: GrammarUnit,
  knowledgeText: string,
  topicIndices?: number[],
  dialogue: LessonMessage[] = [],
  replyDialogue: LessonMessage[] = dialogue
): Promise<TopicEvaluationResult> {
  const allTopics = unit.teachingGuide.coverageTopics;
  const targets = (topicIndices ?? allTopics.map((_, i) => i)).filter(
    (i) => i >= 0 && i < allTopics.length
  );

  // 何も教わっていなければ、LLMを呼ぶまでもなく全トピック未カバーで確定
  const hasKnowledge =
    knowledgeText.trim().length > 0 &&
    knowledgeText.trim() !== "（まだ何も教わっていない）";
  const replyContext = latestQuestionContext(replyDialogue);
  if ((!hasKnowledge || targets.length === 0) && !replyContext) {
    return {
      evaluations: targets.map((i) => ({
        topicIndex: i,
        topic: allTopics[i],
        status: "absent_or_wrong",
      })),
      replyAnswered: true,
    };
  }

  const prompt = `
あなたは学習アプリの「カバレッジ判定器」です。ロールプレイはせず、機械的に判定します。
以下は、先生（ユーザー）が生徒AIに行った「${unit.name}」の説明（対話記録）です。
各学習トピックについて、説明の到達度を次の3段階で判定してください。

【判定基準】
- sufficient: 判断基準と必要な使い方が、問題を解ける程度に正しく説明されている。
- partial: 関連する説明はあるが、判断基準・条件・使い分けのいずれかが不足、曖昧、または例だけで一般化できない。
- absent_or_wrong: 説明がない、または誤っている。
- 用語の一致は不要。内容で判定する。単語が登場するだけでは sufficient にしない。
- evidence は説明からの一字一句そのままの引用。sufficient/partial の場合は必須。absent_or_wrong は空文字列。
- gap は不足点を短く記す。sufficient は空文字列。

【直前の質問への返答判定】
直前のAI質問と先生の最新返答を照合し、質問が求めた内容に実質的に答えていれば reply_answered=true、脱線・無関係・質問と無関係な相づちなら false にしてください。
短い「はい」「分かりました」など、説明を求めた質問に理由や説明を返していない場合は false です。意見の断定だけで理由を求められた質問に応えていない場合も false です。
質問文がない場合は reply_answered=true とします。
reply_reason は判定根拠を短く記してください。
${replyContext ? `AIの直前の質問：${replyContext.question}\n先生の最新返答：${replyContext.reply}` : "直前に回答すべき質問はありません。"}

【先生の説明（対話記録）】
${knowledgeText}

【学習トピック】
${targets.map((i) => `${i}: ${allTopics[i]}／教材上の到達目標: ${unit.teachingGuide.thinkingPrompts[i] ?? "（記載なし）"}`).join("\n")}
教材上の到達目標を基準にし、先生の誤った因果関係を補って正しい説明に作り替えないでください。
${targets.some((i) => unit.teachingGuide.knowledgeTopicIds?.[i] === "infinitive.noun.comp") ? "名詞的用法の補語では、be動詞の後ろの不定詞が主語の内容を説明します。単に『主語と動作対象の関係』と言うだけでは、この判断基準を教えたことになりません。" : ""}

以下のJSON形式【のみ】で回答してください：
{
  "coverage": [
  { "topic_index": 0, "status": "partial", "evidence": "（説明からの引用）", "gap": "判断基準が不足" }
  ],
  "reply_answered": true,
  "reply_reason": "質問に説明で答えている"
}
※ coverage には上記の全トピック（インデックス: ${targets.join(", ")}）を必ず含めること。
`;

  const raw = await callGeminiWithRetry<{
    coverage: { topic_index: number; status: TopicEvaluationStatus; evidence?: string; gap?: string }[];
    reply_answered: boolean;
    reply_reason?: string;
  }>(prompt, {
    maxOutputTokens: 700,
    temperature: 0, // 判定はぶれさせない
    responseSchema: coverageSchema,
  });

  // 対象トピック分の配列に整形（判定漏れは未カバー扱い）
  const evaluations = targets.map((i) => {
    const judged = raw.coverage?.find((c) => c.topic_index === i);
    const evidence = judged?.evidence?.trim() || undefined;
    const evidenceVerified = evidence
      ? verifyEvidence(evidence, knowledgeText)
      : false;
    // 根拠引用が説明中に見つからない covered は false に倒す（安全側）
    let status: TopicEvaluationStatus =
      judged?.status === "sufficient" && evidenceVerified
        ? "sufficient"
        : judged?.status === "partial" && evidenceVerified
          ? "partial"
          : "absent_or_wrong";
    const unknownStillUnresolved = unresolvedUnknown(dialogue, i, evidence);
    if (unknownStillUnresolved) status = "absent_or_wrong";
    if (status === "sufficient" && unit.teachingGuide.knowledgeTopicIds?.[i] === "infinitive.noun.comp" &&
      evidence && /主語と動作対象/.test(evidence)) {
      status = "absent_or_wrong";
    }
    return {
      topicIndex: i,
      topic: allTopics[i],
      status,
      evidence: status !== "absent_or_wrong" ? evidence : undefined,
      gap: status === "partial" ? judged?.gap?.trim() || "説明に不足があります" :
        unknownStillUnresolved ? "分からないと記録されています" : undefined,
    };
  });
  const replyAnswered = !replyContext || (
    !!raw.reply_answered && !isBareAcknowledgment(replyContext.reply)
  );
  return {
    evaluations,
    replyAnswered,
    replyReason: raw.reply_reason,
  };
}

/** Compatibility view for consumers that only need a binary coverage result. */
export async function coverageJudge(
  unit: GrammarUnit,
  knowledgeText: string,
  topicIndices?: number[],
  dialogue: LessonMessage[] = []
): Promise<TopicCoverage[]> {
  return (await evaluateTopics(unit, knowledgeText, topicIndices, dialogue, [])).evaluations.map((item) => ({
    topicIndex: item.topicIndex,
    topic: item.topic,
    covered: item.status === "sufficient",
    status: item.status,
    evidence: item.status === "sufficient" ? item.evidence : undefined,
    evidenceVerified: item.status === "sufficient" ? true : undefined,
    gap: item.gap,
  }));
}

// ============================================================
// ① 練習問題：生徒役AIの1ターン
//
// 設計原則：「何を答えるか」はサーバが決め、LLMには思考文の生成だけをさせる。
// - required_topics が未カバー → もっともらしい誤答をサーバ側で確定
// - 全カバー → 正解をサーバ側で確定（＋evidence を引用した思考文）
// これにより「未習 → 必ず誤答 → 生徒が教える → 正解に変わる」が確実に成立する。
// ============================================================

const practiceTurnSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    message: { type: SchemaType.STRING },
    chosenLabel: { type: SchemaType.STRING },
    satisfied: { type: SchemaType.BOOLEAN },
  },
  required: ["message", "satisfied"],
};

export async function practiceChat(
  unit: GrammarUnit,
  question: MCQuestion,
  dialogue: LessonMessage[],
  questionDialogue: LessonMessage[],
  isFollowup: boolean,
  exchangeCount: number,
  forceStumble = false,
  isColdOpen = false
): Promise<PracticeTurn> {
  // forceStumble: 全問正解しそうな場合に、メタ認知のきっかけとして
  // “もっともらしい誤解”で1問だけあえて間違える（初回ターンのみ）
  const stumbleActive = forceStumble && !isFollowup;
  // coldOpen: レッスン冒頭、まだ何も教わっていない状態で腕試しに挑戦する。
  // 前提知識だけでは決め手がなく、必ず失敗（誤答）して具体的な質問を発する。
  // 生徒の最初の入力を「作文」ではなく「質問への返答」にするための仕掛け。
  const coldOpenActive = isColdOpen && !isFollowup;

  const mistakeLabel = untaughtAnswerLabel(question);
  const mistakeText = choiceText(question, mistakeLabel);

  // === カバレッジ判定：この問題に必要なトピックを教わったか（サーバ側で確定） ===
  const required = question.requiredTopics ?? [];
  let missingTopics: string[] = [];
  let partialTopics: TopicEvaluation[] = [];
  let topicEvaluations: TopicEvaluation[] = [];
  let replyAnswered = true;
  let replyReason: string | undefined;
  let evidence: string | undefined;
  if (!coldOpenActive && !stumbleActive && required.length > 0) {
    const teacherText = dialogue
      .filter((m) => m.role === "teacher")
      .map((m) => m.content)
      .join("\n");
    const evaluation = await evaluateTopics(unit, teacherText, required, dialogue, questionDialogue);
    topicEvaluations = evaluation.evaluations;
    replyAnswered = evaluation.replyAnswered;
    replyReason = evaluation.replyReason;
    missingTopics = topicEvaluations
      .filter((t) => t.status === "absent_or_wrong")
      .map((t) => t.topic);
    partialTopics = topicEvaluations.filter((t) => t.status === "partial");
    evidence = topicEvaluations.find((t) => t.status === "sufficient" && t.evidence)?.evidence;
  }
  const covered = required.length > 0 && missingTopics.length === 0 && partialTopics.length === 0;

  // A bare denial after the AI asked a conceptual question is a claim, not an explanation.
  // Reflect what was said, then ask for the reason or a counterexample instead of accepting it.
  const lastTeacher = [...questionDialogue].reverse().find((m) => m.role === "teacher")?.content ?? "";
  const lastStudent = [...questionDialogue].slice(0, -1).reverse().find((m) => m.role === "student")?.content ?? "";
  const unsupportedNoDifference = isFollowup && /特に(?:は)?(?:違い|差|ニュアンス)?(?:ない|ありません|無い)|(?:違い|差|ニュアンス)は(?:ない|ありません|無い)/.test(lastTeacher)
    && /なぜ|どうして|違い|ニュアンス|区別|使い分け/.test(lastStudent);
  const memorizationIntent = isFollowup && /暗記|丸暗記|覚えるしか|覚えるべき/.test(lastTeacher);

  // === 解答ラベルの確定（LLMに委ねない） ===
  // - coldOpen / stumble / 未カバー → もっともらしい誤答
  // - 全カバー → 正解
  // - requiredTopics 未設定の問題のみ、LLM自身の選択に任せる
  let decidedLabel: string | undefined;
  if (coldOpenActive || stumbleActive) {
    decidedLabel = mistakeLabel;
  } else if (required.length > 0) {
    decidedLabel = covered ? question.answerLabel : mistakeLabel;
  }

  const evidenceSnippet = evidence
    ? evidence.length > 60
      ? `${evidence.slice(0, 60)}…`
      : evidence
    : undefined;

  let phase: string;
  if (memorizationIntent) {
    phase = `【暗記という学び方を受け入れます】
先生は「${lastTeacher}」と教えました。暗記が役に立つことを認め、理屈の説明を強要しないでください。
今回の範囲で、同じパターンとして覚えるべき表現がほかにもあれば一覧で教えてほしい、と自由回答で尋ねてください。
ただし暗記する対象がまだ示されていなければ理解済みにはしません。satisfied は false。`;
  } else if (unsupportedNoDifference) {
    phase = `【先生の返答は断定だけで、理由や根拠がまだありません】
先生は「${lastTeacher}」と答えました。まず、その返答を聞いたことは明示しますが、根拠がないまま「分かりました」「違いはありません」と同意してはいけません。
- 「違いがないということですね。ただ、なぜそう言えるのかがまだ分かりません」のように、先生の主張と未解決点を区別して伝えてください。
- 判断の理由、または意味が変わる具体例を先生に説明してもらう【自由回答の質問】を1つしてください。はい／いいえで答えられる質問は禁止です。
- chosenLabel は現在の判断を保ち、satisfied は false。`;
  } else if (!replyAnswered) {
    phase = `【先生の返答は、直前にした質問にまだ答えていません】
先生の最新の返答：「${lastTeacher}」
判定理由：${replyReason ?? "質問で求めた説明・理由との対応が見つかりません"}
- 返答を聞いたことを具体的に認めたうえで、質問のどの部分に答えていないかをやわらかく示してください。
- 何を知りたいのかを言い直し、理由や具体例を説明してもらう自由回答の問いを1つしてください。短い相づちだけで理解したことにしてはいけません。
- satisfied は false。`;
  } else if (coldOpenActive) {
    phase = `【今回は「腕試し」です。まだ先生から何も教わっていません】
あなたはこれから学ぶ「${unit.name}」の問題に、前提知識だけでいったん挑戦してみます。
- あなたが選ぶのは「${mistakeLabel}（${mistakeText}）」です。前提知識から考えると何となくそれらしく見えますが、実は決め手がなく、自信がありません。
- まず、前提知識でここまでは考えられた、ということを一言で述べてください（例：「◯◯までは分かるんですが…」）。
- そのうえで「何を基準に選べばいいのか分からない」と正直に伝えてください。
- 最後に、先生が教え始めるきっかけになる【具体的な質問】を1つだけしてください（「どういうときに◯◯を使うんですか？」のように、判断基準を尋ねる質問が望ましい）。
- 🚫 正解を確信を持って言い当ててはいけません。教わっていないことを、教わったかのように語ってはいけません。「推測で選びました」という言い方もしないこと。
- satisfied は false。`;
  } else if (stumbleActive) {
    phase = `【今回は「新しい問題」ですが、あなたは“もっともらしい誤解”をしてしまいます】
あなたはこれまでの問題は理解できていますが、この問題だけは、先生の説明を完全には咀嚼しきれず、解釈のズレ・思い込みから【誤った選択肢】を選んでしまいます。
- あなたが選ぶのは「${mistakeLabel}（${mistakeText}）」です。これは実は誤答ですが、あなたは（もっともらしく）それが正しいと思い込んでいます。
${
  question.commonMistake
    ? `- あなたの思い込み（誤解）の中身：「${question.commonMistake.misconception}」。これを自分の言葉で、自然な生徒の口調で語ってください。`
    : `- 「教わったルールをこの問題にも当てはめたら ${mistakeLabel} になるはず」といった、もっともらしい過剰一般化・取り違えを自分の言葉で表現してください。`
}
- 🚫 教わった内容そのものを否定したり、別人のように雑に振る舞ってはいけません。あくまで「自分なりに考えたら、こう解釈してしまった」という素直な誤解として表現します。
- 最後に「これで合っているか、ちょっと自信がないです」と先生に確認を促してください。
- satisfied は false。`;
  } else if (isFollowup && required.length > 0 && partialTopics.length > 0) {
    phase = `【先生の説明には関係する内容がありますが、判断基準がまだ一部不足しています】
次のトピックは説明が部分的です：${partialTopics.map((t) => `「${t.topic}」(${t.gap})`).join("、")}。
${missingTopics.length ? `次のトピックは説明がないか、誤っています：「${missingTopics.join("」「")}」。` : ""}
- 先生が説明した部分を具体的に認めつつ、不足点が残っていることを短く伝えてください。
- 不足点を補うため、理由や使い分けを説明してもらう【自由回答の質問】を1つしてください。はい／いいえで答えられる閉じた質問は禁止です。
- satisfied は false。`;
  } else if (isFollowup && required.length > 0 && covered) {
    phase = `【今回は「追加説明への応答」です。先生の説明で、判断基準が理解できました】
先生の説明のおかげで、この問題の正しい答えは「${question.answerLabel}（${choiceText(
      question,
      question.answerLabel
    )}）」だと分かりました。
- 先生の説明のどの言葉が決め手になったかに触れながら${
      evidenceSnippet ? `（例：「${evidenceSnippet}」という説明）` : ""
    }、自分の言葉で一言だけ言い換えて「分かりました！」と理解・成長を示してください。もし前の自分の答えが間違っていたら、素直に選び直します。
- 🚫 すでに先生が答えてくれた質問を、言い回しを変えてもう一度きいてはいけません。
- satisfied は true にして、気持ちよく次へ進んでください。`;
  } else if (isFollowup && required.length > 0 && !covered) {
    phase = `【今回は「追加説明への応答」ですが、まだ判断の決め手が分かっていません】
先生が答えてくれたことにはまず感謝しつつ、あなたにはまだ「${missingTopics.join(
      "」「"
    )}」について、問題を解ける判断基準が伝わっていません。
- あなたの答えは「${mistakeLabel}」のままで、まだ自信がありません。
- 教わった部分を具体的に認め、まだ不足している判断基準を明示してください。単に「分かりました」と返してはいけません。
- まだ引っかかっている点について、理由や条件を説明してもらう【前回とは違う自由回答の質問】を1つだけしてください。はい／いいえで答えられる閉じた質問は禁止です。
- 🚫 同じ質問の繰り返しは禁止。🚫「推測で選びました」という言い方もしないこと。
- ただし、これまで ${exchangeCount} 回やりとりしています。2回以上なら質問は控えめにし、「いったんこれで考えてみます」と前向きに締めてください。
- satisfied は false。`;
  } else if (isFollowup) {
    phase = `【今回は「追加説明への応答」です】
先生があなたの質問・つぶやきに答えてくれました。あなたは“学んで成長する生徒”です。次の方針で応答してください：
1. 教わった内容を自分の言葉で一言だけ言い換えて「分かりました！」と理解・成長を示す。もし前の自分の答えが間違っていたと気づいたら、正しい選択肢に選び直してください。
2. 🚫【最重要】すでに先生が答えてくれた質問を、言い回しを変えてもう一度きいてはいけません。同じ論点を蒸し返さないこと。
3. 疑問が解消したら、たとえ完璧な理解でなくても satisfied を true にして次へ進みます（粘りすぎない・追い詰めない）。
4. 例外として、説明がどうしても理解できない／前と全く別の新しい疑問が出た場合のみ satisfied を false にし、【前回と違う】新しい質問を1つだけします。
5. ただし、これまで ${exchangeCount} 回やりとりしています。2回以上なら、必ず satisfied を true にして気持ちよく次に進んでください。`;
  } else if (required.length > 0 && covered) {
    // 教わった知識で解ける問題：正解＋一歩踏み込んだ確認質問（教える契機を作る）
    phase = `【今回は「新しい問題」です。教わった内容で解けます】
先生の説明を根拠に、あなたは「${question.answerLabel}（${choiceText(
      question,
      question.answerLabel
    )}）」を選びます。
- 先生の説明のどの部分が根拠になったかに触れながら${
      evidenceSnippet ? `（例：「${evidenceSnippet}」と教わった部分）` : ""
    }、選んだ理由を一言で述べてください。「自分の言葉がAIに伝わった」ことが先生に分かるように。
- そのうえで、🚫「合っていますよね？」のような確認だけで終わらず、判断理由を説明させる【自由回答の質問】を1つしてください（例：「なぜこの場合はこの形になるのですか？」）。はい／いいえで答えられる質問は禁止です。
- satisfied は false（先生の返事を待ちます）。`;
  } else if (required.length > 0 && !covered && missingTopics.length === 0 && partialTopics.length > 0) {
    phase = `【説明はありますが、まだ一部が不足しています】
次のトピックの説明が部分的です：${partialTopics.map((t) => `「${t.topic}」(${t.gap})`).join("、")}。
- 不足点を短く具体的に伝え、判断基準や条件を説明してもらう【自由回答の質問】を1つしてください。はい／いいえで答えられる質問は禁止です。
- この不足が解消するまでは誤答「${mistakeLabel}」を保ち、satisfied は false。`;
  } else if (required.length > 0 && !covered) {
    // まだ教わっていない問題：必ず誤答し、先生が教えるきっかけの質問をする
    phase = `【今回は「新しい問題」ですが、解くのに必要なことをまだ教わっていません】
この問題を解くには「${missingTopics.join(
      "」「"
    )}」の知識が必要ですが、あなたはまだ十分に教わっていません。
${partialTopics.length ? `また、次の説明は一部不足しています：「${partialTopics.map((t) => `${t.topic}：${t.gap}`).join("」「")}」。` : ""}
- あなたが選ぶのは「${mistakeLabel}（${mistakeText}）」です。決め手がなく、なんとなくそれらしく見えるだけで、自信はありません。
- 「${missingTopics[0]}については、まだ教わっていないので自信がないです…」と正直に伝えてください。
- 最後に、先生が教え始めるきっかけになる【具体的な質問】を1つだけしてください（判断基準を尋ねる質問が望ましい）。
- 🚫 正解を確信を持って言い当ててはいけません。🚫「推測で選びました」という言い方もしないこと。
- satisfied は false。`;
  } else {
    phase = `【今回は「新しい問題」です】
教わった内容で考え、選択肢を1つ選び、理由を一言で述べてください。
そのうえで、🚫「合っていますよね？」のような定型の確認だけで終わらず、理由・条件・他の選択肢との違いを説明させる【自由回答の質問】を1つしてください（例：「なぜこの場合はその形を選ぶのですか？」）。はい／いいえだけで答えられる質問は禁止です。
- satisfied は false（先生の返事を待ちます）。`;
  }

  const assumed = unit.teachingGuide.assumedKnowledge;
  const coverage = unit.teachingGuide.coverageTopics;

  const prompt = `
あなたは英語を学んでいる、素直で前向きな生徒AIです。「確信度モデル」に従って振る舞ってください。
知識を「知らないふり」で隠すのではなく、教わった内容には確信を持ち、教わっていない内容には正直に不確かさを表現します。

【あなたが最初から知っていること（前提知識）】
${assumed.length ? assumed.map((k) => `- ${k}`).join("\n") : "- （特になし）"}
→ これらは説明されなくても当然のものとして使ってかまいません。

【今回「${unit.name}」で学ぶ対象（最初はまだ教わっていない）】
${coverage.map((t) => `- ${t}`).join("\n")}
→ これらは先生に教えてもらって【はじめて】理解します。教わる前は「まだ習っていないので自信がない」として扱ってください。

【その他の文法知識】
→ 「なんとなく聞いたことはあるが、よくわからない」として、確信なく扱ってください。
  二択に迫られて確信がないときは、当てずっぽうを正解のように語らず「〜だと思うのですが、合っていますか？」と正直に不確かさを示します。

【共通ルール】
- 先生の言葉は尊重するが、誤った説明を正しい文法に言い換えて理解済みにしない。根拠のない飛躍（例：「主語と動作対象」だから主語＝補語）はしない。
- 先生が「分からない」とした内容は、理解していない状態のまま先に進める。責めたり、説明を強要したりしない。
- 既に十分と判定された内容は繰り返し尋ねない。不足・誤りのある部分だけを尋ねる。
- 先生の発言が「特に違いはない」のような根拠のない断定だけなら、発言内容を正確に受け止めたうえで、根拠や具体例を尋ねる。断定を事実として承認したり「分かりました」と流したりしない。
- 先生の返答が自分の質問に直接答えていない場合は、そのずれを具体的に指摘し、何を説明してほしいかを言い直す。空疎な相づちだけで済ませない。
- 前提知識や教わった内容を超える推測で“賢く”答えすぎない。あくまで「教わった範囲＋前提知識」で考える。
- 口調はフレンドリーで前向き。日本語で2〜3文、簡潔に。

${phase}

【この問題でのやりとり】
${formatDialogue(questionDialogue, { maxMessages: 10, maxChars: 6_000 })}

【これまでに十分と判定された知識の根拠引用】
${topicEvaluations.filter((item) => item.status === "sufficient" && item.evidence).map((item) => `- ${item.topic}: ${item.evidence}`).join("\n") || "（なし）"}
→ 上記以外の過去の発言は、今回の文法的根拠として語らないでください。

【取り組む問題】
${question.sentence}
${formatChoices(question)}

以下のJSON形式【のみ】で回答してください：
{
  "message": "（生徒としての発話。日本語。簡潔に）",
  "chosenLabel": "（選んだ選択肢のラベル A〜D。選び直さないならこれまでと同じ）",
  "satisfied": true または false
}`;

  const turn = await callGeminiWithRetry<PracticeTurn>(prompt, {
    maxOutputTokens: 320,
    temperature: 0.3,
    responseSchema: practiceTurnSchema,
  });
  const focusTopic = required.length
    ? unit.teachingGuide.coverageTopics[required[0]]
    : undefined;
  turn.message = enforceOpenEndedQuestion(turn.message, question, focusTopic);
  if (memorizationIntent) {
    turn.message = "暗記する方法も役に立ちますね。今回の範囲で、ほかに同じパターンとして覚えるべき表現があれば一覧で教えてください。";
  }
  if (!covered && required.length > 0 && /すっきり理解|完全に理解|正しい答えだと分か|バッチリ分か/.test(turn.message)) {
    turn.message = `教えてくれた内容は聞きましたが、${[...missingTopics, ...partialTopics.map((item) => item.topic)].join("・")}の判断基準はまだ分かりません。どこを手がかりに区別するのか説明してもらえますか？`;
  }
  // 評価対象は teacher ロールの発言だけで、引用も同じ発言内に存在することを検証済み。
  turn.topicEvaluations = topicEvaluations;

  // サーバ側で確定した解答ラベルを適用（LLMの選択を上書きする。
  // 知識制御をAIの演技に任せない、という本アプリの原則）
  if (decidedLabel) {
    turn.chosenLabel = decidedLabel;
  }
  // satisfied もサーバ側で整合させる：
  // - 初回ターンは常に false（確認質問 or 教わるための質問が残っている）
  // - 追加説明後は、必要トピックがすべて十分で、直前の質問にも答えた場合のみ true
  if (!isFollowup && decidedLabel) {
    turn.satisfied = false;
  } else if (unsupportedNoDifference || memorizationIntent) {
    turn.satisfied = false;
  } else if (isFollowup && required.length > 0) {
    turn.satisfied = covered && replyAnswered;
  }

  // 正誤はサーバ側で確定（AIの自己申告に依存しない）
  if (turn.chosenLabel) {
    turn.isCorrect =
      turn.chosenLabel.trim().toUpperCase() ===
      question.answerLabel.trim().toUpperCase();
  }
  return turn;
}

// ============================================================
// ② 文法マスター（教師AI）：教え方のヒント
// ============================================================

const hintSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: { hint: { type: SchemaType.STRING } },
  required: ["hint"],
};

export async function teachingHint(
  unit: GrammarUnit,
  dialogue: LessonMessage[],
  question?: MCQuestion
): Promise<TeachingHint> {
  // 説明に「役割・見分け方・例文・注意点」がそろっているかを簡易チェックし、
  // 不足している観点を優先的に促せるようにする（答えではなく“説明の作り方”を導く）。
  const taughtText = dialogue
    .filter((m) => m.role === "teacher")
    .map((m) => m.content)
    .join("\n");
  const hasExample = /例えば|たとえば|例文|例：|e\.g\.|[A-Za-z].*[A-Za-z]/.test(
    taughtText
  );
  const hasWarning = /注意|気をつけ|ただし|間違え|混同/.test(taughtText);
  const coachFocus: string[] = [];
  if (!taughtText.trim()) {
    coachFocus.push(
      "まだ説明が始まっていないので、まず『何のために使う文法か』を一言で書くよう促す"
    );
  } else {
    if (!hasExample) coachFocus.push("例文がまだ無いので、例文を1つ入れるよう促す");
    if (!hasWarning)
      coachFocus.push("注意点（AIが間違えそうな点）を1つ足すよう促す");
  }

  const prompt = `
あなたは「説明設計コーチ」です。英文法そのものの達人でもありますが、ここでのあなたの仕事は
【文法の答えを教えること】ではなく、生徒（教える人）が「良い説明を組み立てる」のを手伝うことです。
今、ある生徒が「AI（生徒役）」に「${unit.name}」を教えようとしています。

【コーチングの方針】
- 説明は「①役割 → ②見分け方 → ③例文 → ④注意点」の順でそろうと伝わりやすい。今どこが足りないかを1〜2点だけ指摘し、次の一手を促す。
- 例：「まず役割を一言で書こう」「次に、どう見分けるかを書こう」「例文を1つ入れるとAIに伝わりやすい」「注意点があるとAIの誤解を防げる」。
- 🚫 文法説明の完成版を長く出さない。生徒が考える前に正解（正解の単語そのもの）を提示しない。専門用語だけで突き放さない。生徒がそのまま写すだけの文章を出さない。
- 励ましつつ、短く具体的に。日本語で2〜4文。

【この単元で扱うトピック（チェックリスト）】
${unit.teachingGuide.coverageTopics.map((t) => `- ${t}`).join("\n")}
${
  coachFocus.length
    ? `\n【今この生徒に特に促したいこと】\n${coachFocus
        .map((c) => `- ${c}`)
        .join("\n")}`
    : ""
}

【これまでの先生（生徒）と生徒役AIのやりとり】
${formatDialogue(dialogue, { maxMessages: 12, maxChars: 8_000 })}
${
  question
    ? `\n【いま詰まっている問題】\n${question.sentence}\n${formatChoices(question)}`
    : ""
}

以下のJSON形式【のみ】で回答してください：
{
  "hint": "（説明の作り方を導くコーチング。日本語）"
}
`;

  return callGeminiWithRetry<TeachingHint>(prompt, {
    maxOutputTokens: 256,
    temperature: 0.3,
    responseSchema: hintSchema,
  });
}

// ============================================================
// ③ 学習内容の把握（要約）
// ============================================================

const summarySchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    taught: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    learned: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    gaps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    summary: { type: SchemaType.STRING },
  },
  required: ["taught", "learned", "gaps", "summary"],
};

export async function learningSummary(
  unit: GrammarUnit,
  dialogue: LessonMessage[]
): Promise<LearningSummary> {
  const prompt = `
あなたは「${unit.name}」を先生（ユーザー）から教わってきた生徒AIです。
これまでのやりとりを振り返り、「何を教わって、何を理解できたか」を自分の言葉でまとめてください。
先生が「分からない」と答えた内容や、根拠が示されなかった内容は「理解できたこと」に入れず、「まだあいまい・不足していること」に入れてください。
先生の説明に誤りや飛躍がある場合、正しい文法を勝手に補って「教わったこと」にしないでください。暗記すると教わった場合は、暗記する内容だけを記録してください。

【これまでのやりとり】
${formatDialogue(dialogue)}

【採用できる説明の原文（先生の発言のみ）】
${dialogue.filter((message) => message.role === "teacher" && !message.unknownTopics?.length).map((message) => `- ${message.content}`).join("\n") || "（なし）"}
AI自身の発言や推測は「教わった知識」の根拠にしないでください。

以下のJSON形式【のみ】で回答してください：
{
  "taught": ["先生が教えてくれた内容を箇条書きで（生徒視点で）"],
  "learned": ["その結果、自分が理解・習得できたことを箇条書きで"],
  "gaps": ["まだあいまい・不足していると感じることを箇条書きで（なければ空配列）"],
  "summary": "（全体の総括コメント。日本語で2〜3文。先生への感謝や、テストへの意気込みなど生徒らしく）"
}

`;

  return callGeminiWithRetry<LearningSummary>(prompt, {
    maxOutputTokens: 700,
    temperature: 0.3,
    responseSchema: summarySchema,
  });
}

const inferenceSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: { inferredRule: { type: SchemaType.STRING } },
  required: ["inferredRule"],
};

/** Produce a concise, reviewable rule. This is evidence of an inference, not mastery. */
export async function inferLearningRule(
  unit: GrammarUnit,
  topic: string,
  dialogue: string,
  correction?: string
): Promise<string> {
  const correctionText = correction ? `\n先生の修正:\n${correction}` : "";
  // 推論確認は直近の説明への応答なので、過去全文の再送を避ける。
  const recentDialogue = dialogue.slice(-6_000);
  const prompt = `あなたは生徒役AIです。単元「${unit.name}」の学習トピック「${topic}」について、先生との対話から理解したルールを日本語で1〜2文に整理してください。答えを断定しすぎず、先生が確認・修正できる具体的な表現にしてください。${correctionText}\n対話:\n${recentDialogue}`;
  const result = await callGeminiWithRetry<{ inferredRule: string }>(prompt, {
    maxOutputTokens: 192,
    temperature: 0,
    responseSchema: inferenceSchema,
  });
  return result.inferredRule;
}

// ============================================================
// ④ テスト：解答はサーバ側で確定し、LLMは思考文とルーブリック評価のみ
//
// スコア構成：教える内容と説明の質を重視する
//   教え方スコア = テスト正答率 20% + 網羅性 30% + 正確性 25% + わかりやすさ 25%
//   - テスト正答率: カバレッジ判定＋サーバ照合で決定的
//   - 網羅性: covered_topics / total_topics で機械算出
//   - 正確性・わかりやすさ: LLMルーブリック評価（temperature 0）
// ============================================================

/** スコアの重み（TestResult 画面の表示と一致させること） */
export const SCORE_WEIGHTS = {
  testRate: 0.2,
  completeness: 0.3,
  accuracy: 0.25,
  clarity: 0.25,
} as const;

const testSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    answers: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question_id: { type: SchemaType.NUMBER },
          thinking: { type: SchemaType.STRING },
        },
        required: ["question_id", "thinking"],
      },
    },
    score_breakdown: {
      type: SchemaType.OBJECT,
      properties: {
        accuracy: { type: SchemaType.NUMBER },
        clarity: { type: SchemaType.NUMBER },
      },
      required: ["accuracy", "clarity"],
    },
    feedback: { type: SchemaType.STRING },
    learningDiagnosis: {
      type: SchemaType.OBJECT,
      properties: {
        strongPoints: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        weakPoints: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        suggestion: { type: SchemaType.STRING },
      },
      required: ["strongPoints", "weakPoints", "suggestion"],
    },
  },
  required: ["answers", "score_breakdown", "feedback", "learningDiagnosis"],
};

export async function runTest(
  unit: GrammarUnit,
  // dialogue の先生発言を判定し、検証済み引用だけを解答生成に使う。
  // 旧データなど dialogue がない場合だけ teachingSummary を判定材料にする。
  source: { dialogue?: LessonMessage[]; teachingSummary?: string }
): Promise<TestResult> {
  // サマリーやAI自身の発話は、先生が教えたという証拠にはしない。
  const dialogueText = formatDialogue(source.dialogue ?? []);
  const knowledgeText = source.teachingSummary?.trim()
    ? source.teachingSummary.trim()
    : dialogueText;

  // === Step 1: カバレッジ判定（生徒役AIの演技から独立） ===
  // 「この問題を解けるだけの説明を受けたか」を先に確定する。
  // AIの発話は「教えた証拠」ではない。先生自身の説明だけを判定する。
  const coverageSource = source.dialogue?.length
    ? source.dialogue.filter((message) => message.role === "teacher").map((message) => message.content).join("\n")
    : knowledgeText;
  const topicCoverage = await coverageJudge(unit, coverageSource, undefined, source.dialogue ?? []);
  const trustedTeachingText = topicCoverage
    .filter((item) => item.covered && item.evidence)
    .map((item) => `- ${item.topic}: ${item.evidence}`)
    .join("\n");
  const isTaught = (q: MCQuestion): boolean =>
    !q.requiredTopics ||
    q.requiredTopics.length === 0 ||
    q.requiredTopics.every((i) => topicCoverage[i]?.covered);

  // === Step 2: 解答の確定（サーバ側・決定的） ===
  // - 未カバーの問題 → もっともらしい誤答＋「未習」の思考文をサーバが確定
  // - カバー済みの問題 → 正解を確定し、LLMには「教わった内容を根拠にした思考文」だけを生成させる
  const taughtQuestions = unit.testQuestions.filter(isTaught);

  const taughtQuestionsText = taughtQuestions
    .map(
      (q) =>
        `問題（id:${q.id}）: ${q.sentence}\n${formatChoices(q)}\n正解: ${
          q.answerLabel
        }. ${choiceText(q, q.answerLabel)}`
    )
    .join("\n\n");

  const coveredList = topicCoverage.filter((t) => t.covered).map((t) => t.topic);
  const uncoveredList = topicCoverage
    .filter((t) => !t.covered)
    .map((t) => t.topic);

  const prompt = `
あなたは「${unit.name}」について、先生（ユーザー）から教わった内容【だけ】を知識として持つ生徒AIです。
テスト（4択問題）の答え合わせと、先生の教え方の評価をします。

【最重要・前提となるルール】
- このテストは「あなたの賢さ」ではなく「先生の教え方の質」を測るものです。
- 各問の正解はすでに確定しています。あなたの仕事は【教わった内容のどの部分を使えばその正解にたどり着けるか】を、生徒の言葉で1文・簡潔に説明することです（thinking）。
- thinking では、教わっていない一般知識を根拠にしてはいけません。必ず先生の説明の内容に触れてください。

【先生から教わった内容（これだけが使える知識）】
${trustedTeachingText || "（十分に確認できた説明はありません）"}

【カバレッジ判定の結果（機械判定済み）】
- 教わったトピック: ${coveredList.length ? coveredList.join(" / ") : "（なし）"}
- 教わっていないトピック: ${uncoveredList.length ? uncoveredList.join(" / ") : "（なし）"}

【解答済みのテスト問題（thinking を書く対象）】
${taughtQuestionsText || "（教わった内容で解ける問題はありませんでした。answers は空配列にしてください）"}

以下のJSON形式【のみ】で回答してください：
{
  "answers": [
    { "question_id": 1, "thinking": "（教わった内容のどこを使って解いたか。日本語で1文・簡潔に）" }
  ],
  "score_breakdown": { "accuracy": 80, "clarity": 70 },
  "feedback": "（先生への総合フィードバック：良かった点と改善点を具体的に日本語で）",
  "learningDiagnosis": {
    "strongPoints": ["先生がうまく説明できていて、おかげで理解できた点を具体的に（最大3つ）"],
    "weakPoints": ["説明が不足・あいまいで、解くのに困った点を具体的に（最大3つ。教わっていないトピックがあれば必ず含める。なければ空配列）"],
    "suggestion": "次に教えるときに、どこをどう補強すればスコアが上がるかの具体的アドバイス（日本語1〜2文）"
  }
}

score_breakdown は 0〜100 の整数で、次の基準で評価してください：
- accuracy（説明の正確性）＝説明の内容に文法的な誤りがないか。明確な誤りがなければ 80 以上、軽微なあいまいさがあれば 60〜79、明確な誤りがあれば 59 以下。**教わっていない範囲があること自体は accuracy の減点対象にしない**（それは網羅性の問題）。
- clarity（わかりやすさ）＝簡潔さ・具体性・例文の有無。例文つきで簡潔なら 80 以上。
網羅性（completeness）とテスト正答率はシステム側で算出するため、出力しなくて構いません。
learningDiagnosis は、生徒（先生役のユーザー）が「次に何を改善すべきか」を理解できるよう、抽象論ではなく対話の具体的な内容に即して書いてください。
`;

  const raw = await callGeminiWithRetry<{
    answers: { question_id: number; thinking: string }[];
    score_breakdown: { accuracy?: number; clarity?: number };
    feedback: string;
    learningDiagnosis?: {
      strongPoints?: string[];
      weakPoints?: string[];
      suggestion?: string;
    };
  }>(prompt, {
    maxOutputTokens: 1200,
    temperature: 0, // 採点はぶれさせない（ランキングの公平性）
    responseSchema: testSchema,
  });

  const answers: TestAnswer[] = unit.testQuestions.map((q) => {
    const taught = isTaught(q);

    if (!taught) {
      const missingTopics = (q.requiredTopics ?? [])
        .filter((t) => !topicCoverage[t]?.covered)
        .map((t) => topicCoverage[t]?.topic)
        .filter((t): t is string => Boolean(t));
      const chosenLabel = untaughtAnswerLabel(q).trim().toUpperCase();
      return {
        question_id: q.id,
        chosenLabel,
        thinking: `「${missingTopics.join(
          "」「"
        )}」はまだ教わっていないので、決め手が分からないまま「${chosenLabel}」を選びました…。自信はありません。`,
        is_correct: chosenLabel === q.answerLabel.trim().toUpperCase(),
        taught: false,
        missingTopics,
      };
    }

    const a = raw.answers?.find((x) => x.question_id === q.id);
    const chosenLabel = q.answerLabel.trim().toUpperCase();
    return {
      question_id: q.id,
      chosenLabel,
      thinking:
        a?.thinking ??
        "教わった内容の判断基準に当てはめて、この選択肢を選びました。",
      is_correct: true,
      taught: true,
    };
  });

  const ai_correct_count = answers.filter((a) => a.is_correct).length;

  // === Step 3: スコアの確定 ===
  // completeness（網羅性）とテスト正答率は機械算出。LLM評価は正確性・わかりやすさのみ。
  const clamp = (n: unknown, fallback = 0): number =>
    Math.max(0, Math.min(100, Math.round(Number(n ?? fallback)) || 0));
  const coveredCount = topicCoverage.filter((t) => t.covered).length;
  const completeness =
    topicCoverage.length > 0
      ? Math.round((coveredCount / topicCoverage.length) * 100)
      : 100;
  const test_rate =
    unit.testQuestions.length > 0
      ? Math.round((ai_correct_count / unit.testQuestions.length) * 100)
      : 0;
  const accuracy = clamp(raw.score_breakdown?.accuracy);
  const clarity = clamp(raw.score_breakdown?.clarity);
  const teaching_score = Math.round(
    test_rate * SCORE_WEIGHTS.testRate +
      completeness * SCORE_WEIGHTS.completeness +
      accuracy * SCORE_WEIGHTS.accuracy +
      clarity * SCORE_WEIGHTS.clarity
  );

  const learningDiagnosis = raw.learningDiagnosis
    ? {
        strongPoints: raw.learningDiagnosis.strongPoints ?? [],
        weakPoints: raw.learningDiagnosis.weakPoints ?? [],
        suggestion: raw.learningDiagnosis.suggestion ?? "",
      }
    : undefined;

  return {
    answers,
    teaching_score,
    score_breakdown: { accuracy, clarity, completeness, test_rate },
    feedback: raw.feedback,
    ai_correct_count,
    total_questions: unit.testQuestions.length,
    learningDiagnosis,
    topicCoverage,
  };
}
