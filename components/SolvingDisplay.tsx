"use client";

import { useEffect, useState } from "react";
import type { TestResult, GrammarUnit } from "@/types";

type Props = {
  result: TestResult;
  unit: GrammarUnit;
  onDone: () => void;
};

/** 問題1問あたり「考え中」を見せる時間 (ms) */
const THINK_DELAY = 450;
/** 答え表示から次の問題へ進むまでの時間 (ms) */
const NEXT_DELAY = 200;

/** テスト：AIが testQuestions を1問ずつ解いていくアニメーション */
export function SolvingDisplay({ result, unit, onDone }: Props) {
  const total = result.answers.length;

  const [currentQ, setCurrentQ] = useState(0);
  const [answeredSet, setAnsweredSet] = useState<Set<number>>(new Set());

  const allDone = currentQ >= total;

  useEffect(() => {
    if (currentQ >= total) return;

    let t2: ReturnType<typeof setTimeout>;
    const t1 = setTimeout(() => {
      setAnsweredSet((prev) => new Set([...prev, currentQ]));
      t2 = setTimeout(() => {
        setCurrentQ((prev) => prev + 1);
      }, NEXT_DELAY);
    }, THINK_DELAY);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [currentQ, total]);

  const correctCount = result.answers.filter((a) => a.is_correct).length;

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{allDone ? "🎯" : "🤖"}</span>
          <div>
            <h2 className="font-bold text-indigo-800 text-base">
              {allDone ? "AIがテストを解き終わりました！" : "AIがテストを解いています..."}
            </h2>
            <p className="text-sm text-indigo-500 mt-0.5">
              {allDone
                ? `正答数: ${correctCount} / ${total} 問`
                : "あなたが教えた内容だけを頼りに考えています"}
            </p>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="bg-indigo-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(Math.min(currentQ, total) / total) * 100}%` }}
          />
        </div>
        <p className="text-xs text-indigo-400 mt-1.5 text-right">
          {Math.min(currentQ, total)} / {total} 問完了
        </p>
      </div>

      {/* 問題リスト */}
      <div className="space-y-3">
        {result.answers.map((a, i) => {
          const q = unit.testQuestions[i];
          const isVisible = i <= currentQ;
          const hasAnswer = answeredSet.has(i);
          const isCurrent = i === currentQ && !hasAnswer;

          if (!isVisible) return null;

          const correctText = q?.choices.find(
            (c) => c.label === q.answerLabel
          )?.text;
          const chosenText = q?.choices.find(
            (c) => c.label === a.chosenLabel
          )?.text;

          return (
            <div
              key={a.question_id}
              className={`bg-white rounded-xl border p-4 transition-all duration-300 ${
                hasAnswer
                  ? a.is_correct
                    ? "border-green-300 shadow-sm"
                    : "border-red-300 shadow-sm"
                  : "border-indigo-200"
              }`}
            >
              <p className="text-sm font-medium text-gray-800 mb-2 leading-relaxed">
                <span className="text-indigo-600 font-bold mr-1">問{i + 1}</span>
                {q?.sentence}
              </p>

              {isCurrent ? (
                <div className="flex items-center gap-2 py-1">
                  <span className="text-indigo-400 animate-pulse text-base">💭</span>
                  <span className="text-indigo-400 text-sm font-medium animate-pulse">
                    考え中...
                  </span>
                  <span className="flex gap-0.5 items-end">
                    <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              ) : hasAnswer ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5 leading-relaxed">
                    💭 {a.thinking}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        a.is_correct
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      AIの答え：{a.chosenLabel}
                      {chosenText ? `. ${chosenText}` : ""}
                    </span>
                    <span className="text-base">{a.is_correct ? "✅" : "❌"}</span>
                    {a.taught === false && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-200 text-gray-600">
                        🔒 未習のため推測
                      </span>
                    )}
                    {!a.is_correct && correctText && (
                      <span className="text-xs text-gray-400">
                        正解：
                        <span className="font-bold text-gray-600">
                          {q.answerLabel}. {correctText}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {allDone && (
        <button
          onClick={onDone}
          className="w-full py-4 px-6 bg-indigo-600 text-white font-bold rounded-xl
            hover:bg-indigo-700 active:scale-95 transition-all duration-200
            flex items-center justify-center gap-2 text-base shadow-md"
        >
          📊 スコアと詳細を見る →
        </button>
      )}
    </div>
  );
}
