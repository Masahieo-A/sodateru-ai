-- ============================================================
-- 育てるAI — Supabase スキーマ
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ============================================================

-- sessions: 授業セッション
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(6) UNIQUE NOT NULL,         -- 生徒用参加コード（例: ABC123）
  unit_id     VARCHAR(50) NOT NULL,               -- 単元ID（lib/questions.ts に対応）
  name        VARCHAR(100) NOT NULL,              -- セッション名（教員が設定）
  status      TEXT NOT NULL DEFAULT 'waiting'
              CHECK (status IN ('waiting', 'active', 'ended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- students: セッション参加者
CREATE TABLE IF NOT EXISTS students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name            VARCHAR(50) NOT NULL,           -- ニックネーム
  best_score      INTEGER NOT NULL DEFAULT 0,     -- 最高スコア
  attempt_count   INTEGER NOT NULL DEFAULT 0,     -- 試行回数
  last_attempt_at TIMESTAMPTZ,
  dialogue_log    JSONB,                          -- 練習で教えた対話ログ（サーバーが正とする）
  teaching_summary TEXT,                          -- 教えた内容のサマリー（テスト時のトークン削減用）
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 既存DBのアップグレード用（冪等）
ALTER TABLE students ADD COLUMN IF NOT EXISTS dialogue_log JSONB;
ALTER TABLE students ADD COLUMN IF NOT EXISTS teaching_summary TEXT;

-- attempts: 各試行の記録
CREATE TABLE IF NOT EXISTS attempts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  explanation      TEXT NOT NULL,                 -- 生徒が入力した説明文
  teaching_score   INTEGER NOT NULL,              -- 教え方スコア（0-100）
  ai_correct_count INTEGER NOT NULL,              -- AIの正解数
  total_questions  INTEGER NOT NULL,              -- 総問題数
  result_json      JSONB NOT NULL,                -- TeachResult の完全な JSON
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ai_responses: AI応答の冪等化キャッシュ
-- クライアントが付ける attemptId をキーに成功レスポンスを保存し、
-- 再試行ボタンの連打・「戻る」操作での二重生成を防ぐ
CREATE TABLE IF NOT EXISTS ai_responses (
  attempt_id  TEXT PRIMARY KEY,
  response    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Row Level Security（RLS）
-- API ルート経由でのみアクセスするため、全許可ポリシーを設定
-- ============================================================
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attempts" ON attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ai_responses" ON ai_responses FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Realtime（リアルタイムランキング用）
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE students;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
