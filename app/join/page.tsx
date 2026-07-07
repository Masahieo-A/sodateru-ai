"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { saveParticipant } from "@/lib/participant";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 「別の名前で参加し直す」等の導線から ?code=XXXXXX で戻ってきたときにコードを事前入力
  const [code, setCode] = useState(() =>
    (searchParams.get("code") ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6)
  );
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length <= 6) {
      setCode(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError("参加コードは6文字で入力してください");
      return;
    }
    if (!name.trim()) {
      setError("ニックネームを入力してください");
      return;
    }

    setIsLoading(true);
    try {
      // 常にサーバで参加者を作成/取得する（キャッシュ読み出しで join をスキップしない）。
      // 同名なら既存参加者として復帰、別名なら新規参加者（P2-6）。
      const res = await fetch(`/api/sessions/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "参加に失敗しました");
      }

      const { student, session } = data;

      // セッションコード単位のキーに、サーバのレスポンスで上書き保存
      saveParticipant(session.code, {
        studentId: student.id,
        studentName: student.name,
        sessionId: session.id,
      });

      router.push(`/session/${session.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      {/* ヘッダー */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            <span className="font-black text-indigo-700 text-lg">育てるAI</span>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition flex items-center gap-1"
          >
            ← トップへ
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* タイトルエリア */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎓</div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">
              授業に参加する
            </h1>
            <p className="text-gray-500 text-sm">
              先生から受け取ったコードとニックネームを入力してください
            </p>
          </div>

          {/* フォームカード */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 参加コード */}
              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-bold text-gray-700 mb-2"
                >
                  参加コード
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="XXXXXX"
                  maxLength={6}
                  disabled={isLoading}
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center
                    text-2xl font-black tracking-widest text-indigo-700
                    focus:outline-none focus:border-indigo-400 transition-colors
                    disabled:bg-gray-50 disabled:text-gray-400 uppercase placeholder:text-gray-300"
                />
                <p className="text-xs text-gray-400 mt-1 text-center">
                  {code.length} / 6文字
                </p>
              </div>

              {/* ニックネーム */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-bold text-gray-700 mb-2"
                >
                  ニックネーム
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="あなたの名前"
                  maxLength={20}
                  disabled={isLoading}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                    text-gray-800 text-sm
                    focus:outline-none focus:border-indigo-400 transition-colors
                    disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              {/* エラー表示 */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  ⚠️ {error}
                </div>
              )}

              {/* 参加ボタン */}
              <button
                type="submit"
                disabled={isLoading || code.length !== 6 || !name.trim()}
                className="w-full py-3 px-6 bg-indigo-600 text-white font-bold rounded-xl
                  hover:bg-indigo-700 transition-colors duration-200
                  disabled:bg-gray-300 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2 text-base"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin inline-block">⏳</span>
                    参加中...
                  </>
                ) : (
                  <>
                    🚀 参加する
                  </>
                )}
              </button>
            </form>
          </div>

          {/* フッターリンク */}
          <p className="text-center text-xs text-gray-400 mt-6">
            コードは先生から教えてもらいましょう
          </p>
        </div>
      </main>
    </div>
  );
}

// useSearchParams はプリレンダ時に Suspense 境界が必要
export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinForm />
    </Suspense>
  );
}
