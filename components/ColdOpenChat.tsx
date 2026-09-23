"use client";

import { AppIcon } from "@/components/AppIcon";
import { SotaAvatar } from "@/components/SotaAvatar";

import { useEffect, useRef, useState } from "react";
import { ErrorRetry } from "@/components/ErrorRetry";
import type { GrammarUnit, LessonMessage, PracticeTurn } from "@/types";

type Bubble =
  | { kind: "student"; content: string; chosenLabel?: string }
  | { kind: "teacher"; content: string };

type Props = {
  unit: GrammarUnit;
  participantId: string;
  sessionId: string;
  /** 親のレッスン対話へ1メッセージ追記 */
  onAppend: (m: LessonMessage) => void;
  /** 基礎説明（説明ビルダー）へ進む */
  onProceed: () => void;
  /** 冪等化キーの接頭辞（レッスン実行ごとに一意） */
  attemptScope?: string;
};

/**
 * 知識契約カード：AIが最初から知っていること／今日教えてもらうことを
 * レッスン冒頭で明示する。「どこまで教えればいいのか」の不安への回答。
 */
function KnowledgeContract({ unit }: { unit: GrammarUnit }) {
  const [open, setOpen] = useState(false);
  const { assumedKnowledge, coverageTopics } = unit.teachingGuide;

  return (
    <div className="rounded-xl border border-indigo-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <AppIcon name="handshake" />
          <span className="text-sm font-bold text-indigo-700">
            ソウタが知っていること・知らないこと
          </span>
        </div>
        <span className="text-indigo-400 text-xs font-medium">
          <AppIcon name={open ? "up" : "down"} /> {open ? "閉じる" : "開く"}
        </span>
      </button>
      {open && (
        <div className="bg-white px-4 py-3 space-y-3">
          <div>
            <p className="text-xs font-bold text-gray-400 mb-1.5">
              <AppIcon name="brain" /> 最初から知っていること（教えなくてOK）
            </p>
            <ul className="space-y-1">
              {assumedKnowledge.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                  <AppIcon name="check" className="mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold text-indigo-600 mb-1.5">
              <AppIcon name="books" /> 今日きみが教えること（これだけでOK）
            </p>
            <ul className="space-y-1">
              {coverageTopics.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <AppIcon name="empty" className="mt-0.5 text-indigo-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * コールドオープン：レッスン冒頭、AIがまだ何も教わっていない状態で
 * 練習問題1問に挑戦し、失敗して具体的な質問をする。
 * 生徒の最初の入力を「説明の作文」ではなく「質問への返答」にすることで、
 * 0→1のハードルを下げる（教える必然性も先に体感させる）。
 */
export function ColdOpenChat({
  unit,
  participantId,
  sessionId,
  onAppend,
  onProceed,
  attemptScope,
}: Props) {
  const question = unit.practiceQuestions[0];

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prepaidDepleted, setPrepaidDepleted] = useState(false);

  // API送信用の「最新の対話全文」を ref で保持（state の非同期性を回避）
  const convoRef = useRef<LessonMessage[]>([]);
  const startedRef = useRef(false);
  const teacherRepliesRef = useRef(0);
  const [replied, setReplied] = useState(false);
  // 冪等化キー：ターンごとに発行し、エラー時の再試行では同じIDを再送する
  const attemptIdRef = useRef<string>(
    attemptScope ? `${attemptScope}:coldopen:init` : crypto.randomUUID()
  );
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
          is_followup: isFollowup,
          exchange_count: teacherRepliesRef.current,
          is_cold_open: true,
          attempt_id: attemptIdRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "PREPAID_CREDITS_DEPLETED") setPrepaidDepleted(true);
        throw new Error(data.error ?? "ソウタの応答に失敗しました");
      }

      const turn = data as PracticeTurn;
      const studentMsg: LessonMessage = { role: "student", content: turn.message };
      convoRef.current = [...convoRef.current, studentMsg];
      onAppend(studentMsg);
      setBubbles((b) => [
        ...b,
        { kind: "student", content: turn.message, chosenLabel: turn.chosenLabel },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
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
    setReplied(true);
    setBubbles((b) => [...b, { kind: "teacher", content: text }]);
    setReply("");
    // 新しいターンなので冪等化キーを発行し直す（再試行時はこのIDを使い回す）
    attemptIdRef.current = crypto.randomUUID();
    await runTurn(true);
  };

  // 直近のAIの発話（質問）。入力欄のプレースホルダーに使い、
  // 「作文」ではなく「質問への返答」であることを分かりやすくする（P1-4）
  const lastAiMessage = [...bubbles]
    .reverse()
    .find((b) => b.kind === "student")?.content;

  return (
    <div className="space-y-4">
      {/* 導入メッセージ */}
      <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
        <div className="flex items-start gap-2">
          <SotaAvatar />
          <div>
            <p className="font-bold text-indigo-800">まずはソウタの腕試し</p>
            <p className="text-indigo-700 text-sm mt-1 leading-relaxed">
              「{unit.name}」はまだ教わっていませんが、いまの知識だけで1問だけ挑戦してみます。
              つまずいたところを教えてあげてください！
            </p>
          </div>
        </div>
      </div>

      <KnowledgeContract unit={unit} />

      {/* 問題カード */}
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
        <p className="text-sm font-medium text-gray-800 mb-3 leading-relaxed">
          {question.sentence}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {question.choices.map((c) => {
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
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                <span className="font-bold">{c.label}.</span>
                <span>{c.text}</span>
                {chosen && <AppIcon name="brain" className="ml-auto" />}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          ※ 腕試しなので、正解かどうかはまだ表示しません
        </p>
      </div>

      {/* 対話 */}
      <div className="space-y-3">
        {bubbles.map((b, i) =>
          b.kind === "student" ? (
            <div key={i} className="flex items-start gap-2">
              <SotaAvatar />
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
              <AppIcon name="teacher" size={28} className="text-gray-600" />
            </div>
          )
        )}

        {loading && (
          <div className="flex items-start gap-2">
            <SotaAvatar />
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

      {/* 返答入力 + 次へ（エラー時も、基礎説明へは進めるようにする） */}
      {!loading && (bubbles.length > 0 || error) && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-200 p-3">
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              <AppIcon name="chat" /> ソウタの質問に、ひとことで答えてあげよう
            </label>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={
                lastAiMessage
                  ? `ソウタの質問「${
                      lastAiMessage.length > 40
                        ? `${lastAiMessage.slice(0, 40)}…`
                        : lastAiMessage
                    }」に、知っていることをひとことで答えてあげよう`
                  : "完璧じゃなくてOK。知っていることをひとことで教えてあげましょう。"
              }
              rows={3}
              className="w-full p-2 text-sm text-gray-800 focus:outline-none resize-none leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={prepaidDepleted || reply.trim().length === 0}
              className="w-full mt-1 py-2.5 px-4 bg-indigo-600 text-white font-bold rounded-xl
                hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
            >
              <AppIcon name="pencil" /> 答えてあげる
            </button>
          </div>

          <button
            onClick={onProceed}
            className={`w-full py-3.5 px-6 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              replied
                ? "bg-green-500 text-white hover:bg-green-600 shadow-md"
                : "bg-indigo-50 border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
            }`}
          >
            {replied && <AppIcon name="success" />} <AppIcon name="books" /> 基本ルールをまとめて教える <AppIcon name="next" />
          </button>
          <p className="text-center text-xs font-medium text-gray-400">
            {replied
              ? "いい調子！次は、ここまでの内容もふまえて基本からまとめて教えてあげよう。"
              : "先に質問に答えてあげると、ソウタに伝わりやすくなります（すぐ進んでもOK）。"}
          </p>
        </div>
      )}
    </div>
  );
}
