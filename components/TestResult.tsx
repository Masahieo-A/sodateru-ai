"use client";

import { GrammarUnit, TestResult as TR } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  result: TR;
  unit: GrammarUnit;
  onRetry: () => void;
  /** 練習中に“あえて1問間違える”演出が発動した場合 true（事後開示する） */
  forceStumbleUsed?: boolean;
};

function ScoreRing({
  score,
  label,
  weight,
}: {
  score: number;
  label: string;
  /** 教え方スコアに占める重み（例: "40%"） */
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
      {/* スコアヘッダー */}
      <div
        className={cn(
          "rounded-2xl p-6 bg-gradient-to-r text-white text-center shadow-lg",
          scoreColor
        )}
      >
        <div className="text-sm font-medium opacity-90 mb-1">教え方スコア</div>
        <div className="text-6xl font-black mb-2">{result.teaching_score}</div>
        <div className="text-sm opacity-90">/ 100点</div>
        <div className="mt-3 text-sm bg-white/20 rounded-lg px-3 py-1 inline-block">
          AIのテスト正答率: {result.ai_correct_count}/{result.total_questions}問 （
          {testRate}%）
        </div>
      </div>

      {/* スコア詳細（重みは lib/gemini.ts の SCORE_WEIGHTS と一致させること） */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-1">📊 スコア内訳</h3>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          教え方スコア ＝ テスト正答率×40％ ＋ 網羅性×30％ ＋ 正確性×20％ ＋
          わかりやすさ×10％
        </p>
        <div className="grid grid-cols-4 gap-3 text-center">
          <ScoreRing
            score={result.score_breakdown.test_rate ?? testRate}
            label="テスト正答率"
            weight="40%"
          />
          <ScoreRing
            score={result.score_breakdown.completeness}
            label="網羅性"
            weight="30%"
          />
          <ScoreRing
            score={result.score_breakdown.accuracy}
            label="正確性"
            weight="20%"
          />
          <ScoreRing
            score={result.score_breakdown.clarity}
            label="わかりやすさ"
            weight="10%"
          />
        </div>
      </div>

      {/* 教えた範囲の判定（網羅性の内訳） */}
      {result.topicCoverage && result.topicCoverage.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-1">📚 教えた範囲の判定</h3>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            網羅性スコアはここから計算されています。教わっていないトピックの問題を、AIは推測でしか解けません。
          </p>
          <div className="space-y-2">
            {result.topicCoverage.map((t) => (
              <div
                key={t.topicIndex}
                className={cn(
                  "rounded-xl px-3 py-2.5 border",
                  t.covered
                    ? "bg-green-50 border-green-100"
                    : "bg-gray-50 border-gray-200"
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0">{t.covered ? "✅" : "⬜"}</span>
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
                    {!t.covered && (
                      <p className="text-xs text-gray-400 mt-1">
                        まだ教わっていない → 次はここを教えるとスコアが上がる！
                      </p>
                    )}
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
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="font-bold text-indigo-800 mb-2">AIからのフィードバック</h3>
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
            <span className="text-2xl">🎭</span>
            <div>
              <h3 className="font-bold text-amber-800 mb-1">ネタばらし</h3>
              <p className="text-amber-700 text-sm leading-relaxed">
                実は最後の練習問題で、AIはあなたの理解を深めるために
                <strong>わざと間違えました</strong>
                。あなたの説明がとても分かりやすく、全問正解しそうだったからこその仕掛けです。
                「なぜ間違えたのか」を考え、AIに訂正してあげる経験が、
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
            <h3 className="font-bold text-gray-800 mb-4">🩺 学習診断</h3>
            <div className="space-y-4">
              {result.learningDiagnosis.strongPoints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-green-700 mb-1.5">
                    ✅ うまく教えられた点
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
                    ⚠️ もう一歩だった点
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
                    💡 次に試すといいこと
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
        <h3 className="font-bold text-gray-800 mb-4">🧠 AIの回答と思考過程</h3>
        <div className="space-y-4">
          {result.answers.map((a, i) => {
            const q = unit.testQuestions[i];
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
                  問{i + 1}: {q?.sentence}
                </p>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-bold",
                      a.is_correct
                        ? "bg-green-200 text-green-800"
                        : "bg-red-200 text-red-800"
                    )}
                  >
                    AIの答え: {a.chosenLabel}
                    {chosenText ? `. ${chosenText}` : ""}
                  </span>
                  {!a.is_correct && correctText && (
                    <span className="text-xs text-gray-500">
                      正解: {q.answerLabel}. {correctText}
                    </span>
                  )}
                  <span className="text-lg">{a.is_correct ? "✅" : "❌"}</span>
                  {a.taught === false && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-200 text-gray-600">
                      🔒 未習で誤答
                      {a.missingTopics?.length
                        ? `：「${a.missingTopics.join("」「")}」が不足`
                        : ""}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 bg-white/70 rounded-lg p-2 leading-relaxed">
                  💭 {a.thinking}
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
        🔄 教え方を改善して再挑戦
      </button>
    </div>
  );
}
