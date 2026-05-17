# Workout Warden v2.0 — Design

**Status:** Design approved
**Date:** 2026-05-17
**Bumps app version 1.3.x → 2.0.0**

## Goals

1. **Schema rework**: replace the hardcoded `CHECK IN ('A','B','C')` enums on `workout_programs.type` and the 10-string CHECK on `training_days.day` with a data-driven model that supports arbitrary training plans without schema migrations.
2. **First new plan: "Surf"** — 5-day split. Mon/Fri identical Lower; Wed Lower with Nordic in place of VMO Squat; Tue/Thu Upper Body (Tue/Thu differ only in exercise order).
3. **Structured exercise prescription**: replace ad-hoc text hints with explicit `prescribed_reps` / `prescribed_seconds` / `per_side` / `as_maximum` / `circuit_index` / `circuit_rounds` fields, so Statistics can finally aggregate correctly (e.g. per-side reps doubled).
4. **Single-query reads** in place of the current N+1 cascade in `fetchWeeks` (~3800 queries for 50 weeks of history) and the JS-side reduce in Statistics.
5. **Seed-via-TS-constants**: plan and exercise catalogue live in versioned TS files under `src/seeds/`, applied to the DB on startup via idempotent diff. The 39 KB `src/common/variables.tsx` blob disappears.

## Non-Goals (deferred to v2.5+)

- In-app plan editor (UI for creating/editing plans at runtime). v2.0 ships plans as TS-seed only.
- Rest-period prescription between sets.
- Plan versioning (`plan.version` column, migration on plan-content changes).
- Exercise `archived` flag.
- Multi-user / cloud sync / conflict resolution.
- Background workout timer / push reminders.
- Achievements / streaks.

## Migration Strategy

**Clean slate.** No in-app migration code. The new schema is built fresh on first launch of v2.0. Pre-v2 users either start with empty history or, on developer machines, run the one-shot CLI script `scripts/import-legacy.ts` to port historic data from an exported `warden-exported.db`.

`src/common/migrations.ts` is deleted in v2.0 — the entire `migrate*Table` inspection logic becomes unnecessary because we never need to bridge to the old schema in the app.

## Schema (DDL)

All tables. PRAGMA `foreign_keys = ON` is set in `getDBConnection` before any statement runs — SQLite's default of OFF makes FKs cosmetic otherwise.

### Plan definition (seeded from `src/seeds/`)

```sql
CREATE TABLE plans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE session_templates (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE plan_days (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id             INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  session_template_id INTEGER NOT NULL REFERENCES session_templates(id),
  day_index           INTEGER NOT NULL,
  weekday_label       TEXT,                      -- 'Mon'..'Sun' or NULL; pure UI hint
  UNIQUE(plan_id, day_index)
);

CREATE TABLE session_template_exercises (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_template_id INTEGER NOT NULL REFERENCES session_templates(id) ON DELETE CASCADE,
  exercise_id         INTEGER NOT NULL REFERENCES exercises(id),
  order_index         INTEGER NOT NULL,
  circuit_index       INTEGER,                   -- NULL = standalone; equal int = same circuit
  circuit_rounds      INTEGER,                   -- invariant: same for all rows in same circuit
  prescribed_reps     INTEGER,
  prescribed_seconds  INTEGER,
  prescribed_sets     INTEGER NOT NULL DEFAULT 1 CHECK(prescribed_sets >= 1),
  per_side            BOOLEAN NOT NULL DEFAULT 0,
  as_maximum          BOOLEAN NOT NULL DEFAULT 0, -- "up to X reps/secs"
  hint                TEXT,
  UNIQUE(session_template_id, order_index)
);
```

### Exercise catalogue (seeded)

```sql
CREATE TABLE exercises (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL,
  video TEXT                                       -- YouTube ID
);
```

### Workout history (created at runtime by user actions)

```sql
CREATE TABLE weeks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id    INTEGER NOT NULL REFERENCES plans(id),
  created_at DATETIME DEFAULT (datetime('now')),
  finished   BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id       INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  day_index     INTEGER NOT NULL,                 -- copied from plan_days at creation
  weekday_label TEXT,                              -- snapshot
  session_name  TEXT NOT NULL,                    -- snapshot of session_templates.name
  trained_at    DATETIME,                          -- NULL = not yet completed
  finished      BOOLEAN NOT NULL DEFAULT 0,
  notes         TEXT
);

CREATE TABLE session_exercises (
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

CREATE TABLE sets (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_index           INTEGER NOT NULL,
  weight              REAL,
  reps                INTEGER,
  seconds             INTEGER,
  UNIQUE(session_exercise_id, set_index)
);
```

