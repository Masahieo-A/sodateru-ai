"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorRetry } from "@/components/ErrorRetry";
import type { GrammarUnit, MCQuestion, LessonMessage, PracticeTurn } from "@/types";

type Bubble =
  | { kind: "student"; content: string; chosenLabel?: string; isCorrect?: boolean }
  | { kind: "teacher"; content: string };

type Props = {
  unit: GrammarUnit;
  participantId: string;
  sessionId: string;
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
  /**
   * 冪等化キーの接頭辞（レッスン実行ごとに一意）。
   * 初回ターンはこのスコープから決定的に生成し、「戻る」で同じターンを二重生成しない。
   */
  attemptScope?: string;
};

export function PracticeChat({
  unit,
  participantId,
  sessionId,
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
  attemptScope,
}: Props) {
  // この問題で表示する吹き出し（この問題開始以降のやりとり）
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [satisfied, setSatisfied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prepaidDepleted, setPrepaidDepleted] = useState(false);

  // API送信用の「最新の対話全文」を ref で保持（state の非同期性を回避）
  const convoRef = useRef<LessonMessage[]>(dialogue);
  // 初回ターンを一度だけ起動するためのガード
  const startedRef = useRef(false);
  // この問題で先生が追加で教えた回数（対話の長さを伝えるため）
  const teacherRepliesRef = useRef(0);
  const questionStartRef = useRef(dialogue.length);
  // 冪等化キー：ターンごとに発行し、エラー時の再試行では同じIDを再送する
  // （サーバがキャッシュを返すため、連打・再試行で二重生成されない）
  const attemptIdRef = useRef<string>(
    attemptScope ? `${attemptScope}:q${question.id}:init` : crypto.randomUUID()
  );
  // 再試行用に直近ターンの種別を保持
  const lastFollowupRef = useRef(false);

  const runTurn = async (isFollowup: boolean) => {
    lastFollowupRef.current = isFollowup;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lesson/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_id: unit.id,
          participant_id: participantId,
          session_id: sessionId,
          question_id: question.id,
          dialogue: convoRef.current,
          question_dialogue: convoRef.current.slice(questionStartRef.current),
          is_followup: isFollowup,
          exchange_count: teacherRepliesRef.current,
          // 初回ターンのみ forceStumble を送る（あえて1問間違えさせる）
          force_stumble: !isFollowup && forceStumble,
          attempt_id: attemptIdRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "PREPAID_CREDITS_DEPLETED") setPrepaidDepleted(true);
        throw new Error(data.error ?? "AIの応答に失敗しました");
      }

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
      setSatisfied(!!turn.satisfied);
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
    if (/^(分からない|わからない|分かりません|わかりません)[。.!！]?$/.test(text)) {
      handleUnknown(text);
      return;
    }
    const teacherMsg: LessonMessage = { role: "teacher", content: text };
    convoRef.current = [...convoRef.current, teacherMsg];
    onAppend(teacherMsg);
    teacherRepliesRef.current += 1;
    setBubbles((b) => [...b, { kind: "teacher", content: text }]);
    setReply("");
    setSatisfied(false);
    // 新しいターンなので冪等化キーを発行し直す（再試行時はこのIDを使い回す）
    attemptIdRef.current = crypto.randomUUID();
    await runTurn(true);
  };

  const handleUnknown = (answer = "分からない（この内容はまだ説明できません）") => {
    if (loading) return;
    const teacherMsg: LessonMessage = {
      role: "teacher",
      content: answer,
      unknownTopics: question.requiredTopics ?? [],
    };
    convoRef.current = [...convoRef.current, teacherMsg];
    onAppend(teacherMsg);
    onNext();
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

      {error && !loading && (
        <ErrorRetry
          message={error}
          onRetry={prepaidDepleted ? undefined : () => runTurn(lastFollowupRef.current)}
          note="再試行しても、これまでの会話は消えません。"
        />
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
              disabled={prepaidDepleted || reply.trim().length === 0}
              className="w-full mt-1 py-2.5 px-4 bg-indigo-600 text-white font-bold rounded-xl
                hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
            >
              ✏️ 追加で教える
            </button>
          </div>

          <button type="button" onClick={() => handleUnknown()} className="w-full py-3 px-4 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-900 font-bold hover:bg-amber-100">
            分からない — 未理解のまま次へ進む
          </button>
          <p className="text-xs text-amber-800 text-center">分からないと気づくのも学習です。この内容はAIが理解した扱いにせず、最後の振り返りに残します。</p>

          <button
            onClick={onNext}
            className={`w-full py-3.5 px-6 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              error
                ? "bg-amber-50 border-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                : satisfied
                ? "bg-green-500 text-white hover:bg-green-600 shadow-md"
                : "bg-indigo-50 border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
            }`}
          >
            {satisfied && !error ? "✅ " : ""}
            {error
              ? `⚠️ AIの解答をスキップして${isLast ? "学習内容の確認へ" : "次へ"} →`
              : isLast
              ? "学習内容を確認する →"
              : "次の練習問題へ →"}
          </button>
          <p className="text-center text-xs font-medium text-gray-400">
            {error
              ? prepaidDepleted ? "前払い残高が補充されるまで、AIの解答は利用できません。" : "スキップすると、この問題でAIに教える機会はなくなります。できれば「もう一度」を試してください。"
              : satisfied
              ? "AIはこの問題を十分に理解できたようです！"
              : "いつでも次に進めます。分からない場合は上のボタンで記録できます。"}
          </p>
        </div>
      )}
    </div>
  );
}
