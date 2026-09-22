-- Per-session learning scope and immutable teaching-policy snapshot.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS session_learning_configs (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  curriculum_id TEXT,
  curriculum_version INTEGER,
  unit_id TEXT NOT NULL,
  selected_knowledge_ids TEXT NOT NULL DEFAULT '[]',
  prior_knowledge_ids TEXT NOT NULL DEFAULT '[]',
  sampling_policy TEXT NOT NULL DEFAULT '{}',
  confirmation_policy TEXT NOT NULL DEFAULT '{}',
  immutable_snapshot TEXT NOT NULL DEFAULT '{}',
  creator_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- The API also checks this relationship before insert; this index makes
-- account-bound participant creation converge under concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_session_user
  ON participants(session_id, user_id);
