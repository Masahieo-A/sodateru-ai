"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { UNIT_CATALOG } from "@/lib/unit-catalog";
import { Session, Student, SessionStatus, type LessonMessage } from "@/types";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const POLL_INTERVAL_MS = 3000;

type LearnerDetail = {
  participant: {
    id: string;
    name: string;
    email: string | null;
    dialogue: LessonMessage[];
    teaching_summary: string | null;
  };
  attempts: Array<{
    id: string;
    explanation: string;
    teaching_score: number;
    ai_correct_count: number;
    total_questions: number;
    created_at: string;
  }>;
};

function StatusBadge({ status }: { status: SessionStatus }) {
  const config = {
    waiting: { label: "待機中", className: "bg-yellow-100 text-yellow-700" },
    active: { label: "授業中", className: "bg-green-100 text-green-700" },
    ended: { label: "終了", className: "bg-gray-100 text-gray-500" },
  };
  const { label, className } = config[status];
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${className}`}>
      {label}
    </span>
  );
}

export default function SessionManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [authed, setAuthed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [learnerDetail, setLearnerDetail] = useState<LearnerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showAiDialogue, setShowAiDialogue] = useState(false);

  // 認証チェック（httpOnly Cookie の有効性をサーバーに問い合わせる）
  useEffect(() => {
    fetch("/api/teacher")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated) {
          setAuthed(true);
        } else {
          router.replace("/teacher");
        }
      })
      .catch(() => router.replace("/teacher"));
  }, [router]);

  // セッション詳細 + 生徒一覧を取得し、定期的に再取得する。
  // D1 へはブラウザから直接接続せず、認証済みの自サイト API 経由で取得する。
  // ネットワーク（学校のフィルタ等）で "TypeError: Failed to fetch" になるため、
  // 自サイトの API 経由で取得し、Realtime の代わりにポーリングで更新する。
  useEffect(() => {
    if (!id || !authed) return;
    let cancelled = false;

    const load = async (initial: boolean) => {
      if (!initial && document.hidden) return;
      try {
        const res = await fetch(`/api/teacher/sessions/${id}`, { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/teacher");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "セッションの取得に失敗しました");
        if (cancelled) return;
        setSession(data.session as Session);
        setStudents(data.students as Student[]);
        setError(null);
      } catch (err) {
        // 初回のみ画面全体のエラーにする（更新中の一時的な失敗は次回に持ち越す）
        if (initial && !cancelled) {
          setError(err instanceof Error ? err.message : "セッションの取得に失敗しました");
        }
      } finally {
        if (initial && !cancelled) setIsLoading(false);
      }
    };

    load(true);
    const timer = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, authed, router]);

  useEffect(() => {
    if (!id || !selectedStudentId) return;
    const controller = new AbortController();
    fetch(`/api/teacher/sessions/${id}/participants/${selectedStudentId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "学習記録の取得に失敗しました");
        return data as LearnerDetail;
      })
      .then((data) => { if (!controller.signal.aborted) setLearnerDetail(data); })
      .catch((err) => {
        if (!controller.signal.aborted)
          setDetailError(err instanceof Error ? err.message : "学習記録の取得に失敗しました");
      })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [id, selectedStudentId]);

  const handleStart = async () => {
    if (!session) return;
    setIsActioning(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/sessions/${session.code}/start`, {
        method: "POST",
      });
      if (res.status === 401) {
        router.replace("/teacher");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "開始に失敗しました");
      }
      const updated: Session = await res.json();
      setSession(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsActioning(false);
    }
  };

  const handleEnd = async () => {
    if (!session) return;
    setIsActioning(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/sessions/${session.code}/end`, {
        method: "POST",
      });
      if (res.status === 401) {
        router.replace("/teacher");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "終了に失敗しました");
      }
      const updated: Session = await res.json();
      setSession(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsActioning(false);
    }
  };

  const unitName = (id: string) =>
    UNIT_CATALOG.find((unit) => unit.id === id)?.title ?? id;

  if (!authed) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-red-600 text-sm">{error ?? "セッションが見つかりません"}</p>
          <button
            onClick={() => router.push("/teacher/dashboard")}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            ダッシュボードへ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            <span className="font-black text-indigo-700 text-lg">育てるAI</span>
          </div>
          <button
            onClick={() => router.push("/teacher/dashboard")}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition"
          >
            ← ダッシュボードへ戻る
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* セッション情報カード */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* 参加コード（大きく表示） */}
            <div className="text-center bg-indigo-50 rounded-2xl px-8 py-5 shrink-0">
              <p className="text-xs text-indigo-400 font-medium mb-1">参加コード</p>
              <p className="text-4xl font-black text-indigo-700 tracking-widest font-mono">
                {session.code}
              </p>
            </div>

            {/* セッション詳細 */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={session.status} />
                <span className="text-xs text-gray-400">{unitName(session.unit_id)}</span>
              </div>
              <p className="text-xl font-bold text-gray-800">{session.name}</p>
              <p className="text-xs text-gray-400">
                作成: {new Date(session.created_at).toLocaleString("ja-JP")}
              </p>

              {/* アクションボタン */}
              <div className="pt-1">
                {session.status === "waiting" && (
                  <button
                    onClick={handleStart}
                    disabled={isActioning}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold py-2 px-5 rounded-xl transition text-sm"
                  >
                    {isActioning ? "処理中..." : "授業を開始する"}
                  </button>
                )}
                {session.status === "active" && (
                  <button
                    onClick={handleEnd}
                    disabled={isActioning}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-2 px-5 rounded-xl transition text-sm"
                  >
                    {isActioning ? "処理中..." : "授業を終了する"}
                  </button>
                )}
                {session.status === "ended" && (
                  <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 text-sm font-bold px-4 py-2 rounded-xl">
                    終了済み
                  </span>
                )}
              </div>

              {actionError && (
                <p className="text-xs text-red-600 mt-1">{actionError}</p>
              )}
            </div>
          </div>
        </section>

        {/* リアルタイムランキング */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800">リアルタイムランキング</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-xs text-gray-400">自動更新中</span>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              まだ生徒が参加していません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left py-2 pb-3 pr-4 font-medium w-12">順位</th>
                    <th className="text-left py-2 pb-3 pr-4 font-medium">名前</th>
                    <th className="text-right py-2 pb-3 pr-4 font-medium">スコア</th>
                    <th className="text-right py-2 pb-3 font-medium">試行回数</th>
                    <th className="text-right py-2 pb-3 font-medium">振り返り</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.map((student, index) => {
                    const rank = index + 1;
                    const isTop3 = rank <= 3;
                    return (
                      <tr
                        key={student.id}
                        className={`${isTop3 ? "bg-indigo-50/30" : ""} hover:bg-gray-50 transition`}
                      >
                        <td className="py-3 pr-4">
                          <span className={`font-bold ${isTop3 ? "text-lg" : "text-gray-500"}`}>
                            {MEDAL[rank] ?? rank}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`font-medium ${isTop3 ? "text-gray-900" : "text-gray-700"}`}>
                            {student.name}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className={`font-black ${isTop3 ? "text-indigo-700 text-base" : "text-gray-700"}`}>
                            {student.best_score}
                            <span className="text-xs font-normal text-gray-400 ml-0.5">点</span>
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-500">
                          {student.attempt_count}回
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            aria-expanded={selectedStudentId === student.id}
                            onClick={() => {
                              const opening = selectedStudentId !== student.id;
                              setSelectedStudentId(opening ? student.id : null);
                              setLearnerDetail(null);
                              setDetailError(null);
                              setDetailLoading(opening);
                              setShowAiDialogue(false);
                            }}
                            className="text-indigo-700 hover:text-indigo-900 font-bold underline underline-offset-2"
                          >
                            {selectedStudentId === student.id ? "閉じる" : "教えた文章を見る"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedStudentId && (
          <section className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-6" aria-live="polite">
            <h2 className="text-base font-bold text-gray-800 mb-1">
              {students.find((student) => student.id === selectedStudentId)?.name ?? "学習者"}さんの教え方
            </h2>
            <p className="text-xs text-gray-500 mb-5">本人が入力した説明と、AIとのやり取りを授業の振り返りに使えます。</p>
            {detailLoading && <p className="text-sm text-gray-500">学習記録を読み込み中...</p>}
            {detailError && <p role="alert" className="text-sm text-red-700">{detailError}</p>}
            {learnerDetail && !detailLoading && (
              <div className="space-y-6">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="font-bold text-gray-800">入力した説明・返答</h3>
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={showAiDialogue} onChange={(event) => setShowAiDialogue(event.target.checked)} />
                      AIの発言も表示
                    </label>
                  </div>
                  {learnerDetail.participant.dialogue.filter((message) => showAiDialogue || message.role === "teacher").length === 0 ? (
                    <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">まだ保存された対話はありません。学習が進むとここに表示されます。</p>
                  ) : (
                    <ol className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                      {learnerDetail.participant.dialogue
                        .filter((message) => showAiDialogue || message.role === "teacher")
                        .map((message, index) => (
                          <li key={index} className={`rounded-xl border px-4 py-3 ${message.role === "teacher" ? "bg-indigo-50 border-indigo-100" : "bg-gray-50 border-gray-200"}`}>
                            <p className="text-xs font-bold text-gray-500 mb-1">{message.role === "teacher" ? "学習者の説明" : "AIの返答"}</p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{message.content}</p>
                          </li>
                        ))}
                    </ol>
                  )}
                </div>
                {learnerDetail.participant.teaching_summary && (
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2">教えた内容の要約</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-green-50 border border-green-100 rounded-xl p-4 leading-relaxed">
                      {learnerDetail.participant.teaching_summary}
                    </p>
                  </div>
                )}
                {learnerDetail.attempts.length > 0 && (
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2">テスト履歴</h3>
                    <ul className="space-y-2">
                      {learnerDetail.attempts.map((attempt) => (
                        <li key={attempt.id} className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">
                          <span className="font-bold">{attempt.teaching_score}点</span>
                          <span className="ml-2">AI正答 {attempt.ai_correct_count}/{attempt.total_questions}問</span>
                          <span className="ml-2 text-xs text-gray-500">{new Date(attempt.created_at).toLocaleString("ja-JP")}</span>
                          {attempt.explanation && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-bold text-indigo-700">この回に伝えた内容を読む</summary>
                              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-700">{attempt.explanation}</p>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
