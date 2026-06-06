// ============================================================
// Supabase DB 型
// ============================================================

export type SessionStatus = "waiting" | "active" | "ended";

export type Session = {
  id: string;
  code: string;
  unit_id: string;
  name: string;
  status: SessionStatus;
  created_at: string;
};

export type Student = {
  id: string;
  session_id: string;
  name: string;
  best_score: number;
  attempt_count: number;
  last_attempt_at: string | null;
  created_at: string;
};

export type Attempt = {
  id: string;
  student_id: string;
  session_id: string;
  teaching_score: number;
  ai_correct_count: number;
  total_questions: number;
  created_at: string;
};

// ============================================================
// 単元・問題
// ============================================================

export type TeachingGuide = {
  /** AIがすでに持っている前提知識（教えなくてよい） */
  assumedKnowledge: string[];
  /**
   * 出題されるトピックの一覧（スコープ確認・後出し防止）
   * ※具体的な形や公式は示さず、「何を扱うか」だけ伝える
   */
  coverageTopics: string[];
  /**
   * 教え方を組み立てるための問いかけ（答えではなく思考の入口）
   * ※コピペで完成しないよう、抽象的な視点で示す
   */
  thinkingPrompts: string[];
};

/** 4択の選択肢 */
export type Choice = {
  label: string; // "A" | "B" | "C" | "D"
  text: string; // 選択肢の文言（例: "where"）
};

/** 4択問題 */
export type MCQuestion = {
  id: number;
  sentence: string; // ___ を含む英文（例: "This is the city ___ I was born."）
  choices: Choice[]; // 4択
  answerLabel: string; // 正解の選択肢ラベル（例: "A"）
  /**
   * 正解理由・誤答理由のメモ（教師AI＝文法マスターと採点の参照用）
   * ※生徒役AIには「答え」としては渡さない
   */
  explanation?: string;
  hint?: string;
};

export type GrammarUnit = {
  id: string;
  name: string;
  description: string;
  teachingGuide: TeachingGuide;
  /** 練習問題（AIと対話しながら教え込む。1問ずつ扱う） */
  practiceQuestions: MCQuestion[];
  /** テスト問題（最後にAIが解いてスコアを確定する） */
  testQuestions: MCQuestion[];
};

// ============================================================
// 対話（レッスン）
// ============================================================

/** teacher = ユーザ（教える側）, student = AI（教わる側） */
export type LessonRole = "teacher" | "student";

export type LessonMessage = {
  role: LessonRole;
  content: string;
};

// ============================================================
// AIレスポンス型
// ============================================================

/** 練習問題でのAI（生徒役）の1ターン */
export type PracticeTurn = {
  /** 生徒役AIの発話（思考・つぶやき・質問を含む自然文） */
  message: string;
  /** AIが選んだ選択肢ラベル（まだ解いていない場合は省略） */
  chosenLabel?: string;
  /** 正誤（サーバ側で answerLabel と照合して確定） */
  isCorrect?: boolean;
  /** この問題について理解が十分になり、次へ進んでよいか */
  satisfied: boolean;
};

/** 文法マスター（教師AI）からの「教え方」ヒント */
export type TeachingHint = {
  hint: string;
};

/** 学習内容の把握（要約） */
export type LearningSummary = {
  taught: string[]; // 生徒が教えた内容
  learned: string[]; // AIが理解・習得したこと
  gaps: string[]; // まだ不足・あいまいなこと
  summary: string; // 総括コメント
};

/** テストの各問の回答 */
export type TestAnswer = {
  question_id: number;
  chosenLabel: string; // AIが選んだラベル
  thinking: string; // 思考過程（日本語）
  is_correct: boolean; // サーバ側で確定
};

/** テスト結果（スコアリング） */
export type TestResult = {
  answers: TestAnswer[];
  teaching_score: number; // 教え方スコア（0-100）
  score_breakdown: {
    accuracy: number; // 正確性
    clarity: number; // わかりやすさ
    completeness: number; // 網羅性
  };
  feedback: string; // 先生へのフィードバック
  ai_correct_count: number; // AIの正解数
  total_questions: number; // 総問題数
};
