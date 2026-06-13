"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { GRAMMAR_UNITS } from "@/lib/questions";
import { Session, Student, SessionStatus } from "@/types";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

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

  // セッション取得
  useEffect(() => {
    if (!id) return;

    const fetchSession = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: sbError } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", id)
          .single();
        if (sbError) throw new Error(sbError.message);
        setSession(data as Session);
      } catch (err) {
        setError(err instanceof Error ? err.message : "セッションの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [id]);

  // 生徒一覧初回フェッチ + Realtime購読
  useEffect(() => {
    if (!session) return;

    // 初回フェッチ
    const fetchStudents = async () => {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("session_id", session.id)
        .order("best_score", { ascending: false });
      if (data) setStudents(data as Student[]);
    };
    fetchStudents();

    // Realtime 購読
    const channel = supabase
      .channel(`students:${session.id}:${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "students",
          filter: `session_id=eq.${session.id}`,
        },
        () => {
          // 変更があるたびに再フェッチ
          fetchStudents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

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
    GRAMMAR_UNITS.find((u) => u.id === id)?.name ?? id;

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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
