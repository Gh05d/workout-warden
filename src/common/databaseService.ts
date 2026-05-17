import {SQLiteDatabase, openDatabase} from 'react-native-sqlite-storage';
import RNFS from '@dr.pogodin/react-native-fs';
import {Alert} from 'react-native';
import {EXERCISES, PLANS} from '../seeds';
import {validateSeed} from './seedValidator';

const DB_NAME = 'warden.db';
const DB_PATH_ANDROID = '/data/data/com.workoutwarden/databases/warden.db';

export async function getDBConnection(): Promise<SQLiteDatabase> {
  const db = await openDatabase({name: DB_NAME, location: 'default'});
  await db.executeSql('PRAGMA foreign_keys = ON;');
  return db;
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS plans (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     slug        TEXT NOT NULL UNIQUE,
     name        TEXT NOT NULL,
     description TEXT,
     created_at  DATETIME DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS session_templates (
     id   INTEGER PRIMARY KEY AUTOINCREMENT,
     slug TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS plan_days (
     id                  INTEGER PRIMARY KEY AUTOINCREMENT,
     plan_id             INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
     session_template_id INTEGER NOT NULL REFERENCES session_templates(id),
     day_index           INTEGER NOT NULL,
     weekday_label       TEXT,
     UNIQUE(plan_id, day_index)
   )`,
  `CREATE TABLE IF NOT EXISTS exercises (
     id    INTEGER PRIMARY KEY AUTOINCREMENT,
     slug  TEXT NOT NULL UNIQUE,
     name  TEXT NOT NULL,
     video TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS session_template_exercises (
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
   )`,
  `CREATE TABLE IF NOT EXISTS weeks (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     plan_id    INTEGER NOT NULL REFERENCES plans(id),
     created_at DATETIME DEFAULT (datetime('now')),
     finished   BOOLEAN NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     week_id       INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
     day_index     INTEGER NOT NULL,
     weekday_label TEXT,
     session_name  TEXT NOT NULL,
     trained_at    DATETIME,
     finished      BOOLEAN NOT NULL DEFAULT 0,
     notes         TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS session_exercises (
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
   )`,
  `CREATE TABLE IF NOT EXISTS sets (
     id                  INTEGER PRIMARY KEY AUTOINCREMENT,
     session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
     set_index           INTEGER NOT NULL,
     weight              REAL,
     reps                INTEGER,
     seconds             INTEGER,
     UNIQUE(session_exercise_id, set_index)
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_plan_days_plan      ON plan_days(plan_id, day_index)`,
  `CREATE INDEX IF NOT EXISTS idx_ste_template        ON session_template_exercises(session_template_id, order_index)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_week       ON sessions(week_id, day_index)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_trained    ON sessions(trained_at)`,
  `CREATE INDEX IF NOT EXISTS idx_se_session          ON session_exercises(session_id, order_index)`,
  `CREATE INDEX IF NOT EXISTS idx_se_exercise         ON session_exercises(exercise_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sets_se             ON sets(session_exercise_id, set_index)`,
];

export async function seedDB(db: SQLiteDatabase): Promise<void> {
  validateSeed({exercises: [...EXERCISES], plans: [...PLANS]});

  // 1. Upsert exercises (catalogue grows, never shrinks)
  for (const ex of EXERCISES) {
    await db.executeSql(
      `INSERT INTO exercises (slug, name, video) VALUES (?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET name = excluded.name, video = excluded.video`,
      [ex.slug, ex.name, ex.video ?? null],
    );
  }

  // 2. Per plan: insert if missing, leave existing plan content alone
  for (const plan of PLANS) {
    const [planRes] = await db.executeSql(`SELECT id FROM plans WHERE slug = ?`, [plan.slug]);
    let planId: number;
    if (planRes.rows.length === 0) {
      const [ins] = await db.executeSql(
        `INSERT INTO plans (slug, name, description) VALUES (?, ?, ?)`,
        [plan.slug, plan.name, plan.description ?? null],
      );
      planId = ins.insertId;
    } else {
      planId = planRes.rows.item(0).id;
    }

    // 3. session_templates: insert only missing slugs (template content is immutable post-insert)
    const templateIdBySlug = new Map<string, number>();
    for (const tpl of plan.session_templates) {
      const [tplRes] = await db.executeSql(`SELECT id FROM session_templates WHERE slug = ?`, [tpl.slug]);
      let tplId: number;
      if (tplRes.rows.length === 0) {
        const [ins] = await db.executeSql(
          `INSERT INTO session_templates (slug, name) VALUES (?, ?)`,
          [tpl.slug, tpl.name],
        );
        tplId = ins.insertId;
        // insert all exercises for this template
        for (const ex of tpl.exercises) {
          const [exRow] = await db.executeSql(`SELECT id FROM exercises WHERE slug = ?`, [ex.exercise_slug]);
          const exId = exRow.rows.item(0).id as number;
          await db.executeSql(
            `INSERT INTO session_template_exercises
               (session_template_id, exercise_id, order_index, circuit_index, circuit_rounds,
                prescribed_reps, prescribed_seconds, prescribed_sets, per_side, as_maximum, hint)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tplId, exId, ex.order_index,
              ex.circuit_index ?? null,
              ex.circuit_rounds ?? null,
              ex.prescribed_reps ?? null,
              ex.prescribed_seconds ?? null,
              ex.prescribed_sets,
              ex.per_side ? 1 : 0,
              ex.as_maximum ? 1 : 0,
              ex.hint ?? null,
            ],
          );
        }
      } else {
        tplId = tplRes.rows.item(0).id;
      }
      templateIdBySlug.set(tpl.slug, tplId);
    }

    // 4. plan_days: insert only missing (plan_id, day_index)
    for (const day of plan.days) {
      const [dayRes] = await db.executeSql(
        `SELECT id FROM plan_days WHERE plan_id = ? AND day_index = ?`,
        [planId, day.day_index],
      );
      if (dayRes.rows.length === 0) {
        const tplId = templateIdBySlug.get(day.session_template_slug)!;
        await db.executeSql(
          `INSERT INTO plan_days (plan_id, session_template_id, day_index, weekday_label) VALUES (?, ?, ?, ?)`,
          [planId, tplId, day.day_index, day.weekday_label ?? null],
        );
      }
    }
  }

  // 5. Default active_plan_id to the first seeded plan if not already set
  const [active] = await db.executeSql(`SELECT value FROM settings WHERE key = 'active_plan_id'`);
  if (active.rows.length === 0 && PLANS.length > 0) {
    const [first] = await db.executeSql(`SELECT id FROM plans WHERE slug = ? LIMIT 1`, [PLANS[0].slug]);
    if (first.rows.length > 0) {
      await db.executeSql(`INSERT INTO settings (key, value) VALUES ('active_plan_id', ?)`, [
        String(first.rows.item(0).id),
      ]);
    }
  }
}

export async function initDB(): Promise<void> {
  const db = await getDBConnection();
  for (const stmt of SCHEMA) {
    await db.executeSql(stmt);
  }
  await seedDB(db);
}

// Stub exports kept temporarily so consuming files keep type-checking.
// Each is replaced by a real implementation in tasks 12-15.
export async function exportDatabase(): Promise<void> {
  const exportPath = `${RNFS.DownloadDirectoryPath}/warden-exported.db`;
  try {
    await RNFS.copyFile(DB_PATH_ANDROID, exportPath);
    Alert.alert('Success', `Database exported to ${exportPath}`);
  } catch (error) {
    Alert.alert('Export failed', (error as Error)?.message);
  }
}

export async function importDatabase(importPath: string): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.close();
    await RNFS.copyFile(importPath, DB_PATH_ANDROID);
    Alert.alert('Success', 'Database imported successfully');
  } catch (error) {
    Alert.alert('Import failed', (error as Error)?.message);
  }
}
