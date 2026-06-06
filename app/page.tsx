"use client";

import { useState } from "react";
import { UnitSelector } from "@/components/UnitSelector";
import { TeachingInput } from "@/components/TeachingInput";
import { ResultDisplay } from "@/components/ResultDisplay";
import { SolvingDisplay } from "@/components/SolvingDisplay";
import { getUnitById } from "@/lib/questions";
import { TeachResult } from "@/types";

type Step = "select" | "teach" | "loading" | "solving" | "result";

export default function Home() {
  const [step, setStep] = useState<Step>("select");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [result, setResult] = useState<TeachResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);

  const selectedUnit = selectedUnitId ? getUnitById(selectedUnitId) : null;

  const handleUnitSelect = (id: string) => {
    setSelectedUnitId(id);
    setStep("teach");
    setResult(null);
    setError(null);
    setAttemptCount(0);
    setBestScore(null);
    setExplanation("");
  };

  const handleTeachSubmit = async (text: string) => {
    if (!selectedUnitId) return;
    setExplanation(text);
    setStep("loading");
    setError(null);

    try {
      const res = await fetch("/api/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit_id: selectedUnitId, explanation: text }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "不明なエラー");
      }

      const data: TeachResult = await res.json();
      setResult(data);
      setAttemptCount((c) => c + 1);
      if (bestScore === null || data.teaching_score > bestScore) {
        setBestScore(data.teaching_score);
      }
      // loading → solving（AIがリアルタイムで解く画面へ）
      setStep("solving");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setStep("teach");
    }
  };

  const handleRetry = () => {
    setStep("teach");
    setError(null);
  };

  const handleBackToSelect = () => {
    setStep("select");
    setSelectedUnitId(null);
    setResult(null);
    setError(null);
    setAttemptCount(0);
    setBestScore(null);
    setExplanation("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* ヘッダー */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBackToSelect}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <span className="text-2xl">🌱</span>
            <span className="font-black text-indigo-700 text-lg">育てるAI</span>
          </button>

          {selectedUnit && (
            <div className="flex items-center gap-3">
              {bestScore !== null && (
                <span className="text-xs text-gray-500">
                  最高: <span className="font-bold text-indigo-600">{bestScore}点</span>
                </span>
              )}
              <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full">
                {selectedUnit.name}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* 単元選択 */}
        {step === "select" && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div className="text-6xl mb-4">🌱</div>
              <h1 className="text-3xl font-black text-gray-900 mb-3">
                育てるAI
              </h1>
              <p className="text-gray-600 leading-relaxed">
                AIに英文法を<span className="font-bold text-indigo-600">教えて</span>みよう。
                <br />
                あなたの説明の質がAIの正答率を決める。
              </p>
            </div>

            {/* 授業モードへの入口 */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href="/join"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors text-center"
              >
                <span className="text-2xl">🎓</span>
                <span>授業に参加する</span>
                <span className="text-xs font-normal opacity-80">参加コードを入力</span>
              </a>
              <a
                href="/teacher"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border-2 border-indigo-200 text-indigo-700 font-bold hover:border-indigo-400 transition-colors text-center"
              >
                <span className="text-2xl">👩‍🏫</span>
                <span>教員用ページ</span>
                <span className="text-xs font-normal opacity-60">セッション管理</span>
              </a>
            </div>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 whitespace-nowrap">または個人で練習</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <UnitSelector
              selectedId={selectedUnitId}
              onSelect={handleUnitSelect}
            />
          </div>
        )}

        {/* 教える画面 */}
        {(step === "teach" || step === "loading") && selectedUnit && (
          <div className="space-y-4">
            <button
              onClick={handleBackToSelect}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← 単元を選び直す
            </button>

            {attemptCount > 0 && result && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                <span className="font-bold">前回のスコア: {result.teaching_score}点</span>
                　説明を改善してもう一度挑戦しましょう！
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                ⚠️ {error}
              </div>
            )}

            <TeachingInput
              unit={selectedUnit}
              onSubmit={handleTeachSubmit}
              isLoading={step === "loading"}
              initialValue={explanation}
            />
          </div>
        )}

        {/* AIリアルタイム解答画面 */}
        {step === "solving" && result && selectedUnit && (
          <div className="space-y-4">
            <SolvingDisplay
              result={result}
              unit={selectedUnit}
              onDone={() => setStep("result")}
            />
          </div>
        )}

        {/* 結果画面 */}
        {step === "result" && result && selectedUnit && (
          <div className="space-y-4">
            <button
              onClick={handleBackToSelect}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← 単元を選び直す
            </button>

            <ResultDisplay
              result={result}
              unit={selectedUnit}
              explanation={explanation}
              onRetry={handleRetry}
              attemptCount={attemptCount}
            />
          </div>
        )}
      </main>
    </div>
  );
}
