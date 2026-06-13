"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TeachingInput } from "@/components/TeachingInput";
import { TeacherHintPanel } from "@/components/TeacherHintPanel";
import { PracticeChat } from "@/components/PracticeChat";
import { LearningSummary } from "@/components/LearningSummary";
import { SolvingDisplay } from "@/components/SolvingDisplay";
import { TestResult } from "@/components/TestResult";
import { getUnitById } from "@/lib/questions";
import { supabase } from "@/lib/supabase";
import type {
  Session,
  Student,
  GrammarUnit,
  LessonMessage,
  TestResult as TR,
} from "@/types";

// レッスンのステップ
type LessonStep =
  | "explain" // 基礎説明
  | "practice" // 練習問題で対話
  | "summary" // 学習内容の把握
  | "test-loading" // テスト評価中
  | "test-solving" // AIがテストを解くアニメ
  | "result"; // スコア表示

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

// ============================================================
// ランキングコンポーネント
// ============================================================
function RankingList({
  students,
  currentStudentId,
}: {
  students: Student[];
  currentStudentId: string;
}) {
  const sorted = [...students].sort((a, b) => b.best_score - a.best_score);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 mb-4">🏆 ランキング</h3>
      <div className="space-y-2">
        {sorted.map((student, index) => {
          const rank = index + 1;
          const isMe = student.id === currentStudentId;
          return (
            <div
              key={student.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isMe
                  ? "bg-indigo-100 border-2 border-indigo-400"
                  : "bg-gray-50 border border-gray-100"
              }`}
            >
              <span className="text-xl w-8 text-center flex-shrink-0">
                {MEDAL[rank] ?? <span className="text-gray-500 font-bold text-sm">{rank}</span>}
              </span>
              <span
                className={`flex-1 font-bold text-sm truncate ${
                  isMe ? "text-indigo-700" : "text-gray-700"
                }`}
              >
                {student.name}
                {isMe && (
                  <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                    あなた
                  </span>
                )}
              </span>
              <span
                className={`font-black text-lg flex-shrink-0 ${
                  isMe ? "text-indigo-600" : "text-gray-500"
                }`}
              >
                {student.best_score}
                <span className="text-xs font-normal ml-0.5">点</span>
              </span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {student.attempt_count}回
              </span>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">
            まだ誰も挑戦していません
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// メインページ
// ============================================================
export default function SessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();

  const [code, setCode] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [unit, setUnit] = useState<GrammarUnit | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // レッスン状態
  const [lessonStep, setLessonStep] = useState<LessonStep>("explain");
  const [dialogue, setDialogue] = useState<LessonMessage[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  // 練習問題の「初回回答」で間違えた数（メタ認知のための“あえて間違え”判定に使う）
  const [initialWrongCount, setInitialWrongCount] = useState(0);
  // “あえて間違える”演出が実際に発動したか（結果画面で事後開示するために保持）
  const [didForceStumble, setDidForceStumble] = useState(false);
  const [testResult, setTestResult] = useState<TR | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // ============================================================
  // 生徒一覧の再フェッチ
  // ============================================================
  const fetchStudents = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from("students")
      .select("*")
      .eq("session_id", sid)
      .order("best_score", { ascending: false });
    if (data) setStudents(data as Student[]);
  }, []);

  // ============================================================
  // 初期化
  // ============================================================
  useEffect(() => {
    let sessionChannel: ReturnType<typeof supabase.channel> | null = null;
    let rankingChannel: ReturnType<typeof supabase.channel> | null = null;

    async function initialize() {
      const resolvedParams = await params;
      const resolvedCode = resolvedParams.code;
      setCode(resolvedCode);

      const storedStudentId = localStorage.getItem("student_id");
      const storedStudentName = localStorage.getItem("student_name");
      const storedSessionId = localStorage.getItem("session_id");

      if (!storedStudentId || !storedStudentName || !storedSessionId) {
        router.push("/join");
        return;
      }

      setStudentId(storedStudentId);
      setStudentName(storedStudentName);
      setSessionId(storedSessionId);

      const res = await fetch(`/api/sessions/${resolvedCode}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setInitError(errData.error ?? "セッションの取得に失敗しました");
        setIsInitializing(false);
        return;
      }
      const sessionData: Session = await res.json();
      setSession(sessionData);

      const unitData = getUnitById(sessionData.unit_id);
      if (!unitData) {
        setInitError("単元情報が見つかりませんでした");
        setIsInitializing(false);
        return;
      }
      setUnit(unitData);

      await fetchStudents(storedSessionId);

      const uid = Date.now();
      sessionChannel = supabase
        .channel(`session-status-${resolvedCode}-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "sessions",
            filter: `code=eq.${resolvedCode}`,
          },
          (payload) => {
            setSession(payload.new as Session);
          }
        )
        .subscribe();

      rankingChannel = supabase
        .channel(`ranking-${storedSessionId}-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "students",
            filter: `session_id=eq.${storedSessionId}`,
          },
          () => {
            fetchStudents(storedSessionId);
          }
        )
        .subscribe();

      setIsInitializing(false);
    }

    initialize().catch((err) => {
      console.error("[SessionPage] initialize error:", err);
      setInitError("初期化中にエラーが発生しました");
      setIsInitializing(false);
    });

    return () => {
      if (sessionChannel) supabase.removeChannel(sessionChannel);
      if (rankingChannel) supabase.removeChannel(rankingChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // レッスン操作
  // ============================================================
  const appendDialogue = useCallback((m: LessonMessage) => {
    setDialogue((d) => [...d, m]);
  }, []);

  // 基礎説明の送信 → 練習へ
  const handleExplainSubmit = (text: string) => {
    setDialogue([{ role: "teacher", content: text }]);
    setPracticeIndex(0);
    setInitialWrongCount(0);
    setDidForceStumble(false);
    setError(null);
    setLessonStep("practice");
  };

  // 練習問題の初回回答の正誤を集計
  const handleFirstAnswer = (isCorrect: boolean) => {
    if (!isCorrect) setInitialWrongCount((n) => n + 1);
  };

  // 練習問題：次へ
  const handlePracticeNext = () => {
    if (!unit) return;
    if (practiceIndex < unit.practiceQuestions.length - 1) {
      setPracticeIndex((i) => i + 1);
    } else {
      setLessonStep("summary");
    }
  };

  // テスト開始
  const handleStartTest = async () => {
    if (!unit || !studentId || !sessionId) return;
    setLessonStep("test-loading");
    setError(null);
    try {
      const res = await fetch("/api/lesson/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_id: unit.id,
          dialogue,
          student_id: studentId,
          session_id: sessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "テストに失敗しました");
      setTestResult(data as TR);
      setLessonStep("test-solving");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setLessonStep("summary");
    }
  };

  // 最初からやり直す（教え方を改善して再挑戦）
  const handleRetry = () => {
    setDialogue([]);
    setPracticeIndex(0);
    setInitialWrongCount(0);
    setDidForceStumble(false);
    setTestResult(null);
    setError(null);
    setLessonStep("explain");
  };

  // ============================================================
  // ローディング
  // ============================================================
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🌱</div>
          <p className="text-indigo-600 font-bold">読み込み中...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // 初期化エラー
  // ============================================================
  if (initError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm w-full">
          <div className="text-5xl mb-4">😥</div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <p className="text-red-700 font-bold mb-4">⚠️ {initError}</p>
            <button
              onClick={() => router.push("/join")}
              className="w-full py-3 px-6 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              参加画面に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session || !unit) return null;

  // 「レッスン中」か判定（この間はトップボタンを非表示）
  const inLesson = session.status === "active" && lessonStep !== "result";

  // ============================================================
  // 共通ヘッダー
  // ============================================================
  const Header = () => (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌱</span>
          <span className="font-black text-indigo-700 text-lg">育てるAI</span>
        </div>
        <div className="flex items-center gap-3">
          {studentName && (
            <span className="text-xs text-gray-500 font-medium">{studentName}</span>
          )}
          <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full">
            {unit.name}
          </span>
          {!inLesson && (
            <a
              href="/"
              className="text-sm text-gray-400 hover:text-gray-700 font-medium transition flex items-center gap-1"
            >
              ← トップへ
            </a>
          )}
        </div>
      </div>
    </header>
  );

  // ============================================================
  // 待機中 (waiting)
  // ============================================================
  if (session.status === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-8 text-center">
            <div className="text-5xl mb-4 animate-pulse">🌱</div>
            <h1 className="text-xl font-black text-indigo-700 mb-2">
              授業の開始を待っています...
            </h1>
            <p className="text-gray-500 text-sm">先生が授業を始めるまでお待ちください</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">授業名</span>
              <span className="font-bold text-gray-800">{session.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">単元</span>
              <span className="font-bold text-indigo-600">{unit.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">参加コード</span>
              <span className="font-black text-2xl tracking-widest text-indigo-700">{code}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4">
              👥 参加中の生徒 ({students.length}人)
            </h2>
            <div className="flex flex-wrap gap-2">
              {students.map((s) => (
                <span
                  key={s.id}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    s.id === studentId
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {s.name}
                  {s.id === studentId && " (あなた)"}
                </span>
              ))}
              {students.length === 0 && (
                <p className="text-gray-400 text-sm">まだ誰も参加していません</p>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // 授業中 (active) — 新レッスンフロー
  // ============================================================
  if (session.status === "active") {
    const currentQuestion = unit.practiceQuestions[practiceIndex];

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          {/* 基礎説明 */}
          {lessonStep === "explain" && (
            <>
              <TeachingInput
                unit={unit}
                onSubmit={handleExplainSubmit}
                isLoading={false}
                initialValue={dialogue[0]?.content ?? ""}
              />
              <TeacherHintPanel unit={unit} dialogue={dialogue} />
            </>
          )}

          {/* 練習問題で対話 */}
          {lessonStep === "practice" && currentQuestion && (
            <>
              <PracticeChat
                key={practiceIndex}
                unit={unit}
                question={currentQuestion}
                questionIndex={practiceIndex}
                totalQuestions={unit.practiceQuestions.length}
                dialogue={dialogue}
                onAppend={appendDialogue}
                onNext={handlePracticeNext}
                isLast={practiceIndex === unit.practiceQuestions.length - 1}
                onFirstAnswer={handleFirstAnswer}
                onStumble={() => setDidForceStumble(true)}
                // このままだと全問正解（初回ミス0）かつ最後の問題なら、
                // メタ認知のため“あえて1問間違える”
                forceStumble={
                  practiceIndex === unit.practiceQuestions.length - 1 &&
                  initialWrongCount === 0
                }
              />
              <TeacherHintPanel
                key={`hint-${practiceIndex}`}
                unit={unit}
                dialogue={dialogue}
                questionId={currentQuestion.id}
              />
            </>
          )}

          {/* 学習内容の把握 */}
          {lessonStep === "summary" && (
            <LearningSummary
              unit={unit}
              dialogue={dialogue}
              studentId={studentId}
              onStartTest={handleStartTest}
              onBack={() => setLessonStep("practice")}
            />
          )}

          {/* テスト評価中 */}
          {lessonStep === "test-loading" && (
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-8 text-center">
              <div className="text-4xl mb-3 animate-bounce">📝</div>
              <p className="text-indigo-600 font-bold">
                AIがテストに挑戦しています...
              </p>
            </div>
          )}

          {/* テスト解答アニメ */}
          {lessonStep === "test-solving" && testResult && (
            <SolvingDisplay
              result={testResult}
              unit={unit}
              onDone={() => setLessonStep("result")}
            />
          )}

          {/* 結果 */}
          {lessonStep === "result" && testResult && (
            <>
              <TestResult
                result={testResult}
                unit={unit}
                onRetry={handleRetry}
                forceStumbleUsed={didForceStumble}
              />
              {studentId && (
                <RankingList students={students} currentStudentId={studentId} />
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  // ============================================================
  // 終了 (ended)
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-8 text-white text-center shadow-lg">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-black mb-2">授業終了！</h1>
          <p className="text-indigo-100 text-sm">お疲れ様でした！全員の最終スコアです</p>
        </div>

        {studentId && (
          <RankingList students={students} currentStudentId={studentId} />
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <div className="text-4xl mb-3">✨</div>
          <p className="text-gray-700 font-bold mb-1">よく頑張りました！</p>
          <p className="text-gray-500 text-sm">
            AIに教えることで、自分の理解が深まりましたね。
            <br />
            次の授業でもまた挑戦しましょう！
          </p>
        </div>

        <a
          href="/"
          className="w-full py-3 px-6 bg-indigo-600 text-white font-bold rounded-xl
            hover:bg-indigo-700 transition-colors duration-200
            flex items-center justify-center gap-2"
        >
          🏠 トップページへ
        </a>
      </main>
    </div>
  );
}
