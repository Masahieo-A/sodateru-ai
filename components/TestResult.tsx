"use client";

import { AppIcon } from "@/components/AppIcon";
import { SotaAvatar } from "@/components/SotaAvatar";

import { GrammarUnit, TestResult as TR } from "@/types";
import { cn } from "@/lib/utils";
import type { AiLearningEvidence, MasteryEvidence } from "@/types/learning";

type Props = {
  result: TR;
  unit: GrammarUnit;
  onRetry: () => void;
  /** 練習中に“あえて1問間違える”演出が発動した場合 true（事後開示する） */
  forceStumbleUsed?: boolean;
  /** Structured evidence from the learner checkpoint. Optional for legacy result views. */
  aiLearningEvidence?: AiLearningEvidence[];
  masteryEvidence?: MasteryEvidence[];
};

function ScoreRing({
  score,
  label,
  weight,
}: {
  score: number;
  label: string;
  /** 教え方スコアに占める重み（例: "20%"） */
  weight: string;
}) {
  const color =
    score >= 80
      ? "text-green-500"
      : score >= 60
      ? "text-yellow-500"
      : "text-red-400";

  return (
    <div className="flex flex-col items-center">
      <div className={cn("text-3xl font-black", color)}>{score}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      <div className="text-[10px] text-gray-400">重み {weight}</div>
    </div>
  );
}

