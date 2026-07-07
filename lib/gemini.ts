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
} from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 軽量・低レイテンシのモデル。2.5-flash は隠れた思考トークンで遅くなるため、
// 既定でほぼ思考しない flash-lite を使う（応答が約2秒台に短縮される）。
const MODEL = "gemini-2.5-flash-lite";

// ============================================================
// 同時実行制御（簡易セマフォ）
// 教室で30人が同時に使っても、このサーバインスタンスからの
// Gemini呼び出しを同時数本に抑えて 429（RPM制限）を踏みにくくする。
// ============================================================
const MAX_CONCURRENT_CALLS = 4;
let activeCalls = 0;
const callWaiters: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (activeCalls < MAX_CONCURRENT_CALLS) {
    activeCalls++;
    return Promise.resolve();
  }
  return new Promise((resolve) =>
    callWaiters.push(() => {
      activeCalls++;
      resolve();
    })
  );
}

function releaseSlot(): void {
  activeCalls--;
  callWaiters.shift()?.();
}

// ============================================================
// callGeminiWithRetry：全Gemini呼び出しの共通ラッパー
// - リトライ最大3回、指数バックオフ＋ジッター（0.5s → 1.5s → 4s）
// - 対象: 429 / 5xx / タイムアウト / ネットワーク / JSONパース失敗
// - responseSchema で構造化出力を強制し、パース失敗自体を減らす
// ============================================================
const RETRY_DELAYS_MS = [500, 1500, 4000];

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
        timeout: opts.timeoutMs ?? 30_000,
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

/** dialogue をプロンプト用テキストに整形 */
function formatDialogue(dialogue: LessonMessage[]): string {
  if (dialogue.length === 0) return "（まだ何も教わっていない）";
  return dialogue
    .map((m) =>
      m.role === "teacher"
        ? `【先生（教える人）】\n${m.content}`
        : `【あなた（生徒AI）の発言】\n${m.content}`
    )
    .join("\n\n");
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

const coverageSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    coverage: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          topic_index: { type: SchemaType.NUMBER },
          covered: { type: SchemaType.BOOLEAN },
          evidence: { type: SchemaType.STRING },
        },
        required: ["topic_index", "covered"],
      },
    },
  },
  required: ["coverage"],
};

/**
 * カバレッジ判定器。
 * 生徒役AIの「教わっていないふり」という演技に頼らず、
 * 「先生の説明が各学習トピックを解けるレベルで含むか」を独立に判定する。
 * - ロールプレイなしの含意判定（temperature 0）なので、潜在知識の混入が構造的に起きにくい
 * - covered の根拠引用はサーバ側で説明文と照合し、検証できなければ false に倒す
 *   （ハルシネーションした根拠で「教わったことにする」のを防ぐ）
 * - topicIndices を渡すと、そのトピックだけを判定する（練習問題の1問単位で使う）
 */
