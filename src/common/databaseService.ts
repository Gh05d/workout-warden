import {SQLiteDatabase, openDatabase} from 'react-native-sqlite-storage';
import RNFS from '@dr.pogodin/react-native-fs';
import {Alert} from 'react-native';
import {EXERCISES, PLANS} from '../seeds';
import {validateSeed} from './seedValidator';
import type {Plan, PlanDay, Session, ExerciseInstance, SetLog, Week} from './types';

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

// ---------- Plan reads ----------

export async function fetchPlans(db: SQLiteDatabase): Promise<Plan[]> {
  const [res] = await db.executeSql(`SELECT id, slug, name, description FROM plans ORDER BY id ASC`);
  return res.rows.raw();
}

export async function fetchActivePlanId(db: SQLiteDatabase): Promise<number | null> {
  const [res] = await db.executeSql(`SELECT value FROM settings WHERE key = 'active_plan_id'`);
  if (res.rows.length === 0) return null;
  return Number(res.rows.item(0).value);
}

export async function setActivePlanId(db: SQLiteDatabase, planId: number): Promise<void> {
  await db.executeSql(
    `INSERT INTO settings (key, value) VALUES ('active_plan_id', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(planId)],
  );
}

export async function fetchPlanDays(db: SQLiteDatabase, planId: number): Promise<PlanDay[]> {
  const [res] = await db.executeSql(
    `SELECT pd.id, pd.plan_id, pd.session_template_id, pd.day_index, pd.weekday_label,
            st.name AS session_template_name
     FROM plan_days pd
     JOIN session_templates st ON st.id = pd.session_template_id
     WHERE pd.plan_id = ?
     ORDER BY pd.day_index ASC`,
    [planId],
  );
  return res.rows.raw();
}

// ---------- Week / Session creation ----------

export async function createWeek(db: SQLiteDatabase, planId: number): Promise<number> {
  const [weekIns] = await db.executeSql(`INSERT INTO weeks (plan_id) VALUES (?)`, [planId]);
  const weekId = weekIns.insertId;

  const planDays = await fetchPlanDays(db, planId);
  for (const day of planDays) {
    const [sessIns] = await db.executeSql(
      `INSERT INTO sessions (week_id, day_index, weekday_label, session_name)
       VALUES (?, ?, ?, ?)`,
      [weekId, day.day_index, day.weekday_label, day.session_template_name],
    );
    const sessionId = sessIns.insertId;

    // Copy template exercises into session_exercises
    const [tplExRes] = await db.executeSql(
      `SELECT ste.exercise_id, ste.order_index, ste.circuit_index, ste.circuit_rounds,
              ste.prescribed_reps, ste.prescribed_seconds, ste.prescribed_sets,
              ste.per_side, ste.as_maximum, ste.hint
       FROM session_template_exercises ste
       WHERE ste.session_template_id = ?
       ORDER BY ste.order_index ASC`,
      [day.session_template_id],
    );
    const tplExercises = tplExRes.rows.raw();

    for (const tEx of tplExercises) {
      const [seIns] = await db.executeSql(
        `INSERT INTO session_exercises
           (session_id, exercise_id, order_index, circuit_index, circuit_rounds,
            prescribed_reps, prescribed_seconds, prescribed_sets, per_side, as_maximum, hint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId, tEx.exercise_id, tEx.order_index, tEx.circuit_index, tEx.circuit_rounds,
          tEx.prescribed_reps, tEx.prescribed_seconds, tEx.prescribed_sets,
          tEx.per_side, tEx.as_maximum, tEx.hint,
        ],
      );
      const seId = seIns.insertId;

      // Pre-insert empty set rows up to prescribed_sets count
      for (let i = 1; i <= tEx.prescribed_sets; i++) {
        await db.executeSql(
          `INSERT INTO sets (session_exercise_id, set_index) VALUES (?, ?)`,
          [seId, i],
        );
      }
    }
  }

  return weekId;
}

