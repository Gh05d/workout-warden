-- scripts/schema-v2.sql
-- Mirrors src/common/databaseService.ts SCHEMA[] array. Keep in sync.

CREATE TABLE IF NOT EXISTS plans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_templates (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_days (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id             INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  session_template_id INTEGER NOT NULL REFERENCES session_templates(id),
  day_index           INTEGER NOT NULL,
  weekday_label       TEXT,
  UNIQUE(plan_id, day_index)
);

CREATE TABLE IF NOT EXISTS exercises (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL,
  video TEXT
);

CREATE TABLE IF NOT EXISTS session_template_exercises (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_template_id INTEGER NOT NULL REFERENCES session_templates(id) ON DELETE CASCADE,
  exercise_id         INTEGER NOT NULL REFERENCES exercises(id),
  order_index         INTEGER NOT NULL,
  circuit_index       INTEGER,
  circuit_rounds      INTEGER,
  prescribed_reps     INTEGER,
  prescribed_seconds  INTEGER,
  prescribed_sets     INTEGER NOT NULL DEFAULT 1 CHECK(prescribed_sets >= 1),
  per_side            BOOLEAN NOT NULL DEFAULT 0,
  as_maximum          BOOLEAN NOT NULL DEFAULT 0,
  hint                TEXT,
  UNIQUE(session_template_id, order_index)
);

CREATE TABLE IF NOT EXISTS weeks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id    INTEGER NOT NULL REFERENCES plans(id),
  created_at DATETIME DEFAULT (datetime('now')),
  finished   BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id       INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  day_index     INTEGER NOT NULL,
  weekday_label TEXT,
  session_name  TEXT NOT NULL,
  trained_at    DATETIME,
  finished      BOOLEAN NOT NULL DEFAULT 0,
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS session_exercises (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id         INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id        INTEGER NOT NULL REFERENCES exercises(id),
  order_index        INTEGER NOT NULL,
  circuit_index      INTEGER,
  circuit_rounds     INTEGER,
  prescribed_reps    INTEGER,
  prescribed_seconds INTEGER,
  prescribed_sets    INTEGER NOT NULL DEFAULT 1 CHECK(prescribed_sets >= 1),
  per_side           BOOLEAN NOT NULL DEFAULT 0,
  as_maximum         BOOLEAN NOT NULL DEFAULT 0,
  hint               TEXT,
  finished           BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sets (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_index           INTEGER NOT NULL,
  weight              REAL,
  reps                INTEGER,
  seconds             INTEGER,
  UNIQUE(session_exercise_id, set_index)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_plan_days_plan      ON plan_days(plan_id, day_index);
CREATE INDEX IF NOT EXISTS idx_ste_template        ON session_template_exercises(session_template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_sessions_week       ON sessions(week_id, day_index);
CREATE INDEX IF NOT EXISTS idx_sessions_trained    ON sessions(trained_at);
CREATE INDEX IF NOT EXISTS idx_se_session          ON session_exercises(session_id, order_index);
CREATE INDEX IF NOT EXISTS idx_se_exercise         ON session_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sets_se             ON sets(session_exercise_id, set_index);
