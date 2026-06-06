import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  GrammarUnit,
  MCQuestion,
  LessonMessage,
  PracticeTurn,
  TeachingHint,
  LearningSummary,
  TestResult,
  TestAnswer,
} from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function getModel() {
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });
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

/** JSON文字列を安全にパース */
function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Gemini response parse failed: ${text.slice(0, 200)}`);
  }
}

// ============================================================
// ① 練習問題：生徒役AIの1ターン
// ============================================================
export async function practiceChat(
  unit: GrammarUnit,
  question: MCQuestion,
  dialogue: LessonMessage[],
  isFollowup: boolean
): Promise<PracticeTurn> {
  const model = getModel();

  const prompt = `
あなたは「${unit.name}」について自分では知識を持たない、素直で好奇心旺盛な英語学習者（生徒）です。
先生（ユーザー）が教えてくれた内容【だけ】を使って、4択問題に取り組みます。

【絶対に守るルール】
- 先生が教えてくれた内容以外の文法知識は使わないこと。一般常識として知っていても、教わっていなければ「教わっていないので分からない」と振る舞う。
- 4択なので「なんとなく」で正解できてしまうことがある。だからこそ、選んだ理由を述べ、正解できた場合でも「他の選択肢がなぜ間違いなのか確信が持てない」「この考え方だと、別のタイプの問題は解けないかもしれない」など、理解の浅い部分を素直に言葉にすること。
- 先生にもっと教えてほしいことがあれば、具体的に質問すること（1問1答形式）。
- 口調はフレンドリーで、生徒らしく。日本語で2〜4文程度。

【これまでの先生とのやりとり】
${formatDialogue(dialogue)}

【取り組む問題】
${question.sentence}
${formatChoices(question)}

${
  isFollowup
    ? "先生が追加で説明してくれました。それを踏まえて、理解できたか・まだ疑問が残るかを述べてください。"
    : "これは新しい問題です。まずこの問題に取り組み、選択肢を1つ選んでください。"
}

以下のJSON形式【のみ】で回答してください：
{
  "message": "（生徒としての発話。選んだ理由・つぶやき・先生への質問など。日本語）",
  "chosenLabel": "（選んだ選択肢のラベル A〜D。今回選び直さない場合はこれまでと同じラベル）",
  "satisfied": false
}

satisfied は、先生の説明で十分に理解でき、もうこの問題について質問することがなくなった場合のみ true。
まだ疑問やつぶやき・質問が残っているなら false。
`;

  const result = await model.generateContent(prompt);
  const turn = parseJson<PracticeTurn>(result.response.text());

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
export async function teachingHint(
  unit: GrammarUnit,
  dialogue: LessonMessage[],
  question?: MCQuestion
): Promise<TeachingHint> {
  const model = getModel();

  const prompt = `
あなたは英文法の達人「文法マスター」です。
今、ある生徒が「AI（生徒役）」に「${unit.name}」を教えようとしていますが、うまく教えられず悩んでいます。
あなたの役割は、答えそのものを与えるのではなく、生徒（教える人）に【どう教えればよいか】のヒントを与えることです。

【ヒントの方針】
- 「○○という文法用語に触れて説明すると良い」「△△と□□を対応表で整理すると伝わりやすい」のように、教え方・説明の切り口を示す。
- 答え（正解の単語そのもの）はできるだけ直接言わず、考え方を導く。
- 励ましつつ、具体的で実践的に。日本語で3〜5文。

【この単元で扱うトピック】
${unit.teachingGuide.coverageTopics.map((t) => `- ${t}`).join("\n")}

【これまでの先生（生徒）と生徒役AIのやりとり】
${formatDialogue(dialogue)}
${
  question
    ? `\n【いま詰まっている問題】\n${question.sentence}\n${formatChoices(question)}`
    : ""
}

以下のJSON形式【のみ】で回答してください：
{
  "hint": "（教え方のヒント。日本語）"
}
`;

  const result = await model.generateContent(prompt);
  return parseJson<TeachingHint>(result.response.text());
}

// ============================================================
// ③ 学習内容の把握（要約）
// ============================================================
export async function learningSummary(
  unit: GrammarUnit,
  dialogue: LessonMessage[]
): Promise<LearningSummary> {
  const model = getModel();

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

  const result = await model.generateContent(prompt);
  return parseJson<LearningSummary>(result.response.text());
}

// ============================================================
// ④ テスト：教わった知識だけで全問解答＋スコアリング
// ============================================================
export async function runTest(
  unit: GrammarUnit,
  dialogue: LessonMessage[]
): Promise<TestResult> {
  const model = getModel();

  const questionsText = unit.testQuestions
    .map(
      (q, i) =>
        `問題${i + 1}（id:${q.id}）: ${q.sentence}\n${formatChoices(q)}`
    )
    .join("\n\n");

  const prompt = `
あなたは「${unit.name}」について、先生（ユーザー）から教わった内容【だけ】を知識として持つ生徒AIです。
今からテスト（4択問題）を受けます。教わっていない知識は使わず、教わった内容だけを根拠に解いてください。

【先生から教わった内容（これだけが使える知識）】
${formatDialogue(dialogue)}

【テスト問題】
${questionsText}

各問について、教わった内容のどの部分を使って考えたか（思考過程）を日本語で示し、選択肢を1つ選んでください。
教わっていなくて解けない場合は、その旨を thinking に書き、最も妥当だと思うものを選んでください。

以下のJSON形式【のみ】で回答してください：
{
  "answers": [
    { "question_id": 1, "chosenLabel": "A", "thinking": "（思考過程。日本語）" }
  ],
  "teaching_score": 75,
  "score_breakdown": { "accuracy": 80, "clarity": 70, "completeness": 75 },
  "feedback": "（先生への総合フィードバック：良かった点と改善点を具体的に日本語で）"
}

teaching_score は 0〜100 の整数で、先生の「教え方」の質（正確性・わかりやすさ・網羅性）を総合評価してください。
score_breakdown の各項目も 0〜100 の整数です。
※ 各問の正誤判定（is_correct）はこちらで行うので、answers には含めなくて構いません。
`;

  const result = await model.generateContent(prompt);
  const raw = parseJson<{
    answers: { question_id: number; chosenLabel: string; thinking: string }[];
    teaching_score: number;
    score_breakdown: {
      accuracy: number;
      clarity: number;
      completeness: number;
    };
    feedback: string;
  }>(result.response.text());

  // 正誤はサーバ側で確定
  const answers: TestAnswer[] = unit.testQuestions.map((q, i) => {
    const a =
      raw.answers.find((x) => x.question_id === q.id) ?? raw.answers[i];
    const chosenLabel = (a?.chosenLabel ?? "").trim().toUpperCase();
    return {
      question_id: q.id,
      chosenLabel,
      thinking: a?.thinking ?? "（回答なし）",
      is_correct: chosenLabel === q.answerLabel.trim().toUpperCase(),
    };
  });

  const ai_correct_count = answers.filter((a) => a.is_correct).length;

  return {
    answers,
    teaching_score: raw.teaching_score,
    score_breakdown: raw.score_breakdown,
    feedback: raw.feedback,
    ai_correct_count,
    total_questions: unit.testQuestions.length,
  };
}