export async function deleteWeek(db: SQLiteDatabase, weekId: number): Promise<void> {
  await db.executeSql(`DELETE FROM weeks WHERE id = ?`, [weekId]);
  // cascades to sessions → session_exercises → sets
}

// ---------- Week / Session reads (2 queries, no N+1) ----------

export async function fetchWeeksByPlan(db: SQLiteDatabase, planId: number): Promise<Week[]> {
  const [weekRes] = await db.executeSql(
    `SELECT w.id AS week_id, w.plan_id, w.created_at, w.finished AS week_finished,
            s.id AS session_id, s.day_index, s.weekday_label, s.session_name,
            s.trained_at, s.finished AS session_finished, s.notes
     FROM weeks w
     LEFT JOIN sessions s ON s.week_id = w.id
     WHERE w.plan_id = ?
     ORDER BY w.created_at DESC, s.day_index ASC`,
    [planId],
  );

  const weekMap = new Map<number, Week>();
  const sessionIds: number[] = [];
  for (const row of weekRes.rows.raw()) {
    let week = weekMap.get(row.week_id);
    if (!week) {
      week = {
        id: row.week_id,
        plan_id: row.plan_id,
        created_at: row.created_at,
        finished: row.week_finished,
        sessions: [],
      };
      weekMap.set(row.week_id, week);
    }
    if (row.session_id != null) {
      week.sessions.push({
        id: row.session_id,
        week_id: row.week_id,
        day_index: row.day_index,
        weekday_label: row.weekday_label,
        session_name: row.session_name,
        trained_at: row.trained_at,
        finished: row.session_finished,
        notes: row.notes,
        exercises: [], // filled in next query
      });
      sessionIds.push(row.session_id);
    }
  }

  if (sessionIds.length === 0) return Array.from(weekMap.values());

  const placeholders = sessionIds.map(() => '?').join(',');
  const [seRes] = await db.executeSql(
    `SELECT se.id AS se_id, se.session_id, se.exercise_id, se.order_index,
            se.circuit_index, se.circuit_rounds, se.prescribed_reps, se.prescribed_seconds,
            se.prescribed_sets, se.per_side, se.as_maximum, se.hint, se.finished AS se_finished,
            e.slug AS exercise_slug, e.name AS exercise_name, e.video,
            st.id AS set_id, st.set_index, st.weight, st.reps, st.seconds
     FROM session_exercises se
     JOIN exercises e ON e.id = se.exercise_id
     LEFT JOIN sets st ON st.session_exercise_id = se.id
     WHERE se.session_id IN (${placeholders})
     ORDER BY se.session_id, se.order_index, st.set_index`,
    sessionIds,
  );

  // Fold session_exercises + sets back into the session objects
  const seMap = new Map<number, ExerciseInstance>();
  for (const row of seRes.rows.raw()) {
    let se = seMap.get(row.se_id);
    if (!se) {
      se = {
        id: row.se_id,
        session_id: row.session_id,
        exercise_id: row.exercise_id,
        exercise_slug: row.exercise_slug,
        exercise_name: row.exercise_name,
        video: row.video,
        order_index: row.order_index,
        circuit_index: row.circuit_index,
        circuit_rounds: row.circuit_rounds,
        prescribed_reps: row.prescribed_reps,
        prescribed_seconds: row.prescribed_seconds,
        prescribed_sets: row.prescribed_sets,
        per_side: row.per_side,
        as_maximum: row.as_maximum,
        hint: row.hint,
        finished: row.se_finished,
        sets: [],
      };
      seMap.set(row.se_id, se);
      // Attach to the right session
      for (const w of weekMap.values()) {
        const sess = w.sessions.find(x => x.id === row.session_id);
        if (sess) {
          sess.exercises.push(se);
          break;
        }
      }
    }
    if (row.set_id != null) {
      se.sets.push({
        id: row.set_id,
        session_exercise_id: row.se_id,
        set_index: row.set_index,
        weight: row.weight,
        reps: row.reps,
        seconds: row.seconds,
      });
    }
  }

  return Array.from(weekMap.values());
}

