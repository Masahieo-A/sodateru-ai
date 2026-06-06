import { GoogleGenerativeAI } from "@google/generative-ai";
import { GrammarUnit, TeachResult } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function evaluateTeaching(
  unit: GrammarUnit,
  explanation: string
): Promise<TeachResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const questionsText = unit.questions
    .map(
      (q, i) =>
        `問題${i + 1}: "${q.sentence}" の ___ に入る語句を答えてください。`
    )
    .join("\n");

  const prompt = `
あなたは「${unit.name}」について全く知識がない英語学習者です。
今から先生があなたに「${unit.name}」のルールを説明します。
あなたは先生が説明した内容だけを使って問題を解いてください。

【重要なルール】
- 先生が教えた内容以外の英文法知識は絶対に使ってはいけません
- 先生が教えていないことは「教えてもらっていない」と正直に述べてください
- 問題ごとに、先生の説明のどの部分を使って考えたか（思考過程）を日本語で示してください
- 先生の説明が不足していて答えられなかった場合はその旨を書いてください

---先生の説明（これだけが使える知識）---
${explanation}
---ここまで---

以下の問題を解いてください：
${questionsText}

以下のJSON形式のみで回答してください（余分なテキストは不要）：
{
  "answers": [
    {
      "question_id": 1,
      "answer": "（答え）",
      "thinking": "（先生の説明のどの部分を使って考えたか、日本語で）",
      "is_correct": true
    }
  ],
  "missing_knowledge": ["（先生が教えてくれなかったため答えられなかった or 迷った知識）"],
  "teaching_score": 75,
  "score_breakdown": {
    "accuracy": 80,
    "clarity": 70,
    "completeness": 75
  },
  "feedback": "（先生へのフィードバック：良かった点と改善点を具体的に日本語で）",
  "ai_correct_count": 4,
  "total_questions": ${unit.questions.length}
}

各answerの is_correct は、以下の正解と照合して設定してください：
${unit.questions.map((q, i) => `問題${i + 1}: "${q.answer}"`).join(", ")}

teaching_score は 0〜100 の整数で、先生の説明の質（正確性・明確さ・網羅性）を総合評価してください。
score_breakdown の各項目も 0〜100 の整数です。
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as TeachResult;
  } catch {
    throw new Error(`Gemini response parse failed: ${text.slice(0, 200)}`);
  }
}