`sets` are **pre-inserted** at session creation: when a new week is generated from a plan, `prescribed_sets` empty rows are inserted per `session_exercises` row, ready for the user to fill in. Matches v1 behaviour.

### Key-value settings

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- known keys: 'active_plan_id', 'schema_version'
```

`AsyncStorage[TRAINING_TYPE]` is removed; selection lives in the DB now.

### Indices

```sql
CREATE INDEX idx_plan_days_plan ON plan_days(plan_id, day_index);
CREATE INDEX idx_ste_template   ON session_template_exercises(session_template_id, order_index);
CREATE INDEX idx_sessions_week  ON sessions(week_id, day_index);
CREATE INDEX idx_sessions_trained ON sessions(trained_at);     -- Statistics
CREATE INDEX idx_se_session     ON session_exercises(session_id, order_index);
CREATE INDEX idx_se_exercise    ON session_exercises(exercise_id);  -- Statistics
CREATE INDEX idx_sets_se        ON sets(session_exercise_id, set_index);
```

### Design notes & rejected alternatives

- **`weeks` / `sessions`** renamed from v1's `workout_programs` / `training_days` to match UI vocabulary (Bottom Tab "Weeks", Bottom Tab "Sessions"). The old "program" name was always misleading — a row was always one week.
- **Flat `circuit_index` + `circuit_rounds`** on the exercise row, rather than a separate `circuits` table. Invariant ("same circuit_index ⇒ same circuit_rounds") is validated at seed-load time, not by DB constraint. A separate table was considered and rejected for the extra JOIN per read and the 1:1 mapping for standalone exercises (would need 1-element circuits).
- **No exercise-name snapshot in `session_exercises`** — `session_exercises.exercise_id` is a plain FK to `exercises`. Rename of an exercise (e.g. typo fix) propagates to all historic sessions. The user accepted this trade-off; rename-as-typo-fix is more common than rename-as-conceptual-change.
- **`weights REAL?` + `reps INT?` + `seconds INT?`** all nullable on `sets`, rather than three separate tables per set type. Supports any combination (weight-only sled work, bodyweight reps, timed holds, classic weight×reps).
- **`as_maximum BOOLEAN`** replaces the originally-considered `rep_modifier TEXT` enum since the only value would have been `'up_to'`.
- **`ON DELETE CASCADE`** on `weeks → sessions → session_exercises → sets`: deleting a week wipes its history. Matches the existing `deleteWorkoutProgram` behaviour.
- **No CASCADE** on `plans → weeks`: deleting a plan should be `RESTRICT`ed if any week references it (FK without CASCADE = RESTRICT). Prevents accidental history loss.

## Seed Format (TypeScript)

### Layout

```
src/seeds/
├── index.ts             — barrel: { EXERCISES, PLANS }
├── exercises.ts         — Exercise catalogue (every exercise referenced
│                          by any plan in this repo must appear here)
└── plans/
    └── surf.ts          — the new 5-day "Surf" plan
```

Add new plan = add a TS file under `plans/` + register in `index.ts`. No CHECK constraints to extend.

### Shared types (`src/common/types.ts` — replaces `global.d.ts`)

```ts
export interface ExerciseSeed {
  slug: string;
  name: string;
  video?: string;
}

export interface ExercisePrescription {
  exercise_slug: string;
  order_index: number;
  prescribed_sets: number;          // default 1
  prescribed_reps?: number;          // XOR with prescribed_seconds
  prescribed_seconds?: number;
  per_side?: boolean;                // default false
  as_maximum?: boolean;              // default false; "up to X"
  circuit_index?: number;
  circuit_rounds?: number;
  hint?: string;
}

export interface SessionTemplateSeed {
  slug: string;
  name: string;
  exercises: ExercisePrescription[];
}

export interface PlanDaySeed {
  day_index: number;
  weekday_label?: string;            // 'Mon'..'Sun'
  session_template_slug: string;
}

