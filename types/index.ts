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
// 既存の型
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

export type GrammarUnit = {
  id: string;
  name: string;
  description: string;
  questions: Question[];
  teachingGuide: TeachingGuide;
};

export type Question = {
  id: number;
  sentence: string; // "The man ___ lives next door is a doctor."
  blank: string; // "___" の部分
  answer: string; // 正解
  hint?: string;
};

export type AIAnswer = {
  question_id: number;
  answer: string;
  thinking: string;
  is_correct: boolean;
};

export type TeachResult = {
  answers: AIAnswer[];
  missing_knowledge: string[];
  teaching_score: number;
  score_breakdown: {
    accuracy: number;
    clarity: number;
    completeness: number;
  };
  feedback: string;
  ai_correct_count: number;
  total_questions: number;
};

export type TeachRequest = {
  unit_id: string;
  explanation: string;
};
