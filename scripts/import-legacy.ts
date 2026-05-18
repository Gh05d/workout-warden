// scripts/import-legacy.ts
import Database from 'better-sqlite3';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {slugify} from '../src/common/slugify';

const [, , sourceArg, targetArg] = process.argv;
const sourcePath = resolve(sourceArg ?? `${process.env.HOME}/Downloads/warden-exported.db`);
const targetPath = resolve(targetArg ?? './warden.db');

console.log(`source: ${sourcePath}\ntarget: ${targetPath}`);

const src = new Database(sourcePath, {readonly: true});
const dst = new Database(targetPath);

dst.pragma('foreign_keys = ON');

// 1. Build target schema if empty (lets us point at a fresh file)
const SCHEMA: string[] = readFileSync(resolve(__dirname, './schema-v2.sql'), 'utf8')
  // Strip line comments first so they don't bleed into the first statement
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0);
for (const stmt of SCHEMA) {
  dst.exec(stmt);
}

const txn = dst.transaction(() => {
  // 2. Ensure 'legacy' plan
  let planRow = dst.prepare(`SELECT id FROM plans WHERE slug = 'legacy'`).get() as
    | {id: number}
    | undefined;
  if (!planRow) {
    const r = dst
      .prepare(
        `INSERT INTO plans (slug, name, description) VALUES ('legacy', 'Standard (Legacy)', 'Imported from v1 warden-exported.db')`,
      )
      .run();
    planRow = {id: Number(r.lastInsertRowid)};
  }
  const planId = planRow.id;

  // Idempotency guard: re-running on a target that already has imported history
  // would silently double the data (weeks/sessions/sets are blind INSERTs below).
  // Refuse to proceed unless --force is passed.
  const existingWeeks = (
    dst.prepare(`SELECT COUNT(*) AS n FROM weeks WHERE plan_id = ?`).get(planId) as {n: number}
  ).n;
  if (existingWeeks > 0 && !process.argv.includes('--force')) {
    throw new Error(
      `Target DB already contains ${existingWeeks} weeks for the 'legacy' plan. ` +
        `Refusing to import to avoid duplicating data. Pass --force to import anyway, ` +
        `or delete the target file and re-run.`,
    );
  }

  // 3. Distinct days from source → session_templates + plan_days
  const distinctDays: {day: string}[] = src
    .prepare(`SELECT DISTINCT day FROM training_days ORDER BY day ASC`)
    .all() as {day: string}[];
  const tplIdByDay = new Map<string, number>();
  let dayIndex = 1;
  for (const {day} of distinctDays) {
    const slug = slugify(day);
    let tpl = dst
      .prepare(`SELECT id FROM session_templates WHERE slug = ?`)
      .get(slug) as {id: number} | undefined;
    if (!tpl) {
      const r = dst
        .prepare(`INSERT INTO session_templates (slug, name) VALUES (?, ?)`)
        .run(slug, day);
      tpl = {id: Number(r.lastInsertRowid)};
    }
    tplIdByDay.set(day, tpl.id);

    const existing = dst
      .prepare(`SELECT id FROM plan_days WHERE plan_id = ? AND day_index = ?`)
      .get(planId, dayIndex);
    if (!existing) {
      dst
        .prepare(
          `INSERT INTO plan_days (plan_id, session_template_id, day_index, weekday_label) VALUES (?, ?, ?, NULL)`,
        )
        .run(planId, tpl.id, dayIndex);
    }
    dayIndex++;
  }

  // 4. Exercises: upsert into target catalogue
  const srcExercises = src
    .prepare(`SELECT id, name, video FROM exercises`)
    .all() as {id: number; name: string; video: string | null}[];
  const exIdMap = new Map<number, number>();
  for (const ex of srcExercises) {
    const slug = slugify(ex.name);
    const r = dst
      .prepare(
        `INSERT INTO exercises (slug, name, video) VALUES (?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET video = COALESCE(excluded.video, exercises.video)
         RETURNING id`,
      )
      .get(slug, ex.name, ex.video) as {id: number};
    exIdMap.set(ex.id, r.id);
  }

  // 5. Workout programs → weeks
  const srcPrograms = src
    .prepare(`SELECT id, start_date, end_date, finished FROM workout_programs ORDER BY id ASC`)
    .all() as {id: number; start_date: string; end_date: string; finished: number}[];
  const weekIdMap = new Map<number, number>();
  const insWeek = dst.prepare(
    `INSERT INTO weeks (plan_id, created_at, finished) VALUES (?, ?, ?)`,
  );
  for (const p of srcPrograms) {
    const r = insWeek.run(planId, p.start_date, p.finished);
    weekIdMap.set(p.id, Number(r.lastInsertRowid));
  }

  // 6. training_days → sessions
  const srcTd = src
    .prepare(
      `SELECT id, workout_program_id, day, finished FROM training_days ORDER BY workout_program_id, id`,
    )
    .all() as {id: number; workout_program_id: number; day: string; finished: number}[];
  const sessionIdMap = new Map<number, number>();
  const insSession = dst.prepare(
    `INSERT INTO sessions (week_id, day_index, weekday_label, session_name, trained_at, finished) VALUES (?, ?, NULL, ?, ?, ?)`,
  );
  const programEndDates = new Map<number, string>(srcPrograms.map(p => [p.id, p.end_date]));
  const dayIndexByName = new Map<string, number>(
    [...distinctDays].map(({day}, i) => [day, i + 1]),
  );
  for (const td of srcTd) {
    const weekId = weekIdMap.get(td.workout_program_id)!;
    const di = dayIndexByName.get(td.day)!;
    const trainedAt = programEndDates.get(td.workout_program_id) ?? null;
    const r = insSession.run(weekId, di, td.day, trainedAt, td.finished);
    sessionIdMap.set(td.id, Number(r.lastInsertRowid));
  }

  // 7. training_day_exercises → session_exercises
  const srcTde = src
    .prepare(
      `SELECT tde.id, tde.training_day_id, tde.exercise_id, tde.finished,
              (SELECT COUNT(*) FROM sets s WHERE s.training_day_exercise_id = tde.id) AS set_count
       FROM training_day_exercises tde
       ORDER BY tde.training_day_id, tde.id`,
    )
    .all() as {
    id: number;
    training_day_id: number;
    exercise_id: number;
    finished: number;
    set_count: number;
  }[];
  const seIdMap = new Map<number, number>();
  const insSe = dst.prepare(
    `INSERT INTO session_exercises
       (session_id, exercise_id, order_index, prescribed_sets, finished)
     VALUES (?, ?, ?, ?, ?)`,
  );
  let lastTrainingDayId = -1;
  let orderIndex = 0;
  for (const tde of srcTde) {
    if (tde.training_day_id !== lastTrainingDayId) {
      lastTrainingDayId = tde.training_day_id;
      orderIndex = 0;
    }
    orderIndex++;
    const sessionId = sessionIdMap.get(tde.training_day_id)!;
    const exerciseId = exIdMap.get(tde.exercise_id)!;
    const r = insSe.run(sessionId, exerciseId, orderIndex, Math.max(1, tde.set_count), tde.finished);
    seIdMap.set(tde.id, Number(r.lastInsertRowid));
  }

  // 8. sets → sets
  const srcSets = src
    .prepare(
      `SELECT id, training_day_exercise_id, weight, reps FROM sets ORDER BY training_day_exercise_id, id`,
    )
    .all() as {id: number; training_day_exercise_id: number; weight: number | null; reps: number | null}[];
  const insSet = dst.prepare(
    `INSERT INTO sets (session_exercise_id, set_index, weight, reps, seconds) VALUES (?, ?, ?, ?, NULL)`,
  );
  let lastTde = -1;
  let setIndex = 0;
  for (const s of srcSets) {
    if (s.training_day_exercise_id !== lastTde) {
      lastTde = s.training_day_exercise_id;
      setIndex = 0;
    }
    setIndex++;
    const seId = seIdMap.get(s.training_day_exercise_id)!;
    insSet.run(seId, setIndex, s.weight, s.reps);
  }

  console.log(
    `Imported ${srcPrograms.length} weeks, ${srcTd.length} sessions, ${srcTde.length} session_exercises, ${srcSets.length} sets.`,
  );
});

txn();

src.close();
dst.close();
console.log('Done.');