export interface PlanSeed {
  slug: string;
  name: string;
  description?: string;
  session_templates: SessionTemplateSeed[];
  days: PlanDaySeed[];
}
```

### Seed Load Algorithm (`seedDB(db)`)

Called from `initDB` after schema creation. Idempotent:

1. **Exercises**: for each `ExerciseSeed.slug`, `INSERT ... ON CONFLICT(slug) DO UPDATE SET name = excluded.name, video = excluded.video`. Updates harmless metadata; never deletes catalogue entries.
2. **Per plan**: if `plans.slug` doesn't exist, insert it + all referenced `session_templates` + their `session_template_exercises` + `plan_days`. If `plans.slug` exists, only insert missing `session_templates` (by slug) and missing `plan_days`. **Existing session-template content (exercises within an already-present template slug) is never modified by seedDB.** This is intentional: updating a plan's content means choosing a new template slug, so old weeks (which referenced the old template at copy-time) keep their semantics. To roll out a content change to users, bump the template slug in TS (`surf-lower-mon-fri` → `surf-lower-mon-fri-v2`) and update the relevant `plan_days` entries.
3. **Validation** (before insert, throws): every `exercise_slug` is in catalogue; every prescription has reps XOR seconds; all rows in the same `circuit_index` share `circuit_rounds`; `order_index` is dense and starts at 1; every plan_day's `session_template_slug` is defined in the same file.

### Surf Plan Definition (`src/seeds/plans/surf.ts`)

```ts
import type {PlanSeed} from '../../common/types';

const lowerMonFri = {
  slug: 'surf-lower-mon-fri',
  name: 'Lower Body',
  exercises: [
    {exercise_slug: 'backward-walking', order_index: 1, prescribed_sets: 1, prescribed_seconds: 600},
    {exercise_slug: 'tibialis-raise', order_index: 2, prescribed_sets: 1, prescribed_reps: 25, as_maximum: true, circuit_index: 1, circuit_rounds: 2},
    {exercise_slug: 'straight-leg-calf-raise', order_index: 3, prescribed_sets: 1, prescribed_reps: 20, circuit_index: 1, circuit_rounds: 2},
    {exercise_slug: 'bent-leg-calf-raise', order_index: 4, prescribed_sets: 1, prescribed_reps: 20, circuit_index: 1, circuit_rounds: 2},
    {exercise_slug: 'reverse-step-up', order_index: 5, prescribed_sets: 1, prescribed_reps: 5, per_side: true, circuit_index: 2, circuit_rounds: 5},
    {exercise_slug: 'atg-split-squat', order_index: 6, prescribed_sets: 1, prescribed_reps: 5, per_side: true, circuit_index: 2, circuit_rounds: 5},
    {exercise_slug: 'vmo-squat', order_index: 7, prescribed_sets: 2, prescribed_reps: 20, as_maximum: true},
    {exercise_slug: 'big-toe-stretch', order_index: 8, prescribed_sets: 1, prescribed_seconds: 30, circuit_index: 3, circuit_rounds: 2},
    {exercise_slug: 'l-sit-progression', order_index: 9, prescribed_sets: 1, prescribed_seconds: 20, circuit_index: 3, circuit_rounds: 2},
    {exercise_slug: 'couch-stretch', order_index: 10, prescribed_sets: 1, prescribed_seconds: 60, per_side: true, circuit_index: 3, circuit_rounds: 2},
    {exercise_slug: 'elephant-walk', order_index: 11, prescribed_sets: 1, prescribed_reps: 20, per_side: true, circuit_index: 3, circuit_rounds: 2},
    {exercise_slug: 'pigeon-pushup', order_index: 12, prescribed_sets: 1, prescribed_reps: 20, per_side: true, circuit_index: 3, circuit_rounds: 2},
    {exercise_slug: 'resting-squat', order_index: 13, prescribed_sets: 1, prescribed_seconds: 30, circuit_index: 3, circuit_rounds: 2},
  ],
};

// The three remaining templates are abbreviated in this spec — full exercise
// arrays will be transcribed from the user's screenshots during implementation.
// `lowerWed` is `lowerMonFri` with order_index 7 swapped:
//   VMO Squat (sets:2, reps:20, as_maximum) → Nordic (sets:2, reps:5)
// `upperTue` and `upperThu` share the same 11-exercise composition (Backward
// Walking, Band Pull-Apart, ATG Pushup×2 circuit, ATG Row, Band Overhead Press,
// Superman×2 circuit with Seated Goodmorning/QL Extension/Wall Pullover,
// Calf Stretch×2 circuit with Standing Pancake Pulse and Couch Stretch);
// `upperThu` differs only in the order of two exercises within the same circuit.

