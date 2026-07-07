"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorRetry } from "@/components/ErrorRetry";
import type { GrammarUnit, LessonMessage, LearningSummary as LS } from "@/types";

type Props = {
  unit: GrammarUnit;
  dialogue: LessonMessage[];
  /** 授業モードの生徒ID。渡すと対話ログ・サマリーをサーバー保存する */
  studentId?: string | null;
  /** 「テストを受けてもらう」 */
  onStartTest: () => void;
  /** 練習に戻る */
  onBack: () => void;
  /** 冪等化キーの接頭辞（レッスン実行ごとに一意） */
  attemptScope?: string;
};

/**
 * 「生徒の学習内容を把握する」画面。
 * AIが何を教わり、何を理解したかをまとめて表示する。
 */
export function LearningSummary({
  unit,
  dialogue,
  studentId,
  onStartTest,
  onBack,
  attemptScope,
}: Props) {
  const [summary, setSummary] = useState<LS | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 冪等化キー：対話内容が同じなら同じキーになり、再試行・再訪問で二重生成しない
  const attemptIdRef = useRef<string>(
    attemptScope ? `${attemptScope}:summary:d${dialogue.length}` : crypto.randomUUID()
  );
  const cancelledRef = useRef(false);

  // 注意: マウント時の effect から呼ぶため、await より前に setState しない
  // （初期 state が loading=true / error=null なので初回はそのままでよい）
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/lesson/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_id: unit.id,
          dialogue,
          student_id: studentId ?? undefined,
          attempt_id: attemptIdRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "まとめの取得に失敗しました");
      if (!cancelledRef.current) setSummary(data as LS);
    } catch (err) {
      if (!cancelledRef.current)
        setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    fetchSummary();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-8 text-center">
        <div className="text-4xl mb-3 animate-bounce">🤖</div>
        <p className="text-indigo-600 font-bold">
          AIが学んだことを振り返っています...
        </p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-4">
        <ErrorRetry
          message={error ?? "まとめを取得できませんでした"}
          onRetry={() => {
            setLoading(true);
            setError(null);
            fetchSummary();
          }}
          note="再試行しても、教えた内容は消えません。"
        />
        <button
          onClick={onBack}
          className="w-full py-3 px-6 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
        >
          ← 練習に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-6 text-white text-center shadow-lg">
        <div className="text-4xl mb-2">📖</div>
        <h2 className="text-xl font-black mb-1">AIの学習内容</h2>
        <p className="text-indigo-100 text-sm">
          あなたの教えで、AIはここまで成長しました
        </p>
      </div>

      {/* 総括 */}
      <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🤖</span>
          <p className="text-indigo-800 text-sm leading-relaxed whitespace-pre-wrap">
            {summary.summary}
          </p>
        </div>
      </div>

      {/* 教わったこと */}
      {summary.taught.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-3">📝 教わったこと</h3>
          <ul className="space-y-2">
            {summary.taught.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 text-indigo-400 flex-shrink-0">▸</span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 理解できたこと */}
      {summary.learned.length > 0 && (
        <div className="bg-green-50 rounded-2xl border border-green-100 p-5">
          <h3 className="font-bold text-green-800 mb-3">✅ 理解できたこと</h3>
          <ul className="space-y-2">
            {summary.learned.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                <span className="mt-0.5 flex-shrink-0">✓</span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* まだ不足していること */}
      {summary.gaps.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
          <h3 className="font-bold text-amber-800 mb-3">
            ⚠️ まだあいまい・不足していること
          </h3>
          <ul className="space-y-2">
            {summary.gaps.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                <span className="mt-0.5 flex-shrink-0">•</span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 pt-1">
        <button
          onClick={onStartTest}
          className="w-full py-4 px-6 bg-indigo-600 text-white font-bold rounded-xl
            hover:bg-indigo-700 active:scale-95 transition-all duration-200
            flex items-center justify-center gap-2 text-base shadow-md"
        >
          📝 テストを受けてもらう →
        </button>
        <button
          onClick={onBack}
          className="w-full py-2.5 px-6 text-gray-500 font-medium rounded-xl hover:bg-gray-100 transition-colors text-sm"
        >
          ← もう少し教える（練習に戻る）
        </button>
      </div>
    </div>
  );
}
