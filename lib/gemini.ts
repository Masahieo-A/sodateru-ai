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

// 軽量・低レイテンシのモデル。2.5-flash は隠れた思考トークンで遅くなるため、
// 既定でほぼ思考しない flash-lite を使う（応答が約2秒台に短縮される）。
const MODEL = "gemini-2.5-flash-lite";

/** maxOutputTokens を指定してモデルを取得（出力を引き締めて生成時間を短縮） */
function getModel(maxOutputTokens: number) {
  return genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens,
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
  isFollowup: boolean,
  exchangeCount: number,
  forceStumble = false
): Promise<PracticeTurn> {
  const model = getModel(500);

  // forceStumble: 全問正解しそうな場合に、メタ認知のきっかけとして
  // “もっともらしい誤解”で1問だけあえて間違える（初回ターンのみ）
  const stumbleActive = forceStumble && !isFollowup;
  const wrongChoices = question.choices.filter(
    (c) => c.label.toUpperCase() !== question.answerLabel.toUpperCase()
  );
  const targetLabel =
    question.commonMistake?.label ?? wrongChoices[0]?.label ?? question.answerLabel;
  const targetText =
    question.choices.find((c) => c.label === targetLabel)?.text ?? "";

  let phase: string;
  if (stumbleActive) {
    phase = `【今回は「新しい問題」ですが、あなたは“もっともらしい誤解”をしてしまいます】
あなたはこれまでの問題は理解できていますが、この問題だけは、先生の説明を完全には咀嚼しきれず、解釈のズレ・思い込みから【誤った選択肢】を選んでしまいます。
- あなたが選ぶのは「${targetLabel}（${targetText}）」です。これは実は誤答ですが、あなたは（もっともらしく）それが正しいと思い込んでいます。
${
  question.commonMistake
    ? `- あなたの思い込み（誤解）の中身：「${question.commonMistake.misconception}」。これを自分の言葉で、自然な生徒の口調で語ってください。`
    : `- 「教わったルールをこの問題にも当てはめたら ${targetLabel} になるはず」といった、もっともらしい過剰一般化・取り違えを自分の言葉で表現してください。`
}
- 🚫 教わった内容そのものを否定したり、別人のように雑に振る舞ってはいけません。あくまで「自分なりに考えたら、こう解釈してしまった」という素直な誤解として表現します。
- 最後に「これで合っているか、ちょっと自信がないです」と先生に確認を促してください。
- satisfied は false。`;
  } else if (isFollowup) {
    phase = `【今回は「追加説明への応答」です】
先生があなたの質問・つぶやきに答えてくれました。あなたは“学んで成長する生徒”です。次の方針で応答してください：
1. 教わった内容を自分の言葉で一言だけ言い換えて「分かりました！」と理解・成長を示す。もし前の自分の答えが間違っていたと気づいたら、正しい選択肢に選び直してください。
2. 🚫【最重要】すでに先生が答えてくれた質問を、言い回しを変えてもう一度きいてはいけません。同じ論点を蒸し返さないこと。
3. 疑問が解消したら、たとえ完璧な理解でなくても satisfied を true にして次へ進みます（粘りすぎない・追い詰めない）。
4. 例外として、説明がどうしても理解できない／前と全く別の新しい疑問が出た場合のみ satisfied を false にし、【前回と違う】新しい質問を1つだけします。
5. ただし、これまで ${exchangeCount} 回やりとりしています。2回以上なら、必ず satisfied を true にして気持ちよく次に進んでください。`;
  } else {
    phase = `【今回は「新しい問題」です】
教わった内容で考え、選択肢を1つ選び、理由を一言で述べてください。
そのうえで、もし「他の選択肢がなぜ違うのか確信が持てない」「この考え方だと別のタイプの問題は解けないかも」といった“引っかかり”が1つだけあれば、それを具体的に質問してください（先生が深く教えるきっかけになります）。
- 質問・引っかかりを述べるなら satisfied は false。
- 特に引っかかりがなく自信があるなら satisfied は true。`;
  }

  const prompt = `
あなたは「${unit.name}」を自分では知らない、素直で前向きな生徒AIです。
先生（ユーザー）が教えてくれた内容【だけ】を使って、4択問題に取り組みます。

【共通ルール】
- 教わっていない文法知識は使わない（知っていても「まだ教わっていない」と振る舞う）。
- 先生が一度教えてくれたことは「学んだこと」として素直に受け入れ、同じ質問を繰り返さない。
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

  const result = await model.generateContent(prompt);
  const turn = parseJson<PracticeTurn>(result.response.text());

  // forceStumble 時は、プログラム側で誤答ラベルを確定して必ず1問間違えさせる
  // （AIが誤って正答を選んでも上書きし、確実に「間違い→気づき→訂正」を成立させる）
  if (stumbleActive) {
    turn.chosenLabel = targetLabel;
    turn.satisfied = false;
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
export async function teachingHint(
  unit: GrammarUnit,
  dialogue: LessonMessage[],
  question?: MCQuestion
): Promise<TeachingHint> {
  const model = getModel(500);

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
  const model = getModel(800);

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
  const model = getModel(1500);

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

各問について、教わった内容のどの部分を使って考えたか（思考過程）を日本語で**1文・簡潔に**示し、選択肢を1つ選んでください。
教わっていなくて解けない場合は、その旨を thinking に短く書き、最も妥当だと思うものを選んでください。

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