const lowerWed = { slug: 'surf-lower-wed', name: 'Lower Body (Nordic)', exercises: [/* see note above */] };
const upperTue = { slug: 'surf-upper-tue', name: 'Upper Body + Stretching', exercises: [/* see note above */] };
const upperThu = { slug: 'surf-upper-thu', name: 'Upper Body + Stretching', exercises: [/* see note above */] };

export const SURF: PlanSeed = {
  slug: 'surf',
  name: 'Surf',
  description: '5-day strength + mobility companion for surfing',
  session_templates: [lowerMonFri, lowerWed, upperTue, upperThu],
  days: [
    {day_index: 1, weekday_label: 'Mon', session_template_slug: 'surf-lower-mon-fri'},
    {day_index: 2, weekday_label: 'Tue', session_template_slug: 'surf-upper-tue'},
    {day_index: 3, weekday_label: 'Wed', session_template_slug: 'surf-lower-wed'},
    {day_index: 4, weekday_label: 'Thu', session_template_slug: 'surf-upper-thu'},
    {day_index: 5, weekday_label: 'Fri', session_template_slug: 'surf-lower-mon-fri'},
  ],
};
```

## Query Rewrites

### Statistics — single SQL, correct per-side

Replaces `Statistics.tsx:33-58` JS reduce loop:

```sql
SELECT
  s_day.trained_at                                       AS date,
  MAX(s.weight)                                          AS max_weight,
  MAX(CASE WHEN s_ex.per_side = 1 THEN s.reps * 2
           ELSE s.reps END)                              AS max_reps
FROM sets s
JOIN session_exercises s_ex ON s.session_exercise_id = s_ex.id
JOIN sessions s_day         ON s_ex.session_id = s_day.id
JOIN exercises e            ON s_ex.exercise_id = e.id
WHERE e.slug = ?
  AND s_day.trained_at IS NOT NULL
  AND (s.weight IS NOT NULL OR s.reps IS NOT NULL)
GROUP BY DATE(s_day.trained_at)
ORDER BY date ASC;
```

UI feeds result directly to `victory-native` `CartesianChart`. `DATE()` rolls up multiple same-day sessions into one bar. `max_reps` is computed but only `max_weight` is plotted in v2.0 — the column is selected so the UI can switch chart metric later without a query change.

### fetchWeeks — N+1 cascade → 2 queries

The old `fetchWeeks → fetchTrainingDays → fetchExercisesForTrainingDay → fetchSetsForExercise` chain produced ~3851 queries for 50 weeks. Replaced by:

```sql
-- Query 1: weeks + their sessions
SELECT w.id AS week_id, w.created_at, w.finished AS week_finished,
       s.id AS session_id, s.day_index, s.weekday_label, s.session_name, s.trained_at, s.finished AS session_finished
FROM weeks w
LEFT JOIN sessions s ON s.week_id = w.id
WHERE w.plan_id = ?
ORDER BY w.created_at DESC, s.day_index ASC;

-- Query 2: all session_exercises + their sets for a set of session IDs
SELECT s_ex.id AS se_id, s_ex.session_id, s_ex.order_index, s_ex.circuit_index, s_ex.circuit_rounds,
       s_ex.prescribed_reps, s_ex.prescribed_seconds, s_ex.prescribed_sets, s_ex.per_side, s_ex.as_maximum,
       s_ex.hint, s_ex.finished,
       e.slug AS exercise_slug, e.name AS exercise_name, e.video,
       st.id AS set_id, st.set_index, st.weight, st.reps, st.seconds
