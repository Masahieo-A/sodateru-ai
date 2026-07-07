"use client";

import { useState } from "react";
import type { GrammarUnit, LessonMessage, TeachingHint } from "@/types";

type Props = {
  unit: GrammarUnit;
  dialogue: LessonMessage[];
  /** いま取り組んでいる練習問題ID（あれば） */
  questionId?: number;
};

/**
 * 「教える際のヒントを見る」ボタン。
 * 押すと文法マスター（教師AI）が "教え方" のヒントを返す。
 */
export function TeacherHintPanel({ unit, dialogue, questionId }: Props) {
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHint = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lesson/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_id: unit.id,
          dialogue,
          question_id: questionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ヒントの取得に失敗しました");
      setHint((data as TeachingHint).hint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 overflow-hidden">
      <button
        type="button"
        onClick={fetchHint}
        disabled={loading}
        className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors text-left disabled:opacity-60"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🧑‍🎓</span>
          <span className="text-sm font-bold text-amber-700">
            教える際のヒントを見る
          </span>
          <span className="text-xs text-amber-400 font-normal">（文法マスターが助言）</span>
        </div>
        <span className="text-amber-500 text-xs font-medium">
          {loading ? "考え中..." : hint ? "🔄 もう一度" : "▶ 見る"}
        </span>
      </button>

      {error && !loading && (
        <div className="bg-white px-4 py-3 space-y-2">
          <p className="text-sm text-red-600">⚠️ {error}</p>
          <button
            onClick={fetchHint}
            className="w-full py-2 px-4 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors text-sm"
          >
            🔄 もう一度
          </button>
        </div>
      )}

      {hint && !loading && (
        <div className="bg-white px-4 py-4">
          <div className="flex items-start gap-2">
            <span className="text-2xl flex-shrink-0">🧙</span>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <p className="text-xs font-bold text-amber-600 mb-1">文法マスターより</p>
              <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">
                {hint}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
