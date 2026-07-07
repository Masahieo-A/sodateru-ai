"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GRAMMAR_UNITS } from "@/lib/questions";
import { Session, SessionStatus } from "@/types";

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

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  // フォーム
  const [sessionName, setSessionName] = useState("");
  const [unitId, setUnitId] = useState(GRAMMAR_UNITS[0].id);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // セッション一覧
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // セッション一覧取得（認証は Cookie で自動送信される）
  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    setListError(null);
    try {
      const res = await fetch("/api/sessions");
      if (res.status === 401) {
        router.replace("/teacher");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "取得に失敗しました");
      }
      const data: Session[] = await res.json();
      setSessions(data);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // 認証チェック（httpOnly Cookie の有効性をサーバーに問い合わせる）。
  // 認証が確認できたら、そのまま続けてセッション一覧を取得する。
  useEffect(() => {
    fetch("/api/teacher")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated) {
          setAuthed(true);
          fetchSessions();
        } else {
          router.replace("/teacher");
        }
      })
      .catch(() => router.replace("/teacher"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit_id: unitId, name: sessionName.trim() }),
      });
      if (res.status === 401) {
        router.replace("/teacher");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "作成に失敗しました");
      }
      const newSession: Session = await res.json();
      setSessions((prev) => [newSession, ...prev]);
      setSessionName("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/teacher", { method: "DELETE" }).catch(() => {});
    router.push("/teacher");
  };

  if (!authed) return null;

  const unitName = (id: string) =>
    GRAMMAR_UNITS.find((u) => u.id === id)?.name ?? id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            <span className="font-black text-indigo-700 text-lg">育てるAI</span>
            <span className="text-sm text-gray-400 ml-2">教員ダッシュボード</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* セッション作成フォーム */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4">授業セッションを作成</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  授業名
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="例: 1年A組 関係副詞"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                  disabled={isCreating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  単元
                </label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition bg-white"
                  disabled={isCreating}
                >
                  {GRAMMAR_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isCreating || !sessionName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-2.5 px-6 rounded-xl transition text-sm"
              >
                {isCreating ? "作成中..." : "セッションを作成"}
              </button>
            </div>
          </form>
        </section>

        {/* セッション一覧 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800">セッション一覧</h2>
            <button
              onClick={() => fetchSessions()}
              disabled={isLoadingSessions}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition disabled:opacity-50"
            >
              更新
            </button>
          </div>

          {listError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
              {listError}
            </div>
          )}

          {isLoadingSessions ? (
            <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              セッションがありません。上のフォームから作成してください。
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4"
                >
                  {/* 参加コード */}
                  <div className="text-center bg-indigo-50 rounded-xl px-5 py-3 shrink-0">
                    <p className="text-xs text-indigo-400 font-medium mb-0.5">参加コード</p>
                    <p className="text-2xl font-black text-indigo-700 tracking-widest font-mono">
                      {session.code}
                    </p>
                  </div>

                  {/* セッション情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={session.status} />
                      <span className="text-xs text-gray-400 font-mono">
                        {unitName(session.unit_id)}
                      </span>
                    </div>
                    <p className="font-bold text-gray-800 truncate">{session.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      作成: {new Date(session.created_at).toLocaleString("ja-JP")}
                    </p>
                  </div>

                  {/* 管理ボタン */}
                  <button
                    onClick={() => router.push(`/teacher/session/${session.id}`)}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl transition text-sm"
                  >
                    管理
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
