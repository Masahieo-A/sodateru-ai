"use client";

import { useEffect, useRef, useState } from "react";
import type { GrammarUnit, MCQuestion, LessonMessage, PracticeTurn } from "@/types";

type Bubble =
  | { kind: "student"; content: string; chosenLabel?: string; isCorrect?: boolean }
  | { kind: "teacher"; content: string };

type Props = {
  unit: GrammarUnit;
  question: MCQuestion;
  questionIndex: number; // 0-based
  totalQuestions: number;
  /** これまでのレッスン全体の対話（この問題開始時点まで） */
  dialogue: LessonMessage[];
  /** 親のレッスン対話へ1メッセージ追記 */
  onAppend: (m: LessonMessage) => void;
  /** 次の問題へ（最終問題なら学習まとめへ） */
  onNext: () => void;
  isLast: boolean;
  /**
   * プログラムが「このままだと全問正解」と判断した場合に true。
   * 初回回答であえて“もっともらしい誤解”をさせ、メタ認知のきっかけを作る。
   */
  forceStumble?: boolean;
  /** 初回回答の正誤を親へ通知（全問正解判定の集計に使う） */
  onFirstAnswer?: (isCorrect: boolean) => void;
  /** “あえて間違える”演出が実際に発動したことを親へ通知（事後開示に使う） */
  onStumble?: () => void;
};

export function PracticeChat({
  unit,
  question,
  questionIndex,
  totalQuestions,
  dialogue,
  onAppend,
  onNext,
  isLast,
  forceStumble = false,
  onFirstAnswer,
  onStumble,
}: Props) {
  // この問題で表示する吹き出し（この問題開始以降のやりとり）
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [satisfied, setSatisfied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  // API送信用の「最新の対話全文」を ref で保持（state の非同期性を回避）
  const convoRef = useRef<LessonMessage[]>(dialogue);
  // 初回ターンを一度だけ起動するためのガード
  const startedRef = useRef(false);
  // この問題で先生が追加で教えた回数（安全弁：2回以上で必ず次へ進める）
  const teacherRepliesRef = useRef(0);

  const runTurn = async (isFollowup: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lesson/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_id: unit.id,
          question_id: question.id,
          dialogue: convoRef.current,
          is_followup: isFollowup,
          exchange_count: teacherRepliesRef.current,
          // 初回ターンのみ forceStumble を送る（あえて1問間違えさせる）
          force_stumble: !isFollowup && forceStumble,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AIの応答に失敗しました");

      const turn = data as PracticeTurn;
      const studentMsg: LessonMessage = { role: "student", content: turn.message };
      convoRef.current = [...convoRef.current, studentMsg];
      onAppend(studentMsg);

      setBubbles((b) => [
        ...b,
        {
          kind: "student",
          content: turn.message,
          chosenLabel: turn.chosenLabel,
          isCorrect: turn.isCorrect,
        },
      ]);
      // 初回回答の正誤を親に通知（全問正解しそうかの集計に使う）
      if (!isFollowup) onFirstAnswer?.(!!turn.isCorrect);
      // “あえて間違える”演出が発動した初回ターンを親へ通知（事後開示用）
      if (!isFollowup && forceStumble) onStumble?.();
      // 安全弁：2回以上教えたら、AIの応答に関わらず次へ進めるようにする
      // （同じ質問の繰り返しで生徒が足止めされ、意欲を失うのを防ぐ）
      setSatisfied(!!turn.satisfied || teacherRepliesRef.current >= 2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 問題が変わったら初回ターンを起動
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    convoRef.current = dialogue;
    runTurn(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    const text = reply.trim();
    if (!text || loading) return;
    const teacherMsg: LessonMessage = { role: "teacher", content: text };
    convoRef.current = [...convoRef.current, teacherMsg];
    onAppend(teacherMsg);
    teacherRepliesRef.current += 1;
    setBubbles((b) => [...b, { kind: "teacher", content: text }]);
    setReply("");
    setSatisfied(false);
    await runTurn(true);
  };

  return (
    <div className="space-y-4">
      {/* 進捗 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-indigo-600">
          練習問題 {questionIndex + 1} / {totalQuestions}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${
                i < questionIndex
                  ? "bg-indigo-500"
                  : i === questionIndex
                  ? "bg-indigo-300"
                  : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 問題カード */}
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
        <p className="text-sm font-medium text-gray-800 mb-3 leading-relaxed">
          {question.sentence}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {question.choices.map((c) => {
            // AIが最後に選んだラベル
            const lastStudent = [...bubbles]
              .reverse()
              .find((b) => b.kind === "student") as
              | Extract<Bubble, { kind: "student" }>
              | undefined;
            const chosen = lastStudent?.chosenLabel === c.label;
            return (
              <div
                key={c.label}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                  chosen
                    ? lastStudent?.isCorrect
                      ? "border-green-400 bg-green-50 text-green-800"
                      : "border-red-400 bg-red-50 text-red-800"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                <span className="font-bold">{c.label}.</span>
                <span>{c.text}</span>
                {chosen && (
                  <span className="ml-auto">
                    {lastStudent?.isCorrect ? "✅" : "❌"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 対話 */}
      <div className="space-y-3">
        {bubbles.map((b, i) =>
          b.kind === "student" ? (
            <div key={i} className="flex items-start gap-2">
              <span className="text-2xl flex-shrink-0">🤖</span>
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">
                  {b.content}
                </p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2 justify-end">
              <div className="bg-gray-800 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{b.content}</p>
              </div>
              <span className="text-2xl flex-shrink-0">🧑‍🏫</span>
            </div>
          )
        )}

        {loading && (
          <div className="flex items-start gap-2">
            <span className="text-2xl flex-shrink-0">🤖</span>
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <span className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* 入力 or 次へ */}
      {!loading && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-200 p-3">
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              💬 AIにさらに教える・質問に答える
            </label>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="AIのつぶやきや質問に答えて、もっと深く教えてあげましょう。"
              rows={3}
              className="w-full p-2 text-sm text-gray-800 focus:outline-none resize-none leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={reply.trim().length === 0}
              className="w-full mt-1 py-2.5 px-4 bg-indigo-600 text-white font-bold rounded-xl
                hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
            >
              ✏️ 追加で教える
            </button>
          </div>

          <button
            onClick={onNext}
            className={`w-full py-3.5 px-6 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              satisfied
                ? "bg-green-500 text-white hover:bg-green-600 shadow-md"
                : "bg-indigo-50 border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
            }`}
          >
            {satisfied ? "✅ " : ""}
            {isLast ? "学習内容を確認する →" : "次の練習問題へ →"}
          </button>
          <p className="text-center text-xs font-medium text-gray-400">
            {satisfied
              ? "AIはこの問題を十分に理解できたようです！"
              : "いつでも次に進めます。納得いくまで教えてもOK。"}
          </p>
        </div>
      )}
    </div>
  );
}
