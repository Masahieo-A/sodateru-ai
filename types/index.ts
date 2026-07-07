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

// ============================================================
// 初回説明の足場掛け（説明ビルダー）
// ============================================================

/** ガイド付きモードの入力欄1つ分 */
export type ExplanationSlot = {
  /** 合成時のキー（例: "purpose" / "decision" / "example" / "warning" / "misconception"） */
  id: string;
  /** 入力欄の見出し（例: 「何のために使う文法か」） */
  label: string;
  /** 短い問いかけ（例: 「この文法の役割を一言で説明しよう」） */
  prompt: string;
  /** 入力欄のプレースホルダ（書き出し例） */
  placeholder: string;
  /** 必須かどうか */
  required: boolean;
};

/** 弱い説明・良い説明の比較例 */
export type WorkedExample = {
  weak: string;
  strong: string;
  commentary: string;
};

/**
 * 初回説明を段階的に組み立てるための足場掛けデータ。
 * 単元ごとに optional で持たせ、無い場合は従来の自由記述にフォールバックする。
 */
export type StarterScaffold = {
  /** 説明の核となる問い（生徒に最初に意識させたい観点） */
  coreQuestion: string;
  /** 文の書き出し例（穴埋めのヒント） */
  sentenceStarters: string[];
  /** ガイド付きモードの入力欄定義 */
  explanationSlots: ExplanationSlot[];
  /** 弱い例／良い例の比較 */
  workedExample: WorkedExample;
  /** よくある「教え方の型」（補助的な気づき用） */
  commonTeachingMoves: string[];
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
  /**
   * 「もっともらしい誤解」用の設定（任意）。
   * 全問正解しそうな場合に、メタ認知のきっかけとして“あえて1問間違える”際に使う。
   * - label: 間違えやすい誤答ラベル（answerLabel 以外）
   * - misconception: その誤答に至る、生徒の説明の解釈ズレ・過剰一般化など
   *   ※「教わった内容の否定」ではなく、自然な誤読・取り違えとして表現する素材
   * 未設定でも動作する（その場合は最初の誤答ラベル＋汎用的な誤解表現を使う）。
   */
  commonMistake?: {
    label: string;
    misconception: string;
  };
  /**
   * この問題を解くのに必要な学習対象トピック
   * （teachingGuide.coverageTopics のインデックス配列）。
   * テスト時のカバレッジ判定で「教わっていない問題」をサーバ側で確定するために使う。
   * 未指定の場合はカバレッジ判定の対象外（常に解答可能扱い）。
   */
  requiredTopics?: number[];
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
  /** 初回説明を組み立てるための足場掛け（任意。無ければ自由記述のみ） */
  starterScaffold?: StarterScaffold;
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
  /**
   * AI呼び出しがリトライしても失敗し、事前定義の定型応答を返した場合 true。
   * （授業が止まることだけは防ぐためのフォールバック）
   */
  isFallback?: boolean;
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

/**
 * カバレッジ判定：学習対象トピック1つ分の判定結果。
 * 生徒役AIの「演技」とは独立した判定AI＋サーバ検証で確定する。
 */
export type TopicCoverage = {
  /** teachingGuide.coverageTopics のインデックス */
  topicIndex: number;
  /** トピック名（coverageTopics の文言） */
  topic: string;
  /** 先生の説明がこのトピックを「問題を解けるレベルで」含んでいたか */
  covered: boolean;
  /** covered の根拠となる、説明からの引用（判定AIの出力） */
  evidence?: string;
  /** 引用が実際に説明文中に存在するとサーバ側で確認できたか */
  evidenceVerified?: boolean;
};

/** テストの各問の回答 */
export type TestAnswer = {
  question_id: number;
  chosenLabel: string; // AIが選んだラベル
  thinking: string; // 思考過程（日本語）
  is_correct: boolean; // サーバ側で確定
  /**
   * この問題に必要なトピックをすべて教わっていたか（カバレッジ判定で確定）。
   * false の場合、解答はサーバ側で「未習の誤答」として確定されている。
   */
  taught?: boolean;
  /** taught=false のとき、不足していたトピック名（スコア画面で失点理由として表示） */
  missingTopics?: string[];
};

/** テスト結果（スコアリング） */
export type TestResult = {
  answers: TestAnswer[];
  teaching_score: number; // 教え方スコア（0-100）
  score_breakdown: {
    accuracy: number; // 正確性（LLM評価・重み20%）
    clarity: number; // わかりやすさ（LLM評価・重み10%）
    completeness: number; // 網羅性（カバレッジ判定から機械算出・重み30%）
    /** テスト正答率（サーバ照合で決定的・重み40%）。旧データには無い */
    test_rate?: number;
  };
  feedback: string; // 先生へのフィードバック
  ai_correct_count: number; // AIの正解数
  total_questions: number; // 総問題数
  /** 学習診断（フィードバックループ用）。次にどこを改善すべきかを具体的に示す */
  learningDiagnosis?: {
    strongPoints: string[]; // 生徒がうまく説明できた点
    weakPoints: string[]; // 説明が不十分だった点
    suggestion: string; // 次回の教え方アドバイス
  };
  /**
   * 学習対象トピックごとのカバレッジ判定結果。
   * completeness（網羅性）はここから機械的に算出される。
   */
  topicCoverage?: TopicCoverage[];
};