FROM session_exercises s_ex
JOIN exercises e ON s_ex.exercise_id = e.id
LEFT JOIN sets st ON st.session_exercise_id = s_ex.id
WHERE s_ex.session_id IN (?, ?, ...)
ORDER BY s_ex.session_id, s_ex.order_index, st.set_index;
```

JS-side: fold rows into nested `Week[] → Session[] → ExerciseInstance[] → SetLog[]` shape.

## CLI Import Script

**File:** `scripts/import-legacy.ts` — runs on Node with `better-sqlite3`, not on device.

**Invocation:**
```
npx tsx scripts/import-legacy.ts <source.db> <target.db>
```

Default args resolve to `~/Downloads/warden-exported.db` and `./warden.db` respectively.

**Algorithm:**
1. Open both DBs. Wrap target writes in a single transaction.
2. In target: ensure `plans` has `{slug:'legacy', name:'Standard (Legacy)'}` (created dynamically — NOT seeded from the repo).
3. For each of the 5 distinct `training_days.day` strings: insert `session_templates {slug: slugify(day), name: day}`. Insert `plan_days {plan_id:legacy, day_index:1..5, session_template_id, weekday_label:NULL}`.
4. For each `exercises` row in source: `INSERT INTO exercises {slug:slugify(name), name, video} ON CONFLICT(slug) DO NOTHING`.
5. For each `workout_programs` row: insert `weeks {plan_id:legacy, created_at:source.start_date, finished:source.finished}`. Track `old_program_id → new_week_id` map.
6. For each `training_days` row: insert `sessions {week_id, day_index, weekday_label:NULL, session_name:day, trained_at:source_program.end_date, finished:source.finished}`. `day_index` is resolved by sorting the 5 distinct day strings alphabetically and taking the 1-based position — stable across imports. Track `old_td_id → new_session_id`.
7. For each `training_day_exercises`: insert `session_exercises {session_id, exercise_id, order_index:auto-increment per session, prescribed_sets:COUNT(sets), prescribed_reps:NULL, per_side:false, finished:source.finished}`. Track `old_tde_id → new_se_id`.
8. For each `sets`: insert `sets {session_exercise_id, set_index:ROW_NUMBER() OVER (PARTITION BY tde_id), weight, reps, seconds:NULL}`.
9. Commit. Print summary: `Imported N weeks, M sessions, K session_exercises, L sets.`

Result `.db` is then deployable via `adb push` or the in-app Import button.

Lost in translation (acceptable):
- No prescription info (`prescribed_reps`, `per_side`, `as_maximum`, `circuit_index`) — old schema didn't have it.
- No `seconds` column data — old schema only had `weight`/`reps`.
- No session-level notes — old schema didn't have them.

Result: Statistics correctly shows historical max-weight-by-date, per-side info missing (treats as plain reps), no circuit grouping in the legacy weeks UI.

## App Code Changes (summary)

| File | Change |
|---|---|
| `src/common/databaseService.ts` | Full rewrite. New schema-init, `PRAGMA foreign_keys = ON`, `seedDB()` replaces `createExercises`+`addMissingExercises`, all CRUD against new tables, new JOINed reads. |
| `src/common/migrations.ts` | **Delete.** |
| `src/common/variables.tsx` | **Delete.** Demotivational quotes move to `src/common/quotes.ts`. Plan/exercise content moves to `src/seeds/`. |
| `src/common/types.ts` | New (replaces `global.d.ts` ambient types). All interfaces explicit + exported. |
| `src/seeds/index.ts` | New. Exports `EXERCISES` + `PLANS`. |
| `src/seeds/exercises.ts` | New. Catalogue. |
| `src/seeds/plans/surf.ts` | New. The 5-day plan. |
| `src/Routes.tsx` | Dynamic tabs: read `active_plan_id` from `settings`, fetch `plan_days`, render one `SubTab.Screen` per day. Removes hardcoded `WeeklyTrainingTabs`/`SurfWeeklyTrainingTabs` split. |
| `src/screens/Weeks.tsx` | Top tabs are now one per plan in `plans`. Plan selection persists to `settings.active_plan_id`. |
| `src/screens/Session.tsx` | Uses new query shape. `handleFinish` sets `sessions.trained_at = datetime('now')`. |
| `src/screens/Statistics.tsx` | Single SQL query replaces JS reduce; correct per-side aggregation. |
| `src/components/Exercise.tsx` | Renders circuit grouping (UI wrapper for exercises sharing `circuit_index`, with "× N rounds" badge). |
| `src/App.tsx` | Removes `AsyncStorage[TRAINING_TYPE]` read. |
| `package.json` | Adds `better-sqlite3` and `tsx` to devDependencies (for CLI script only). Version bump to `2.0.0`. Android `versionCode` increment in `android/app/build.gradle` via existing `version-update.sh`. |

## Out of v2.0 (revisit later)

- In-app plan editor / duplication
- Plan versioning
- Rest periods
- Workout-day rescheduling UI ("move this session to Saturday")
- Multi-user / sync
- Achievements / streaks
- Background timer / push notifications