export async function coverageJudge(
  unit: GrammarUnit,
  knowledgeText: string,
  topicIndices?: number[]
): Promise<TopicCoverage[]> {
  const allTopics = unit.teachingGuide.coverageTopics;
  const targets = (topicIndices ?? allTopics.map((_, i) => i)).filter(
    (i) => i >= 0 && i < allTopics.length
  );

  // 何も教わっていなければ、LLMを呼ぶまでもなく全トピック未カバーで確定
  const hasKnowledge =
    knowledgeText.trim().length > 0 &&
    knowledgeText.trim() !== "（まだ何も教わっていない）";
  if (!hasKnowledge || targets.length === 0) {
    return targets.map((i) => ({
      topicIndex: i,
      topic: allTopics[i],
      covered: false,
    }));
  }

  const prompt = `
あなたは学習アプリの「カバレッジ判定器」です。ロールプレイはせず、機械的に判定します。
以下は、先生（ユーザー）が生徒AIに行った「${unit.name}」の説明（対話記録）です。
各学習トピックについて、この説明の中に【そのトピックの問題を解けるレベルの記述】があるかを判定してください。

【判定基準】
- 文法用語が一致していなくても、内容として判断基準が伝わっていれば covered = true。
- 関連する単語が登場するだけで、使い方・判断基準の説明がない場合は covered = false。
- covered = true の場合、根拠となる箇所を先生の説明から【一字一句そのまま】引用して evidence に入れる（要約・言い換えは禁止）。
- covered = false の場合、evidence は空文字列にする。

【先生の説明（対話記録）】
${knowledgeText}

【学習トピック】
${targets.map((i) => `${i}: ${allTopics[i]}`).join("\n")}

以下のJSON形式【のみ】で回答してください：
{
  "coverage": [
    { "topic_index": 0, "covered": true, "evidence": "（説明からの引用）" }
  ]
}
※ coverage には上記の全トピック（インデックス: ${targets.join(", ")}）を必ず含めること。
`;

  const raw = await callGeminiWithRetry<{
    coverage: { topic_index: number; covered: boolean; evidence?: string }[];
  }>(prompt, {
    maxOutputTokens: 800,
    temperature: 0, // 判定はぶれさせない
    responseSchema: coverageSchema,
  });

  // 対象トピック分の配列に整形（判定漏れは未カバー扱い）
  return targets.map((i) => {
    const judged = raw.coverage?.find((c) => c.topic_index === i);
    const evidence = judged?.evidence?.trim() || undefined;
    const evidenceVerified = evidence
      ? verifyEvidence(evidence, knowledgeText)
      : false;
    // 根拠引用が説明中に見つからない covered は false に倒す（安全側）
    const covered = !!judged?.covered && evidenceVerified;
    return {
      topicIndex: i,
      topic: allTopics[i],
      covered,
      evidence: covered ? evidence : undefined,
      evidenceVerified: covered ? true : undefined,
    };
  });
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
  let evidence: string | undefined;
  if (!coldOpenActive && !stumbleActive && required.length > 0) {
    const teacherText = dialogue
      .filter((m) => m.role === "teacher")
      .map((m) => m.content)
      .join("\n");
    const coverage = await coverageJudge(unit, teacherText, required);
    missingTopics = coverage.filter((t) => !t.covered).map((t) => t.topic);
    evidence = coverage.find((t) => t.covered && t.evidence)?.evidence;
  }
  const covered = required.length > 0 && missingTopics.length === 0;

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
  if (coldOpenActive) {
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
- 教わったことへのお礼と理解を一言示したうえで、まだ引っかかっている点について【前回とは違う】具体的な質問を1つだけしてください。
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
- そのうえで、🚫「合っていますよね？」のような定型の確認だけで終わらず、理解を確かめる【一歩踏み込んだ確認質問】を1つしてください。
  例：「じゃあ先行詞が◯◯の場合でも同じ考え方でいいんですか？」のような、少し条件を変えた場合の汎化を尋ねる質問。
- satisfied は false（先生の返事を待ちます）。`;
  } else if (required.length > 0 && !covered) {
    // まだ教わっていない問題：必ず誤答し、先生が教えるきっかけの質問をする
    phase = `【今回は「新しい問題」ですが、解くのに必要なことをまだ教わっていません】
この問題を解くには「${missingTopics.join(
      "」「"
    )}」の知識が必要ですが、あなたはまだ教わっていません。
- あなたが選ぶのは「${mistakeLabel}（${mistakeText}）」です。決め手がなく、なんとなくそれらしく見えるだけで、自信はありません。
- 「${missingTopics[0]}については、まだ教わっていないので自信がないです…」と正直に伝えてください。
- 最後に、先生が教え始めるきっかけになる【具体的な質問】を1つだけしてください（判断基準を尋ねる質問が望ましい）。
- 🚫 正解を確信を持って言い当ててはいけません。🚫「推測で選びました」という言い方もしないこと。
- satisfied は false。`;
  } else {
    phase = `【今回は「新しい問題」です】
教わった内容で考え、選択肢を1つ選び、理由を一言で述べてください。
そのうえで、🚫「合っていますよね？」のような定型の確認だけで終わらず、「他の選択肢がなぜ違うのか確信が持てない」「先行詞が変わっても同じか確かめたい」といった、理解を確かめる【一歩踏み込んだ確認質問】を1つしてください（先生が深く教えるきっかけになります）。
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
- 上の学習対象について、先生が一度教えてくれたことは「学んだこと」として素直に受け入れ、同じ質問を繰り返さない。
- 前提知識や教わった内容を超える推測で“賢く”答えすぎない。あくまで「教わった範囲＋前提知識」で考える。
- 口調はフレンドリーで前向き。日本語で2〜3文、簡潔に。

${phase}

【これまでの先生とのやりとり】
${formatDialogue(dialogue)}

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
    maxOutputTokens: 500,
    temperature: 0.3,
    responseSchema: practiceTurnSchema,
  });

  // サーバ側で確定した解答ラベルを適用（LLMの選択を上書きする。
  // 知識制御をAIの演技に任せない、という本アプリの原則）
  if (decidedLabel) {
    turn.chosenLabel = decidedLabel;
  }
  // satisfied もサーバ側で整合させる：
  // - 初回ターンは常に false（確認質問 or 教わるための質問が残っている）
  // - 追加説明後、まだ未カバーなら false（安全弁：2回以上のやりとりで true）
  if (!isFollowup && decidedLabel) {
    turn.satisfied = false;
  } else if (isFollowup && required.length > 0) {
    turn.satisfied = covered ? true : exchangeCount >= 2;
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
${formatDialogue(dialogue)}
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
    maxOutputTokens: 500,
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

【これまでのやりとり】
${formatDialogue(dialogue)}

以下のJSON形式【のみ】で回答してください：
{
  "taught": ["先生が教えてくれた内容を箇条書きで（生徒視点で）"],
  "learned": ["その結果、自分が理解・習得できたことを箇条書きで"],
  "gaps": ["まだあいまい・不足していると感じることを箇条書きで（なければ空配列）"],
  "summary": "（全体の総括コメント。日本語で2〜3文。先生への感謝や、テストへの意気込みなど生徒らしく）"
}
`;

  return callGeminiWithRetry<LearningSummary>(prompt, {
    maxOutputTokens: 800,
    temperature: 0.3,
    responseSchema: summarySchema,
  });
}

// ============================================================
// ④ テスト：解答はサーバ側で確定し、LLMは思考文とルーブリック評価のみ
//
// スコア構成（P1-3 / P2-7）：決定的な成分で70%を構成する
//   教え方スコア = テスト正答率 40% + 網羅性 30% + 正確性 20% + わかりやすさ 10%
//   - テスト正答率: カバレッジ判定＋サーバ照合で決定的
//   - 網羅性: covered_topics / total_topics で機械算出
//   - 正確性・わかりやすさ: LLMルーブリック評価（temperature 0）
// ============================================================

/** スコアの重み（TestResult 画面の表示と一致させること） */
export const SCORE_WEIGHTS = {
  testRate: 0.4,
  completeness: 0.3,
  accuracy: 0.2,
  clarity: 0.1,
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
  // teachingSummary があればそれを知識源に使う（トークン削減）。
  // なければ対話全文 dialogue にフォールバックする。
  source: { dialogue?: LessonMessage[]; teachingSummary?: string }
): Promise<TestResult> {
  // 教わった内容（テストでAIが使える唯一の知識）
  // ※カバレッジ判定の引用照合は「対話全文」に対して行う（サマリーは要約のため
  //   引用元にならない）。判定AIへも対話全文を渡し、解答AIにはサマリー優先で渡す。
  const dialogueText = formatDialogue(source.dialogue ?? []);
  const knowledgeText = source.teachingSummary?.trim()
    ? source.teachingSummary.trim()
    : dialogueText;

  // === Step 1: カバレッジ判定（生徒役AIの演技から独立） ===
  // 「この問題を解けるだけの説明を受けたか」を先に確定する。
  const coverageSource = source.dialogue?.length ? dialogueText : knowledgeText;
  const topicCoverage = await coverageJudge(unit, coverageSource);
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
${knowledgeText}

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
    maxOutputTokens: 1500,
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