export function TestResult({
  result,
  unit,
  onRetry,
  forceStumbleUsed = false,
  aiLearningEvidence = [],
  masteryEvidence = [],
}: Props) {
  const testRate = Math.round(
    (result.ai_correct_count / result.total_questions) * 100
  );
  const scoreColor =
    result.teaching_score >= 80
      ? "from-green-400 to-emerald-500"
      : result.teaching_score >= 60
      ? "from-yellow-400 to-orange-400"
      : "from-red-400 to-rose-500";

  return (
    <div className="space-y-6">
      {masteryEvidence.length > 0 && (
        <div className="bg-green-50 rounded-2xl border border-green-100 shadow-sm p-5">
          <h2 className="text-lg font-black text-green-900 mb-1"><AppIcon name="success" /> 自分で解けたこと</h2>
          <p className="text-sm text-green-800 mb-4">
            独立チェック正答: {masteryEvidence.filter((e) => e.isCorrect).length}/{masteryEvidence.length}問
          </p>
          <div className="space-y-2">
            {masteryEvidence.map((e) => (
              <div key={e.id} className={cn("rounded-xl border px-3 py-2.5", e.isCorrect ? "bg-white border-green-200" : "bg-amber-50 border-amber-200")}>
                <div className="flex items-start gap-2">
                  <AppIcon name={e.isCorrect ? "success" : "empty"} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{e.topicRef.topic}</p>
                    <p className="text-xs text-gray-600 mt-1">{e.checkQuestion}</p>
                    <p className="text-xs text-gray-500 mt-1">あなたの答え: {e.selectedAnswer} {e.isCorrect ? "（正解）" : `（正解: ${e.expectedAnswer}）`}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* スコアヘッダー */}
      <div
        className={cn(
          "rounded-2xl p-6 bg-gradient-to-r text-white text-center shadow-lg",
          scoreColor
        )}
      >
        <div className="text-sm font-medium opacity-90 mb-1">ソウタに伝わったこと／教え方スコア</div>
        <div className="text-6xl font-black mb-2">{result.teaching_score}</div>
        <div className="text-sm opacity-90">/ 100点</div>
        <div className="mt-3 text-sm bg-white/20 rounded-lg px-3 py-1 inline-block">
          ソウタのテスト正答率: {result.ai_correct_count}/{result.total_questions}問 （
          {testRate}%）
        </div>
        {aiLearningEvidence.length > 0 && (
          <div className="mt-2 text-xs opacity-90">ソウタの理解確認: {aiLearningEvidence.length}トピック</div>
        )}
      </div>

      {/* AIに伝わったことの内訳（重みは lib/gemini.ts と一致） */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-1"><AppIcon name="chart" /> ソウタに伝わったことの内訳</h3>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          教え方スコア ＝ ソウタのテスト正答率×20％ ＋ 網羅性×30％ ＋ 正確性×25％ ＋ わかりやすさ×25％
        </p>
        <div className="grid grid-cols-4 gap-3 text-center">
          <ScoreRing
            score={result.score_breakdown.test_rate ?? testRate}
            label="テスト正答率"
            weight="20%"
          />
          <ScoreRing
            score={result.score_breakdown.completeness}
            label="網羅性"
            weight="30%"
          />
          <ScoreRing
            score={result.score_breakdown.accuracy}
            label="正確性"
            weight="25%"
          />
          <ScoreRing
            score={result.score_breakdown.clarity}
            label="わかりやすさ"
            weight="25%"
          />
        </div>
      </div>

      {/* 教えた範囲の判定（網羅性の内訳） */}
      {result.topicCoverage && result.topicCoverage.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-1"><AppIcon name="books" /> 教えた範囲の判定</h3>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            網羅性スコアはここから計算されています。教わっていないトピックの問題を、ソウタは推測でしか解けません。
          </p>
          <div className="space-y-2">
            {result.topicCoverage.map((t) => (
              <div
                key={t.topicIndex}
                className={cn(
                  "rounded-xl px-3 py-2.5 border",
                  t.covered
                    ? "bg-green-50 border-green-100"
                    : t.status === "partial"
                    ? "bg-amber-50 border-amber-200"
                    : "bg-gray-50 border-gray-200"
                )}
              >
                <div className="flex items-start gap-2">
                  <AppIcon name={t.covered ? "success" : t.status === "partial" ? "warning" : "empty"} />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        t.covered ? "text-green-900" : "text-gray-500"
                      )}
                    >
                      {t.topic}
                    </p>
                    {t.covered && t.evidence && (
                      <p className="text-xs text-green-700/80 mt-1 leading-relaxed">
                        あなたの説明：「
                        {t.evidence.length > 60
                          ? `${t.evidence.slice(0, 60)}…`
                          : t.evidence}
                        」
                      </p>
                    )}
                    {!t.covered && <p className="text-xs text-gray-600 mt-1">
                      {t.status === "partial"
                        ? `説明はありますが、まだ不足しています${t.gap ? `：${t.gap}` : "。判断基準を補ってください。"}`
                        : `説明がないか、誤りがあります${t.gap ? `：${t.gap}` : "。もう一度説明してください。"}`}
                    </p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AIのフィードバック */}
      <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-5">
        <div className="flex items-start gap-3">
          <SotaAvatar />
          <div>
            <h3 className="font-bold text-indigo-800 mb-2">ソウタからのフィードバック</h3>
            <p className="text-indigo-700 text-sm leading-relaxed whitespace-pre-wrap">
              {result.feedback}
            </p>
          </div>
        </div>
      </div>

      {/* “あえて間違える”演出の事後開示 */}
      {forceStumbleUsed && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
          <div className="flex items-start gap-3">
            <AppIcon name="smile" size={28} />
            <div>
              <h3 className="font-bold text-amber-800 mb-1">ネタばらし</h3>
              <p className="text-amber-700 text-sm leading-relaxed">
                実は最後の練習問題で、ソウタはあなたの理解を深めるために
                <strong>わざと間違えました</strong>
                。あなたの説明がとても分かりやすく、全問正解しそうだったからこその仕掛けです。
                「なぜ間違えたのか」を考え、ソウタに訂正してあげる経験が、
                あなた自身の理解をさらに強くします。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 学習診断（次の改善ポイント） */}
      {result.learningDiagnosis &&
        (result.learningDiagnosis.strongPoints.length > 0 ||
          result.learningDiagnosis.weakPoints.length > 0 ||
          result.learningDiagnosis.suggestion) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-4"><AppIcon name="checklist" /> 教え方の診断</h3>
            <div className="space-y-4">
              {result.learningDiagnosis.strongPoints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-green-700 mb-1.5">
                    <AppIcon name="success" /> うまく教えられた点
                  </p>
                  <ul className="space-y-1">
                    {result.learningDiagnosis.strongPoints.map((p, i) => (
                      <li
                        key={i}
                        className="text-sm text-gray-700 bg-green-50 rounded-lg px-3 py-1.5"
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.learningDiagnosis.weakPoints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-orange-700 mb-1.5">
                    <AppIcon name="warning" /> もう一歩だった点
                  </p>
                  <ul className="space-y-1">
                    {result.learningDiagnosis.weakPoints.map((p, i) => (
                      <li
                        key={i}
                        className="text-sm text-gray-700 bg-orange-50 rounded-lg px-3 py-1.5"
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.learningDiagnosis.suggestion && (
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-indigo-700 mb-1">
                    <AppIcon name="idea" /> 次に試すといいこと
                  </p>
                  <p className="text-sm text-indigo-800 leading-relaxed">
                    {result.learningDiagnosis.suggestion}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      {/* 問題ごとの回答と思考過程 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4"><AppIcon name="brain" /> ソウタの回答と思考過程</h3>
        <div className="space-y-4">
          {result.answers.map((a, i) => {
            const q = unit.testQuestions.find((question) => question.id === a.question_id);
            const correctText = q?.choices.find(
              (c) => c.label === q.answerLabel
            )?.text;
            const chosenText = q?.choices.find(
              (c) => c.label === a.chosenLabel
            )?.text;
            return (
              <div
                key={a.question_id}
                className={cn(
                  "p-4 rounded-xl border-l-4",
                  a.is_correct
                    ? "border-green-400 bg-green-50"
                    : "border-red-400 bg-red-50"
                )}
              >
                <p className="text-sm font-medium text-gray-700 mb-1">
                  問{i + 1}: {q?.sentence ?? `問題ID ${a.question_id}`}
                </p>
                {q && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3" aria-label={`問${i + 1}の選択肢`}>
                    {q.choices.map((choice) => {
                      const chosen = choice.label === a.chosenLabel;
                      const correct = choice.label === q.answerLabel;
                      return (
                        <div key={choice.label} className={cn(
                          "rounded-lg border px-3 py-2 text-xs leading-relaxed",
                          chosen ? "border-indigo-400 bg-indigo-50 text-indigo-900" :
                          correct ? "border-green-300 bg-green-50 text-green-900" :
                          "border-gray-200 bg-white text-gray-700",
                        )}>
                          <span className="font-bold">{choice.label}. {choice.text}</span>
                          {chosen && <span className="ml-2 font-bold"><AppIcon name="back" /> ソウタが選択</span>}
                          {correct && <span className="ml-2 font-bold"><AppIcon name="check" /> 正解</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-bold",
                      a.is_correct
                        ? "bg-green-200 text-green-800"
                        : "bg-red-200 text-red-800"
                    )}
                  >
                    ソウタの答え: {a.chosenLabel}
                    {chosenText ? `. ${chosenText}` : ""}
                  </span>
                  {!a.is_correct && correctText && (
                    <span className="text-xs text-gray-500">
                      正解: {q.answerLabel}. {correctText}
                    </span>
                  )}
                  <AppIcon name={a.is_correct ? "success" : "error"} size={21} />
                  {a.taught === false && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-200 text-gray-600">
                      <AppIcon name="lock" /> 未習で誤答
                      {a.missingTopics?.length
                        ? `：「${a.missingTopics.join("」「")}」が不足`
                        : ""}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 bg-white/70 rounded-lg p-2 leading-relaxed">
                  <AppIcon name="brain" /> {a.thinking}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 再挑戦ボタン */}
      <button
        onClick={onRetry}
        className="w-full py-4 px-6 bg-indigo-600 text-white font-bold rounded-xl
          hover:bg-indigo-700 transition-colors duration-200
          flex items-center justify-center gap-2 text-lg"
      >
        <AppIcon name="refresh" /> 教え方を改善して再挑戦
      </button>
    </div>
  );
}