export async function fetchWeekById(db: SQLiteDatabase, weekId: number): Promise<Week | null> {
  const [w] = await db.executeSql(`SELECT plan_id FROM weeks WHERE id = ?`, [weekId]);
  if (w.rows.length === 0) return null;
  const planId = w.rows.item(0).plan_id;
  const all = await fetchWeeksByPlan(db, planId);
  return all.find(x => x.id === weekId) ?? null;
}

// ---------- Mutations on sets / session.finished ----------

export async function updateSet(
  db: SQLiteDatabase,
  setId: number,
  patch: {weight?: number | null; reps?: number | null; seconds?: number | null},
): Promise<void> {
  const fields: string[] = [];
  const params: (number | null)[] = [];
  if (patch.weight !== undefined)  { fields.push('weight = ?');  params.push(patch.weight); }
  if (patch.reps !== undefined)    { fields.push('reps = ?');    params.push(patch.reps); }
  if (patch.seconds !== undefined) { fields.push('seconds = ?'); params.push(patch.seconds); }
  if (fields.length === 0) return;
  params.push(setId);
  await db.executeSql(`UPDATE sets SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function setSessionExerciseFinished(
  db: SQLiteDatabase,
  sessionExerciseId: number,
  finished: boolean,
): Promise<void> {
  await db.executeSql(
    `UPDATE session_exercises SET finished = ? WHERE id = ?`,
    [finished ? 1 : 0, sessionExerciseId],
  );
}

export async function finishSession(db: SQLiteDatabase, sessionId: number): Promise<void> {
  await db.executeSql(
    `UPDATE sessions SET finished = 1, trained_at = datetime('now') WHERE id = ?`,
    [sessionId],
  );

  // Cascade: if all sessions in week are finished, mark week finished
  const [counts] = await db.executeSql(
    `SELECT
       (SELECT COUNT(*) FROM sessions WHERE week_id = (SELECT week_id FROM sessions WHERE id = ?)) AS total,
       (SELECT COUNT(*) FROM sessions WHERE week_id = (SELECT week_id FROM sessions WHERE id = ?) AND finished = 1) AS done`,
    [sessionId, sessionId],
  );
  const {total, done} = counts.rows.item(0);
  if (total === done) {
    await db.executeSql(
      `UPDATE weeks SET finished = 1 WHERE id = (SELECT week_id FROM sessions WHERE id = ?)`,
      [sessionId],
    );
  }
}

// ---------- Statistics ----------

export interface StatsPoint {
  date: string;
  max_weight: number | null;
  max_reps: number | null;
}

export async function fetchExerciseStats(db: SQLiteDatabase, exerciseSlug: string): Promise<StatsPoint[]> {
  const [res] = await db.executeSql(
    `SELECT
       DATE(s_day.trained_at) AS date,
       MAX(s.weight) AS max_weight,
       MAX(CASE WHEN s_ex.per_side = 1 THEN s.reps * 2 ELSE s.reps END) AS max_reps
     FROM sets s
     JOIN session_exercises s_ex ON s.session_exercise_id = s_ex.id
     JOIN sessions s_day         ON s_ex.session_id = s_day.id
     JOIN exercises e            ON s_ex.exercise_id = e.id
     WHERE e.slug = ?
       AND s_day.trained_at IS NOT NULL
       AND (s.weight IS NOT NULL OR s.reps IS NOT NULL)
     GROUP BY DATE(s_day.trained_at)
     ORDER BY date ASC`,
    [exerciseSlug],
  );
  return res.rows.raw();
}

export async function fetchAllExerciseSlugs(db: SQLiteDatabase): Promise<{slug: string; name: string}[]> {
  const [res] = await db.executeSql(`SELECT slug, name FROM exercises ORDER BY name ASC`);
  return res.rows.raw();
}
