"use client";

import { AppIcon } from "@/components/AppIcon";
import { SotaAvatar } from "@/components/SotaAvatar";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorRetry } from "@/components/ErrorRetry";
import type { GrammarUnit, LessonMessage, LearningSummary as LS } from "@/types";

type Props = {
  unit: GrammarUnit;
  dialogue: LessonMessage[];
  /** 授業モードの生徒ID。渡すと対話ログ・サマリーをサーバー保存する */
  studentId: string;
  sessionId: string;
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
  sessionId,
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
          student_id: studentId,
          session_id: sessionId,
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
  }, [dialogue, sessionId, studentId, unit.id]);

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
        <SotaAvatar size={48} className="mb-3 animate-bounce" />
        <p className="text-indigo-600 font-bold">
          ソウタが学んだことを振り返っています...
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
          <AppIcon name="back" /> 練習に戻る
        </button>
      </div>
    );
  }

  const unknownTopicIndices = [...new Set(dialogue.flatMap((message) => message.unknownTopics ?? []))]
    .filter((index) => index >= 0 && index < unit.teachingGuide.coverageTopics.length);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-6 text-white text-center shadow-lg">
        <AppIcon name="book" size={44} className="mb-2" />
        <h2 className="text-xl font-black mb-1">ソウタの学習内容</h2>
        <p className="text-indigo-100 text-sm">
          あなたの教えで、ソウタはここまで成長しました
        </p>
      </div>

      {unknownTopicIndices.length > 0 && <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
        <h3 className="font-bold text-amber-950 mb-1"><AppIcon name="pin" /> あとで復習したいこと</h3>
        <p className="text-xs text-amber-900 mb-3">「分からない」と記録した項目です。分からないまま進んでも大丈夫。後で自分のペースで確かめましょう。</p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-amber-950">
          {unknownTopicIndices.map((index) => <li key={index}>{unit.teachingGuide.coverageTopics[index]}</li>)}
        </ul>
      </div>}

      {/* 総括 */}
      <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-5">
        <div className="flex items-start gap-3">
          <SotaAvatar />
          <p className="text-indigo-800 text-sm leading-relaxed whitespace-pre-wrap">
            {summary.summary}
          </p>
        </div>
      </div>

      {/* 教員が今回の対象に選んだ項目。AI要約とは独立して全件表示する。 */}
      <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5">
        <h3 className="font-bold text-indigo-900 mb-1"><AppIcon name="list" /> 今回教えるべきこと</h3>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          授業で指定された内容です。下の「教わったこと」「理解できたこと」と見比べ、抜けがあれば練習に戻って説明してください。
        </p>
        <ul className="space-y-2">
          {unit.teachingGuide.coverageTopics.map((topic, index) => (
            <li key={unit.teachingGuide.knowledgeTopicIds?.[index] ?? index} className="flex items-start gap-2 text-sm text-gray-800">
              <span className="text-indigo-500 font-bold shrink-0">{index + 1}.</span>
              <span className="leading-relaxed">{topic}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 教わったこと */}
      {summary.taught.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-3"><AppIcon name="note" /> 教わったこと</h3>
          <ul className="space-y-2">
            {summary.taught.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <AppIcon name="next" className="mt-0.5 text-indigo-400" />
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 理解できたこと */}
      {summary.learned.length > 0 && (
        <div className="bg-green-50 rounded-2xl border border-green-100 p-5">
          <h3 className="font-bold text-green-800 mb-3"><AppIcon name="success" /> 理解できたこと</h3>
          <ul className="space-y-2">
            {summary.learned.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                <AppIcon name="check" className="mt-0.5" />
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
            <AppIcon name="warning" /> まだあいまい・不足していること
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
          <AppIcon name="note" /> テストを受けてもらう <AppIcon name="next" />
        </button>
        <button
          onClick={onBack}
          className="w-full py-2.5 px-6 text-gray-500 font-medium rounded-xl hover:bg-gray-100 transition-colors text-sm"
        >
          <AppIcon name="back" /> もう少し教える（練習に戻る）
        </button>
      </div>
    </div>
  );
}
