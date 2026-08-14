# Calorie Estimation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Approximate calorie burn (BMR-corrected MET formula) for logged activities and finished plan workouts, snapshotted per row, driven by a user profile, surfaced on Home / Activities / Statistics.

**Architecture:** A pure calculation module (`src/common/calories.ts`) + profile stored as `settings` key/value rows + a nullable `kcal INTEGER` snapshot column on `activity_sessions` and `sessions`, written at save/finish time and backfilled (gaps only) when the profile is saved. UI: a ProfileModal bottom sheet opened from Home's DATA MANAGEMENT area, a "TODAY ~N KCAL" line on Home, per-entry/per-week kcal on Activities, an all-time totals block on Statistics.

**Tech Stack:** React Native 0.85 / TypeScript, react-native-sqlite-storage, Jest + better-sqlite3 (DB tests against `scripts/schema-v2.sql`).

**Spec:** `docs/superpowers/specs/2026-08-14-calorie-estimation-design.md`

## Global Constraints

- Yarn berry is broken in this repo. Run tools as `node_modules/.bin/jest`, `node_modules/.bin/eslint`, `node_modules/.bin/tsc` (or `npm test -- <path>`). Never `yarn <cmd>`.
- Prettier is an ESLint error: `singleQuote`, `bracketSpacing: false`, `bracketSameLine: true`, `arrowParens: 'avoid'`, `trailingComma: 'all'`.
- No new hex literals in components — use `colors` tokens from `src/common/theme.ts`. Tactical Logbook style: ALL-CAPS labels, `letterSpacing: 1.4–2`, square corners, 1px `colors.rule` borders.
- Every rendered kcal value carries a `~` prefix (approximation marker). kcal is always a rounded integer; `NULL` means "unknown", never 0.
- `scripts/schema-v2.sql` must mirror every runtime `SCHEMA` change, or DB tests fail.
- No `SEED_REVISION` bump anywhere in this plan (no plan content changes).
- Numeric `TextInput`s need `paddingVertical: 0`, `textAlignVertical: 'center'`, `includeFontPadding: false` (Android clipping).
- Errors while a `<Modal>` is open must render inside the Modal subtree.
- `Home.tsx`'s `refresh()` has TWO `Promise.all` fan-outs (normal + self-heal). Every fetch added to one must be added to both.
- `tsc --noEmit` is NOT clean on this repo. Per-task checks are scoped greps by file path; `__tests__/` jest-typing noise (TS2304/TS2593/TS2708) is expected and exempt. Task 11 runs the full diff-vs-HEAD procedure.
- Commit messages end with the trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Pure calorie module

**Files:**
- Modify: `src/common/types.ts` (add `UserProfile`, export it)
- Create: `src/common/calories.ts`
- Test: `__tests__/calories.test.ts`

**Interfaces:**
- Consumes: `ACTIVITIES` from `src/seeds/activities.ts` (test only).
- Produces (later tasks import these from `../common/calories` / `./calories`):
  - `type UserProfile = {weightKg: number; heightCm: number; birthYear: number; sex: 'male' | 'female'; sessionMinutes: number}` (from `types.ts`)
  - `ACTIVITY_MET: Record<string, number>`, `DEFAULT_ACTIVITY_MET: number`, `STRENGTH_MET: number`
  - `activityMet(slug: string): number`
  - `bmrKcalPerDay(profile: UserProfile, currentYear: number): number`
  - `estimateKcal(met: number, minutes: number | null, profile: UserProfile | null, currentYear: number): number | null`
  - `formatKcal(n: number): string`

- [ ] **Step 1: Add `UserProfile` to `src/common/types.ts`**

Insert after the `ActivitySeed` interface (line 53):

```ts
/** Body profile driving calorie estimation. Stored as settings rows
 * (profile_* keys); birthYear instead of age so it never goes stale. */
interface UserProfile {
  weightKg: number;
  heightCm: number;
  birthYear: number;
  sex: 'male' | 'female';
  /** Flat duration assumed for one finished plan workout. Default 60. */
  sessionMinutes: number;
}
```

Add `UserProfile,` to the `export type {...}` block at the bottom (after `ActivitySessionDraft,`).

- [ ] **Step 2: Write the failing test**

Create `__tests__/calories.test.ts`:

```ts
import {
  ACTIVITY_MET,
  activityMet,
  bmrKcalPerDay,
  DEFAULT_ACTIVITY_MET,
  estimateKcal,
  formatKcal,
  STRENGTH_MET,
} from '../src/common/calories';
import {ACTIVITIES} from '../src/seeds/activities';
import type {UserProfile} from '../src/common/types';

const MALE: UserProfile = {
  weightKg: 80,
  heightCm: 180,
  birthYear: 1990,
  sex: 'male',
  sessionMinutes: 60,
};
const FEMALE: UserProfile = {
  weightKg: 60,
  heightCm: 165,
  birthYear: 1992,
  sex: 'female',
  sessionMinutes: 60,
};

describe('bmrKcalPerDay (revised Harris-Benedict)', () => {
  it('male: 80kg/180cm/age 36', () => {
    // 88.362 + 13.397*80 + 4.799*180 - 5.677*36
    expect(bmrKcalPerDay(MALE, 2026)).toBeCloseTo(1819.57, 2);
  });

  it('female: 60kg/165cm/age 34', () => {
    // 447.593 + 9.247*60 + 3.098*165 - 4.330*34
    expect(bmrKcalPerDay(FEMALE, 2026)).toBeCloseTo(1366.36, 2);
  });
});

describe('estimateKcal', () => {
  it('MET 4.0 for 90 min, male profile → 455', () => {
    // 4.0 * (1819.57/24) * 1.5 = 454.89…
    expect(estimateKcal(4.0, 90, MALE, 2026)).toBe(455);
  });

  it('MET 5.0 for 60 min, female profile → 285', () => {
    expect(estimateKcal(5.0, 60, FEMALE, 2026)).toBe(285);
  });

  it('returns null without a profile', () => {
    expect(estimateKcal(4.0, 90, null, 2026)).toBeNull();
  });

  it('returns null without a duration', () => {
    expect(estimateKcal(4.0, null, MALE, 2026)).toBeNull();
    expect(estimateKcal(4.0, 0, MALE, 2026)).toBeNull();
  });
});

describe('MET table', () => {
  it('covers every seeded activity slug', () => {
    for (const a of ACTIVITIES) {
      expect(ACTIVITY_MET[a.slug]).toBeGreaterThan(0);
    }
  });

  it('falls back to the default for unknown slugs', () => {
    expect(activityMet('spikeball')).toBe(DEFAULT_ACTIVITY_MET);
    expect(activityMet('surf')).toBe(ACTIVITY_MET.surf);
  });

  it('has a strength MET', () => {
    expect(STRENGTH_MET).toBeGreaterThan(0);
  });
});

describe('formatKcal', () => {
  it('renders small totals verbatim', () => {
    expect(formatKcal(455)).toBe('455');
    expect(formatKcal(9999)).toBe('9999');
  });

  it('compacts totals from 10k up', () => {
    expect(formatKcal(123456)).toBe('123.5K');
    expect(formatKcal(10000)).toBe('10.0K');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node_modules/.bin/jest __tests__/calories.test.ts`
Expected: FAIL — `Cannot find module '../src/common/calories'`.

- [ ] **Step 4: Write the implementation**

Create `src/common/calories.ts`:

```ts
// src/common/calories.ts
//
// Pure calorie approximation: BMR-corrected MET formula. No RN imports so it
// runs unmocked under Jest (same rationale as activityStats/heatmapMath).
//
// kcal = MET × (BMR / 24) × hours — i.e. one hour at MET 1 equals one hour of
// resting metabolism. BMR via revised Harris-Benedict (Roza & Shizgal 1984).
// The result is an approximation by design; rendered values carry a ~ prefix.

import type {UserProfile} from './types';

/** MET per activity slug. Deliberately TS constants, not a seed/DB field:
 * kcal is computed in JS at write time, so a seed column would be migration
 * machinery with no consumer. calories.test.ts keeps this map in sync with
 * the ACTIVITIES seed. */
export const ACTIVITY_MET: Record<string, number> = {
  surf: 4.0,
  altinha: 5.0,
};

export const DEFAULT_ACTIVITY_MET = 4.0;

/** Resistance training including rests between sets. */
export const STRENGTH_MET = 4.0;

export function activityMet(slug: string): number {
  return ACTIVITY_MET[slug] ?? DEFAULT_ACTIVITY_MET;
}

export function bmrKcalPerDay(
  profile: UserProfile,
  currentYear: number,
): number {
  const age = currentYear - profile.birthYear;
  return profile.sex === 'male'
    ? 88.362 +
        13.397 * profile.weightKg +
        4.799 * profile.heightCm -
        5.677 * age
    : 447.593 +
        9.247 * profile.weightKg +
        3.098 * profile.heightCm -
        4.33 * age;
}

/** Rounded kcal for `minutes` at `met`, or null when profile/duration is
 * missing — NULL means "unknown", never 0. */
export function estimateKcal(
  met: number,
  minutes: number | null,
  profile: UserProfile | null,
  currentYear: number,
): number | null {
  if (profile == null || minutes == null || minutes <= 0) return null;
  return Math.round(
    ((met * bmrKcalPerDay(profile, currentYear)) / 24) * (minutes / 60),
  );
}

/** '455' or '123.5K' — compact display for large totals. */
export function formatKcal(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node_modules/.bin/jest __tests__/calories.test.ts`
Expected: PASS (all suites).

- [ ] **Step 6: Lint + scoped type check**

Run: `node_modules/.bin/eslint src/common/calories.ts src/common/types.ts`
Expected: no errors.
Run: `node_modules/.bin/tsc --noEmit 2>&1 | grep 'src/common/calories.ts'` — prove the grep can fail first: append `const probe: number = 'x';` to calories.ts, confirm the grep prints the error, then remove that line with an Edit (never `git checkout`). Final run: no output.

- [ ] **Step 7: Commit**

```bash
git add src/common/calories.ts src/common/types.ts __tests__/calories.test.ts
git commit -m "feat(calories): pure BMR-corrected MET module + UserProfile type

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: kcal columns, row types, generic settings helpers

**Files:**
- Modify: `src/common/databaseService.ts` (SCHEMA DDL, seedDB ALTERs, settings helpers, read-path SELECTs/mappings)
- Modify: `scripts/schema-v2.sql`
- Modify: `src/common/types.ts` (`kcal` on `Session` + `ActivitySession`)
- Test: `__tests__/profileService.test.ts` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `getSetting(db: SQLiteDatabase, key: string): Promise<string | null>`
  - `setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void>`
  - `Session.kcal: number | null`, `ActivitySession.kcal: number | null`
  - `activity_sessions.kcal INTEGER` and `sessions.kcal INTEGER` columns exist on fresh installs, upgrades, and in the test schema.

- [ ] **Step 1: Write the failing test**

Create `__tests__/profileService.test.ts` (harness copied per repo convention — activityService/fetchHomeSummary each carry their own):

```ts
// Mock RN-only modules so importing databaseService doesn't blow up under Node/Jest.
jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(),
  SQLiteDatabase: class {},
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DownloadDirectoryPath: '/tmp',
  copyFile: jest.fn(),
}));
jest.mock('react-native', () => ({Alert: {alert: jest.fn()}}));

import Database from 'better-sqlite3';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  fetchActivitySessions,
  fetchHomeSummary,
  getSetting,
  setSetting,
} from '../src/common/databaseService';

const schemaSql = readFileSync(
  resolve(__dirname, '../scripts/schema-v2.sql'),
  'utf8',
)
  .split(/\n--[^\n]*/)
  .join('')
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0);

function makeDb() {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  for (const stmt of schemaSql) raw.exec(stmt);
  raw.exec(
    `INSERT INTO plans (id, slug, name, description) VALUES (1, 'surf', 'Surf', '5-day plan')`,
  );
  raw.exec(`INSERT INTO settings (key, value) VALUES ('active_plan_id', '1')`);
  raw.exec(
    `INSERT INTO activities (id, slug, name) VALUES
       (1, 'surf', 'Surfing'),
       (2, 'altinha', 'Altinha')`,
  );
  return {
    executeSql: async (sql: string, params: unknown[] = []) => {
      const trimmed = sql.trim();
      if (/^(SELECT|PRAGMA)/i.test(trimmed)) {
        const arr = raw.prepare(sql).all(...(params as never[])) as Record<
          string,
          unknown
        >[];
        return [
          {
            rows: {
              length: arr.length,
              item: (i: number) => arr[i],
              raw: () => arr,
            },
            insertId: 0,
          },
        ];
      }
      const info = raw.prepare(sql).run(...(params as never[]));
      return [
        {
          rows: {length: 0, item: () => null, raw: () => []},
          insertId: Number(info.lastInsertRowid),
        },
      ];
    },
    _raw: raw,
  } as never;
}

const rawOf = (db: never) => (db as {_raw: Database.Database})._raw;

describe('settings helpers', () => {
  it('getSetting returns null for a missing key', async () => {
    const db = makeDb();
    expect(await getSetting(db, 'nope')).toBeNull();
  });

  it('setSetting round-trips and overwrites', async () => {
    const db = makeDb();
    await setSetting(db, 'profile_weight_kg', '80');
    expect(await getSetting(db, 'profile_weight_kg')).toBe('80');
    await setSetting(db, 'profile_weight_kg', '82.5');
    expect(await getSetting(db, 'profile_weight_kg')).toBe('82.5');
  });

  it('getSetting still reads keys written by setActivePlanId-style SQL', async () => {
    const db = makeDb();
    expect(await getSetting(db, 'active_plan_id')).toBe('1');
  });
});

describe('kcal columns', () => {
  it('activity_sessions.kcal survives a fetch round-trip', async () => {
    const db = makeDb();
    rawOf(db).exec(
      `INSERT INTO activity_sessions (activity_id, performed_at, duration_minutes, kcal)
       VALUES (1, '2026-08-05', 90, 455)`,
    );
    const [s] = await fetchActivitySessions(db);
    expect(s.kcal).toBe(455);
  });

  it('sessions.kcal is readable via fetchHomeSummary', async () => {
    const db = makeDb();
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, finished, kcal)
       VALUES (10, 1, 1, 'Lower', 1, 303)`,
    );
    const summary = await fetchHomeSummary(db);
    expect(summary!.currentWeek!.sessions[0].kcal).toBe(303);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/jest __tests__/profileService.test.ts`
Expected: FAIL — `getSetting` is not exported, and the raw INSERTs error with `table activity_sessions has no column named kcal`.

- [ ] **Step 3: Add the columns in all three places**

In `src/common/databaseService.ts` SCHEMA, `sessions` table — after `notes         TEXT` add:

```
     notes         TEXT,
     kcal          INTEGER
```

`activity_sessions` table — after `rating           INTEGER,` add:

```
     rating           INTEGER,
     kcal             INTEGER,
```

In `seedDB`, directly after the existing `rating` ALTER block (after line 199), add:

```ts
  try {
    await db.executeSql(`ALTER TABLE activity_sessions ADD COLUMN kcal INTEGER`);
  } catch {
    /* column already exists */
  }
  try {
    await db.executeSql(`ALTER TABLE sessions ADD COLUMN kcal INTEGER`);
  } catch {
    /* column already exists */
  }
```

In `scripts/schema-v2.sql`: mirror both — `sessions` gains `kcal          INTEGER` after `notes         TEXT` (add the comma to notes), `activity_sessions` gains `kcal             INTEGER,` after `rating           INTEGER,`.

- [ ] **Step 4: Add `kcal` to the row types**

In `src/common/types.ts`: `Session` gains `kcal: number | null;` after `notes: string | null;`. `ActivitySession` gains `kcal: number | null; // snapshot, computed at save time` after `rating`. (`ActivitySessionDraft` unchanged — kcal is computed, never passed in.)

- [ ] **Step 5: Plumb `kcal` through the session read paths**

The `Session` type change breaks compilation of every place that builds a `Session` literal; fix each by selecting + mapping the column:

- `hydrateWeeks` (databaseService.ts:574): add `kcal: row.session_kcal,` to the pushed session object.
- `fetchAllWeeks` and `fetchWeeksByPlan` SELECTs: add `s.kcal AS session_kcal` after `s.finished AS session_finished, s.notes` (both queries).
- `fetchHomeSummary` SELECT: add `s.kcal` to the select list; in the `sessions` mapping add `kcal: r.kcal,`.
- `fetchActivitySessions` SELECT: add `s.kcal` after `s.rating` (the rows go out via `res.rows.raw()`, so without the column in the SELECT the new `ActivitySession.kcal` field would silently be `undefined`).

- [ ] **Step 6: Add generic settings helpers and refactor the plan-id pair onto them**

In databaseService.ts, above `fetchActivePlanId`:

```ts
export async function getSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const [res] = await db.executeSql(
    `SELECT value FROM settings WHERE key = ?`,
    [key],
  );
  if (res.rows.length === 0) return null;
  return res.rows.item(0).value as string;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.executeSql(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}
```

Replace the bodies of `fetchActivePlanId` / `setActivePlanId` (no behavior change):

```ts
export async function fetchActivePlanId(
  db: SQLiteDatabase,
): Promise<number | null> {
  const value = await getSetting(db, 'active_plan_id');
  return value == null ? null : Number(value);
}

export async function setActivePlanId(
  db: SQLiteDatabase,
  planId: number,
): Promise<void> {
  await setSetting(db, 'active_plan_id', String(planId));
}
```

- [ ] **Step 7: Run tests to verify they pass — including the untouched suites**

Run: `node_modules/.bin/jest __tests__/profileService.test.ts __tests__/fetchHomeSummary.test.ts __tests__/activityService.test.ts __tests__/seedMigration.test.ts`
Expected: PASS everywhere (seedMigration exercises the new ALTERs against real SQLite).

- [ ] **Step 8: Lint + scoped type check**

Run: `node_modules/.bin/eslint src/common/databaseService.ts src/common/types.ts`
Run: `node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/common/(databaseService|types)\.ts'`
Expected: no output (probe-validate the grep as in Task 1 Step 6).

- [ ] **Step 9: Commit**

```bash
git add src/common/databaseService.ts src/common/types.ts scripts/schema-v2.sql __tests__/profileService.test.ts
git commit -m "feat(calories): kcal snapshot columns + generic settings helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: fetchProfile / saveProfile with gaps-only backfill

**Files:**
- Modify: `src/common/databaseService.ts`
- Test: `__tests__/profileService.test.ts` (extend)

**Interfaces:**
- Consumes: `getSetting`/`setSetting` (Task 2), `activityMet`/`bmrKcalPerDay`/`estimateKcal`/`STRENGTH_MET` (Task 1), `UserProfile` type.
- Produces:
  - `fetchProfile(db: SQLiteDatabase): Promise<UserProfile | null>` — null unless weight/height/birthYear/sex are all set; `sessionMinutes` defaults to 60.
  - `saveProfile(db: SQLiteDatabase, profile: UserProfile): Promise<void>` — writes the 5 keys, then backfills `kcal IS NULL` rows only.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/profileService.test.ts` (extend the import from databaseService with `fetchProfile, saveProfile`, and add `import {estimateKcal, STRENGTH_MET, ACTIVITY_MET} from '../src/common/calories';` plus `import type {UserProfile} from '../src/common/types';`):

```ts
const PROFILE: UserProfile = {
  weightKg: 80,
  heightCm: 180,
  birthYear: 1990,
  sex: 'male',
  sessionMinutes: 60,
};
const YEAR = new Date().getFullYear();

describe('fetchProfile / saveProfile', () => {
  it('returns null when no profile is stored', async () => {
    const db = makeDb();
    expect(await fetchProfile(db)).toBeNull();
  });

  it('returns null while the profile is incomplete', async () => {
    const db = makeDb();
    await setSetting(db, 'profile_weight_kg', '80');
    await setSetting(db, 'profile_height_cm', '180');
    expect(await fetchProfile(db)).toBeNull();
  });

  it('round-trips a saved profile', async () => {
    const db = makeDb();
    await saveProfile(db, PROFILE);
    expect(await fetchProfile(db)).toEqual(PROFILE);
  });

  it('defaults sessionMinutes to 60 when the key is missing', async () => {
    const db = makeDb();
    await setSetting(db, 'profile_weight_kg', '80');
    await setSetting(db, 'profile_height_cm', '180');
    await setSetting(db, 'profile_birth_year', '1990');
    await setSetting(db, 'profile_sex', 'male');
    expect((await fetchProfile(db))!.sessionMinutes).toBe(60);
  });
});

describe('saveProfile backfill (gaps only)', () => {
  it('fills timed activity rows without kcal, per-activity MET', async () => {
    const db = makeDb();
    rawOf(db).exec(
      `INSERT INTO activity_sessions (id, activity_id, performed_at, duration_minutes, kcal) VALUES
         (1, 1, '2026-08-01', 90, NULL),
         (2, 2, '2026-08-02', 60, NULL),
         (3, 1, '2026-08-03', NULL, NULL),
         (4, 1, '2026-08-04', 60, 999)`,
    );
    await saveProfile(db, PROFILE);
    const rows = rawOf(db)
      .prepare(`SELECT id, kcal FROM activity_sessions ORDER BY id`)
      .all() as {id: number; kcal: number | null}[];
    expect(rows[0].kcal).toBe(estimateKcal(ACTIVITY_MET.surf, 90, PROFILE, YEAR));
    expect(rows[1].kcal).toBe(
      estimateKcal(ACTIVITY_MET.altinha, 60, PROFILE, YEAR),
    );
    expect(rows[2].kcal).toBeNull(); // untimed stays unknown
    expect(rows[3].kcal).toBe(999); // existing snapshot untouched
  });

  it('fills finished plan sessions with the flat estimate, skips unfinished', async () => {
    const db = makeDb();
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, finished, kcal) VALUES
         (10, 1, 1, 'Lower', 1, NULL),
         (11, 1, 2, 'Upper', 0, NULL),
         (12, 1, 3, 'Lower', 1, 777)`,
    );
    await saveProfile(db, PROFILE);
    const rows = rawOf(db)
      .prepare(`SELECT id, kcal FROM sessions ORDER BY id`)
      .all() as {id: number; kcal: number | null}[];
    expect(rows[0].kcal).toBe(estimateKcal(STRENGTH_MET, 60, PROFILE, YEAR));
    expect(rows[1].kcal).toBeNull();
    expect(rows[2].kcal).toBe(777);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/jest __tests__/profileService.test.ts`
Expected: FAIL — `fetchProfile` / `saveProfile` not exported.

- [ ] **Step 3: Implement in databaseService.ts**

Add below `setActivePlanId` (new section `// ---------- User profile ----------`). Extend the calories import at the top of the file:

```ts
import {
  activityMet,
  bmrKcalPerDay,
  estimateKcal,
  STRENGTH_MET,
} from './calories';
```

and add `UserProfile` to the `import type {...} from './types'` list.

```ts
const PROFILE_KEYS = {
  weightKg: 'profile_weight_kg',
  heightCm: 'profile_height_cm',
  birthYear: 'profile_birth_year',
  sex: 'profile_sex',
  sessionMinutes: 'profile_session_minutes',
} as const;

export async function fetchProfile(
  db: SQLiteDatabase,
): Promise<UserProfile | null> {
  const [res] = await db.executeSql(
    `SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?, ?)`,
    [
      PROFILE_KEYS.weightKg,
      PROFILE_KEYS.heightCm,
      PROFILE_KEYS.birthYear,
      PROFILE_KEYS.sex,
      PROFILE_KEYS.sessionMinutes,
    ],
  );
  const map = new Map<string, string>();
  for (const row of res.rows.raw()) map.set(row.key, row.value);
  const weightKg = Number(map.get(PROFILE_KEYS.weightKg));
  const heightCm = Number(map.get(PROFILE_KEYS.heightCm));
  const birthYear = Number(map.get(PROFILE_KEYS.birthYear));
  const sex = map.get(PROFILE_KEYS.sex);
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Number.isFinite(heightCm) ||
    heightCm <= 0 ||
    !Number.isFinite(birthYear) ||
    birthYear <= 0 ||
    (sex !== 'male' && sex !== 'female')
  ) {
    return null;
  }
  const sessionMinutes = Number(map.get(PROFILE_KEYS.sessionMinutes));
  return {
    weightKg,
    heightCm,
    birthYear,
    sex,
    sessionMinutes:
      Number.isFinite(sessionMinutes) && sessionMinutes > 0
        ? sessionMinutes
        : 60,
  };
}

/** Persists the profile, then backfills kcal snapshots for rows that never
 * had one (kcal IS NULL). Existing snapshots are deliberately untouched —
 * per-entry kcal is frozen at write time; profile edits only fill gaps. */
export async function saveProfile(
  db: SQLiteDatabase,
  profile: UserProfile,
): Promise<void> {
  await setSetting(db, PROFILE_KEYS.weightKg, String(profile.weightKg));
  await setSetting(db, PROFILE_KEYS.heightCm, String(profile.heightCm));
  await setSetting(db, PROFILE_KEYS.birthYear, String(profile.birthYear));
  await setSetting(db, PROFILE_KEYS.sex, profile.sex);
  await setSetting(
    db,
    PROFILE_KEYS.sessionMinutes,
    String(profile.sessionMinutes),
  );

  const year = new Date().getFullYear();
  const activities = await fetchActivities(db);
  for (const a of activities) {
    const perMinute =
      (activityMet(a.slug) * bmrKcalPerDay(profile, year)) / 24 / 60;
    await db.executeSql(
      `UPDATE activity_sessions
       SET kcal = CAST(ROUND(duration_minutes * ?) AS INTEGER)
       WHERE kcal IS NULL AND duration_minutes IS NOT NULL AND activity_id = ?`,
      [perMinute, a.id],
    );
  }
  const sessionKcal = estimateKcal(
    STRENGTH_MET,
    profile.sessionMinutes,
    profile,
    year,
  );
  await db.executeSql(
    `UPDATE sessions SET kcal = ? WHERE kcal IS NULL AND finished = 1`,
    [sessionKcal],
  );
}
```

Note: `fetchActivities` is defined later in the file — hoisted function declarations, no ordering problem.

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/jest __tests__/profileService.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + scoped type check, then commit**

Run: `node_modules/.bin/eslint src/common/databaseService.ts` and the scoped tsc grep from Task 2 Step 8.

```bash
git add src/common/databaseService.ts __tests__/profileService.test.ts
git commit -m "feat(calories): profile persistence + gaps-only kcal backfill

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: kcal snapshots on activity create/update

**Files:**
- Modify: `src/common/databaseService.ts` (`createActivitySession`, `updateActivitySession`, new private `computeActivityKcal`)
- Test: `__tests__/activityService.test.ts` (extend)

**Interfaces:**
- Consumes: `fetchProfile` (Task 3), `activityMet`/`estimateKcal` (Task 1).
- Produces: `createActivitySession` / `updateActivitySession` keep their existing signatures; every save (re)computes the row's `kcal` from its current duration/activity and the current profile.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/activityService.test.ts` (add `saveProfile` to the databaseService import, plus `import {estimateKcal, ACTIVITY_MET} from '../src/common/calories';` and `import type {UserProfile} from '../src/common/types';`):

```ts
describe('kcal snapshots', () => {
  const PROFILE: UserProfile = {
    weightKg: 80,
    heightCm: 180,
    birthYear: 1990,
    sex: 'male',
    sessionMinutes: 60,
  };
  const YEAR = new Date().getFullYear();

  it('stores null kcal when no profile exists', async () => {
    const db = makeDb();
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 90,
      spot: null,
      note: null,
    });
    const [s] = await fetchActivitySessions(db);
    expect(s.kcal).toBeNull();
  });

  it('computes kcal at create time from duration × profile × activity MET', async () => {
    const db = makeDb();
    await saveProfile(db, PROFILE);
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 90,
      spot: null,
      note: null,
    });
    const [s] = await fetchActivitySessions(db);
    expect(s.kcal).toBe(estimateKcal(ACTIVITY_MET.surf, 90, PROFILE, YEAR));
  });

  it('stores null kcal for untimed entries even with a profile', async () => {
    const db = makeDb();
    await saveProfile(db, PROFILE);
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: null,
      spot: null,
      note: null,
    });
    const [s] = await fetchActivitySessions(db);
    expect(s.kcal).toBeNull();
  });

  it('recomputes kcal on every update (duration and activity changes)', async () => {
    const db = makeDb();
    await saveProfile(db, PROFILE);
    const id = await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 60,
      spot: null,
      note: null,
    });
    await updateActivitySession(db, id, {durationMinutes: 120});
    let [s] = await fetchActivitySessions(db);
    expect(s.kcal).toBe(estimateKcal(ACTIVITY_MET.surf, 120, PROFILE, YEAR));

    await updateActivitySession(db, id, {activityId: 2});
    [s] = await fetchActivitySessions(db);
    expect(s.kcal).toBe(estimateKcal(ACTIVITY_MET.altinha, 120, PROFILE, YEAR));

    await updateActivitySession(db, id, {durationMinutes: null});
    [s] = await fetchActivitySessions(db);
    expect(s.kcal).toBeNull();
  });
});
```

Note: this file's `makeDb` seeds activities with names `Surf`/`Altinha` but the same slugs — the MET lookup is by slug, so the expectations hold.

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/jest __tests__/activityService.test.ts`
Expected: the new `kcal snapshots` tests FAIL (kcal stays null after create-with-profile); pre-existing tests still pass.

- [ ] **Step 3: Implement**

In databaseService.ts, above `createActivitySession`:

```ts
/** Snapshot input: the row's activity MET × its duration × current profile.
 * Null when the profile or duration is missing — never 0. */
async function computeActivityKcal(
  db: SQLiteDatabase,
  activityId: number,
  durationMinutes: number | null,
): Promise<number | null> {
  if (durationMinutes == null) return null;
  const profile = await fetchProfile(db);
  if (profile == null) return null;
  const [res] = await db.executeSql(
    `SELECT slug FROM activities WHERE id = ?`,
    [activityId],
  );
  if (res.rows.length === 0) return null;
  return estimateKcal(
    activityMet(res.rows.item(0).slug),
    durationMinutes,
    profile,
    new Date().getFullYear(),
  );
}
```

`createActivitySession` — compute before the INSERT and add the column:

```ts
export async function createActivitySession(
  db: SQLiteDatabase,
  draft: ActivitySessionDraft,
): Promise<number> {
  const kcal = await computeActivityKcal(
    db,
    draft.activityId,
    draft.durationMinutes,
  );
  const [ins] = await db.executeSql(
    `INSERT INTO activity_sessions (activity_id, performed_at, duration_minutes, spot, note, rating, kcal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.activityId,
      draft.performedAt,
      draft.durationMinutes,
      draft.spot,
      draft.note,
      draft.rating ?? null,
      kcal,
    ],
  );
  return ins.insertId;
}
```

`updateActivitySession` — after the existing field UPDATE (keep the `fields.length === 0` early return), append:

```ts
  // Snapshot refresh: every save recomputes kcal from the row's now-current
  // duration/activity and the current profile.
  const [row] = await db.executeSql(
    `SELECT activity_id, duration_minutes FROM activity_sessions WHERE id = ?`,
    [id],
  );
  if (row.rows.length > 0) {
    const r = row.rows.item(0);
    const kcal = await computeActivityKcal(db, r.activity_id, r.duration_minutes);
    await db.executeSql(`UPDATE activity_sessions SET kcal = ? WHERE id = ?`, [
      kcal,
      id,
    ]);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node_modules/.bin/jest __tests__/activityService.test.ts __tests__/profileService.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + scoped type check, then commit**

```bash
git add src/common/databaseService.ts __tests__/activityService.test.ts
git commit -m "feat(calories): snapshot kcal on activity create/update

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: kcal snapshot on finishSession

**Files:**
- Modify: `src/common/databaseService.ts` (`finishSession`)
- Test: `__tests__/profileService.test.ts` (extend)

**Interfaces:**
- Consumes: `fetchProfile`, `estimateKcal`, `STRENGTH_MET`.
- Produces: `finishSession(db, sessionId)` (signature unchanged) writes `kcal` alongside `finished = 1` / `trained_at`.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/profileService.test.ts` (add `finishSession` to the databaseService import):

```ts
describe('finishSession kcal snapshot', () => {
  it('writes the flat estimate when a profile exists', async () => {
    const db = makeDb();
    await saveProfile(db, {...PROFILE, sessionMinutes: 75});
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name) VALUES (10, 1, 1, 'Lower')`,
    );
    await finishSession(db, 10);
    const row = rawOf(db)
      .prepare(`SELECT finished, kcal FROM sessions WHERE id = 10`)
      .get() as {finished: number; kcal: number | null};
    expect(row.finished).toBe(1);
    expect(row.kcal).toBe(
      estimateKcal(STRENGTH_MET, 75, {...PROFILE, sessionMinutes: 75}, YEAR),
    );
  });

  it('writes null without a profile and still cascades the week', async () => {
    const db = makeDb();
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name) VALUES (10, 1, 1, 'Lower')`,
    );
    await finishSession(db, 10);
    const s = rawOf(db)
      .prepare(`SELECT kcal FROM sessions WHERE id = 10`)
      .get() as {kcal: number | null};
    expect(s.kcal).toBeNull();
    const w = rawOf(db)
      .prepare(`SELECT finished FROM weeks WHERE id = 1`)
      .get() as {finished: number};
    expect(w.finished).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/jest __tests__/profileService.test.ts`
Expected: the first new test FAILS (`kcal` is null); the second passes already — that's fine, it pins the no-profile/cascade behavior.

- [ ] **Step 3: Implement**

Replace the first statement of `finishSession` with:

```ts
  const profile = await fetchProfile(db);
  const kcal = estimateKcal(
    STRENGTH_MET,
    profile?.sessionMinutes ?? null,
    profile,
    new Date().getFullYear(),
  );
  await db.executeSql(
    `UPDATE sessions SET finished = 1, trained_at = datetime('now'), kcal = ? WHERE id = ?`,
    [kcal, sessionId],
  );
```

(The week-cascade block below stays untouched.)

- [ ] **Step 4: Run tests, lint, commit**

Run: `node_modules/.bin/jest __tests__/profileService.test.ts` — PASS.

```bash
git add src/common/databaseService.ts __tests__/profileService.test.ts
git commit -m "feat(calories): snapshot kcal when finishing a plan session

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: fetchTodayKcal + fetchKcalTotals

**Files:**
- Modify: `src/common/databaseService.ts`
- Test: `__tests__/profileService.test.ts` (extend)

**Interfaces:**
- Produces:
  - `fetchTodayKcal(db: SQLiteDatabase, todayIsoDate: string): Promise<number>` — sum of today's `activity_sessions.kcal` (by `performed_at`, already a local date) + today's finished `sessions.kcal` (`DATE(trained_at, 'localtime')`, since `trained_at` is UTC).
  - `interface KcalTotals {training: number; activities: number; total: number}` and `fetchKcalTotals(db: SQLiteDatabase): Promise<KcalTotals>`.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/profileService.test.ts` (add `fetchTodayKcal, fetchKcalTotals` to the import; add `import {isoDate} from '../src/components/heatmapMath';`):

```ts
describe('kcal aggregates', () => {
  it('fetchTodayKcal sums both sources for the given local day', async () => {
    const db = makeDb();
    const today = isoDate(new Date());
    rawOf(db).exec(
      `INSERT INTO activity_sessions (activity_id, performed_at, duration_minutes, kcal) VALUES
         (1, '${today}', 90, 400),
         (1, '${today}', 30, 100),
         (1, '2020-01-01', 60, 999)`,
    );
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, finished, trained_at, kcal) VALUES
         (10, 1, 1, 'Lower', 1, datetime('now'), 300),
         (11, 1, 2, 'Upper', 1, '2020-01-01 10:00:00', 999),
         (12, 1, 3, 'Push', 0, NULL, NULL)`,
    );
    expect(await fetchTodayKcal(db, today)).toBe(800);
  });

  it('fetchTodayKcal returns 0 when nothing is logged', async () => {
    const db = makeDb();
    expect(await fetchTodayKcal(db, isoDate(new Date()))).toBe(0);
  });

  it('fetchKcalTotals sums each source over all time', async () => {
    const db = makeDb();
    rawOf(db).exec(
      `INSERT INTO activity_sessions (activity_id, performed_at, duration_minutes, kcal) VALUES
         (1, '2026-08-01', 90, 400),
         (2, '2026-08-02', NULL, NULL)`,
    );
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, finished, kcal) VALUES
         (10, 1, 1, 'Lower', 1, 300),
         (11, 1, 2, 'Upper', 0, NULL)`,
    );
    expect(await fetchKcalTotals(db)).toEqual({
      training: 300,
      activities: 400,
      total: 700,
    });
  });
});
```

(`DATE(datetime('now'), 'localtime')` always equals `isoDate(new Date())` — both convert the same instant to the same local calendar day — so the today-test is deterministic.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/jest __tests__/profileService.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

In databaseService.ts, in the `// ---------- Statistics ----------` region:

```ts
/** Today's approximate burn: activity snapshots (performed_at is already a
 * local date) + finished plan sessions (trained_at is UTC → 'localtime'). */
export async function fetchTodayKcal(
  db: SQLiteDatabase,
  todayIsoDate: string,
): Promise<number> {
  const [res] = await db.executeSql(
    `SELECT
       (SELECT COALESCE(SUM(kcal), 0) FROM activity_sessions WHERE performed_at = ?)
       +
       (SELECT COALESCE(SUM(kcal), 0) FROM sessions WHERE finished = 1 AND DATE(trained_at, 'localtime') = ?)
       AS total`,
    [todayIsoDate, todayIsoDate],
  );
  return res.rows.item(0).total as number;
}

export interface KcalTotals {
  training: number;
  activities: number;
  total: number;
}

export async function fetchKcalTotals(db: SQLiteDatabase): Promise<KcalTotals> {
  const [res] = await db.executeSql(
    `SELECT
       (SELECT COALESCE(SUM(kcal), 0) FROM sessions) AS training,
       (SELECT COALESCE(SUM(kcal), 0) FROM activity_sessions) AS activities`,
  );
  const r = res.rows.item(0);
  return {
    training: r.training as number,
    activities: r.activities as number,
    total: (r.training as number) + (r.activities as number),
  };
}
```

- [ ] **Step 4: Run tests, lint, commit**

Run: `node_modules/.bin/jest __tests__/profileService.test.ts` — PASS.

```bash
git add src/common/databaseService.ts __tests__/profileService.test.ts
git commit -m "feat(calories): today + all-time kcal aggregate reads

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Week totals + per-entry kcal on Activities

**Files:**
- Modify: `src/components/activityStats.ts` (`ActivityTotals`, `groupByIsoWeek`, `formatTotals`)
- Modify: `src/screens/Activities.tsx` (row meta line)
- Test: `__tests__/activityStats.test.ts` (extend)

**Interfaces:**
- Consumes: `ActivitySession.kcal` (Task 2), populated snapshots (Task 4).
- Produces: `ActivityTotals` gains `kcal: number`; `formatTotals` appends `· ~1240 KCAL` when the week's kcal sum > 0.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/activityStats.test.ts` (reuse that file's existing session-fixture helper if one exists; otherwise build minimal `ActivitySession` literals like the existing tests do, now including `kcal`):

```ts
describe('kcal week totals', () => {
  const base = {
    activity_slug: 'surf',
    activity_name: 'Surf',
    spot: null,
    note: null,
    rating: null,
    created_at: '',
  };

  it('groupByIsoWeek sums kcal per activity, treating null as 0', () => {
    const groups = groupByIsoWeek([
      {...base, id: 1, activity_id: 1, performed_at: '2026-08-04', duration_minutes: 90, kcal: 455},
      {...base, id: 2, activity_id: 1, performed_at: '2026-08-05', duration_minutes: 60, kcal: 300},
      {...base, id: 3, activity_id: 1, performed_at: '2026-08-06', duration_minutes: null, kcal: null},
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].totals[0].kcal).toBe(755);
  });

  it('formatTotals appends the kcal sum when > 0', () => {
    expect(
      formatTotals([
        {activityId: 1, activityName: 'Surf', count: 2, minutes: 150, kcal: 755},
        {activityId: 2, activityName: 'Altinha', count: 1, minutes: 0, kcal: 0},
      ]),
    ).toBe('SURF 2× / 2.5H · ALTINHA 1× · ~755 KCAL');
  });

  it('formatTotals stays unchanged when no kcal is known', () => {
    expect(
      formatTotals([
        {activityId: 1, activityName: 'Surf', count: 1, minutes: 60, kcal: 0},
      ]),
    ).toBe('SURF 1× / 1.0H');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/jest __tests__/activityStats.test.ts`
Expected: new tests FAIL (`totals[0].kcal` undefined; no kcal suffix). Existing tests keep passing.

- [ ] **Step 3: Implement in activityStats.ts**

- `ActivityTotals` gains `kcal: number;`.
- In `groupByIsoWeek`, initialize `kcal: 0` in the new-totals literal and accumulate below `t.minutes += ...`:

```ts
    t.kcal += s.kcal ?? 0;
```

- `formatTotals` becomes (`?? 0` guards older fixtures/callers that predate the field):

```ts
/** 'SURF 3× / 5.0H · ALTINHA 1× · ~1240 KCAL' — hours omitted when nothing
 * was timed, kcal omitted when no snapshot is known. */
export function formatTotals(totals: ActivityTotals[]): string {
  const parts = totals.map(t => {
    const hours = t.minutes > 0 ? ` / ${(t.minutes / 60).toFixed(1)}H` : '';
    return `${t.activityName.toUpperCase()} ${t.count}×${hours}`;
  });
  const kcal = totals.reduce((sum, t) => sum + (t.kcal ?? 0), 0);
  if (kcal > 0) parts.push(`~${kcal} KCAL`);
  return parts.join(' · ');
}
```

- [ ] **Step 4: Show per-entry kcal in the Activities row**

In `src/screens/Activities.tsx`, `SessionRowComp`'s meta row — after the spot text block, add:

```tsx
          {session.kcal != null && (
            <AppText style={styles.rowMetaText}>
              {`~${session.kcal} KCAL`}
            </AppText>
          )}
```

- [ ] **Step 5: Run tests, lint, scoped tsc, commit**

Run: `node_modules/.bin/jest __tests__/activityStats.test.ts` — PASS.
Run: `node_modules/.bin/eslint src/components/activityStats.ts src/screens/Activities.tsx`
Run: `node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/(components/activityStats|screens/Activities)\.ts'` (probe-validate) — no output.

```bash
git add src/components/activityStats.ts src/screens/Activities.tsx __tests__/activityStats.test.ts
git commit -m "feat(activities): kcal per entry + per-week totals

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: ProfileModal + Home wiring

**Files:**
- Create: `src/components/ProfileModal.tsx`
- Modify: `src/screens/Home.tsx`

**Interfaces:**
- Consumes: `UserProfile`, `fetchProfile`, `saveProfile`.
- Produces: `<ProfileModal visible initial error onSave onClose onClearError />`; Home fetches the profile in both fan-outs and exposes a PROFILE button in DATA MANAGEMENT.

- [ ] **Step 1: Create the component**

`src/components/ProfileModal.tsx` — same controlled bottom-sheet pattern as ActivitySessionModal (parent owns visible/error, sheet re-seeds on open, errors render inside the Modal subtree):

```tsx
// src/components/ProfileModal.tsx
//
// Edit sheet for the body profile driving the ~kcal approximation. Same
// controlled bottom-sheet pattern as ActivitySessionModal: the parent owns
// visible/error, the sheet re-seeds its local state each time it opens.

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import AppText from './AppText';
import TacticalButton from './TacticalButton';
import {colors} from '../common/theme';
import type {UserProfile} from '../common/types';

interface Props {
  visible: boolean;
  initial: UserProfile | null;
  error?: string | null;
  onSave: (profile: UserProfile) => void;
  onClose: () => void;
  onClearError: () => void;
}

const SESSION_CHIPS = [45, 60, 75, 90];
const SEXES: {value: 'male' | 'female'; label: string}[] = [
  {value: 'male', label: 'MALE'},
  {value: 'female', label: 'FEMALE'},
];

const ProfileModal: React.FC<Props> = ({
  visible,
  initial,
  error,
  onSave,
  onClose,
  onClearError,
}) => {
  const [weight, setWeight] = React.useState('');
  const [height, setHeight] = React.useState('');
  const [birthYear, setBirthYear] = React.useState('');
  const [sex, setSex] = React.useState<'male' | 'female' | null>(null);
  const [sessionMinutes, setSessionMinutes] = React.useState('60');

  React.useEffect(() => {
    if (!visible) return;
    setWeight(initial ? String(initial.weightKg) : '');
    setHeight(initial ? String(initial.heightCm) : '');
    setBirthYear(initial ? String(initial.birthYear) : '');
    setSex(initial?.sex ?? null);
    setSessionMinutes(String(initial?.sessionMinutes ?? 60));
  }, [visible, initial]);

  const weightKg = parseFloat(weight.replace(',', '.'));
  const heightCm = parseInt(height, 10);
  const birthYearNum = parseInt(birthYear, 10);
  const sessionNum = parseInt(sessionMinutes, 10);
  const currentYear = new Date().getFullYear();

  const valid =
    Number.isFinite(weightKg) &&
    weightKg > 0 &&
    Number.isFinite(heightCm) &&
    heightCm > 0 &&
    Number.isFinite(birthYearNum) &&
    birthYearNum >= 1900 &&
    birthYearNum <= currentYear &&
    sex != null &&
    Number.isFinite(sessionNum) &&
    sessionNum > 0;

  function handleSave() {
    if (!valid || sex == null) return;
    onSave({
      weightKg,
      heightCm,
      birthYear: birthYearNum,
      sex,
      sessionMinutes: sessionNum,
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.body}>
            <AppText bold style={styles.title}>
              PROFILE
            </AppText>
            <AppText style={styles.subtitle}>
              Drives the ~kcal approximation (MET × BMR). Saving fills in
              estimates for past entries that have none.
            </AppText>

            <AppText style={styles.fieldLabel}>WEIGHT (KG)</AppText>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.ghost}
              accessibilityLabel="Weight in kilograms"
              style={styles.numField}
            />

            <AppText style={styles.fieldLabel}>HEIGHT (CM)</AppText>
            <TextInput
              value={height}
              onChangeText={setHeight}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={colors.ghost}
              accessibilityLabel="Height in centimeters"
              style={styles.numField}
            />

            <AppText style={styles.fieldLabel}>BIRTH YEAR</AppText>
            <TextInput
              value={birthYear}
              onChangeText={setBirthYear}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={colors.ghost}
              accessibilityLabel="Birth year"
              style={styles.numField}
            />

            <AppText style={styles.fieldLabel}>SEX</AppText>
            <View style={styles.pillRow}>
              {SEXES.map(s => {
                const selected = sex === s.value;
                return (
                  <Pressable
                    key={s.value}
                    onPress={() => setSex(s.value)}
                    accessibilityRole="button"
                    accessibilityState={{selected}}
                    style={[styles.chip, selected && styles.chipSelected]}>
                    <AppText
                      bold
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}>
                      {s.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <AppText style={styles.fieldLabel}>
              WORKOUT DURATION (MIN) — FLAT ESTIMATE PER PLAN SESSION
            </AppText>
            <View style={styles.pillRow}>
              {SESSION_CHIPS.map(m => {
                const selected = sessionMinutes === String(m);
                return (
                  <Pressable
                    key={m}
                    onPress={() => setSessionMinutes(String(m))}
                    accessibilityRole="button"
                    accessibilityState={{selected}}
                    style={[styles.chip, selected && styles.chipSelected]}>
                    <AppText
                      bold
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}>
                      {String(m)}
                    </AppText>
                  </Pressable>
                );
              })}
              <TextInput
                value={sessionMinutes}
                onChangeText={setSessionMinutes}
                keyboardType="number-pad"
                placeholder="60"
                placeholderTextColor={colors.ghost}
                accessibilityLabel="Workout duration in minutes"
                style={styles.numField}
              />
            </View>

            {!!error && (
              <Pressable
                onPress={onClearError}
                accessibilityRole="button"
                accessibilityLabel="Dismiss error"
                style={styles.errorBanner}>
                <AppText bold style={styles.errorBannerText}>
                  {error}
                </AppText>
              </Pressable>
            )}

            <View style={styles.footer}>
              <TacticalButton
                title="Save"
                onPress={handleSave}
                disabled={!valid}
                fullWidth
              />
              <TacticalButton
                title="Cancel"
                variant="outline"
                onPress={onClose}
                fullWidth
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderColor: colors.rule,
    maxHeight: '90%',
  },
  body: {padding: 16, gap: 8},
  title: {fontSize: 13, letterSpacing: 2, color: colors.ink},
  subtitle: {fontSize: 12, color: colors.muted, lineHeight: 17},
  fieldLabel: {
    fontSize: 10,
    color: colors.faint,
    letterSpacing: 1.4,
    marginTop: 8,
  },
  pillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.paper,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipSelected: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipText: {fontSize: 12, color: colors.muted, letterSpacing: 1},
  chipTextSelected: {color: '#FFFFFF'},
  numField: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.paper,
    color: colors.ink,
    minWidth: 64,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 0,
    height: 40,
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  errorBanner: {
    backgroundColor: colors.warnBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warn,
    padding: 10,
    marginTop: 16,
  },
  errorBannerText: {fontSize: 12, color: colors.warn, letterSpacing: 0.4},
  footer: {gap: 8, marginTop: 16},
});

export default ProfileModal;
```

(`'#FFFFFF'` in `chipTextSelected` and the backdrop rgba mirror ActivitySessionModal's existing literals — not new palette entries.)

- [ ] **Step 2: Wire into Home.tsx**

- Imports: add `ProfileModal` component import; add `fetchProfile, saveProfile` to the databaseService import; add `UserProfile` to the types import.
- State (next to `modalVisible`):

```tsx
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [profileVisible, setProfileVisible] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
```

- `refresh()` — extend BOTH fan-outs (destructure + call list):

```tsx
    let [s, p, h, ah, acts, prof] = await Promise.all([
      fetchHomeSummary(db),
      fetchPlans(db),
      fetchHeatmapData(db, fromKey),
      fetchActivityHeatmapData(db, fromKey),
      fetchActivities(db),
      fetchProfile(db),
    ]);
```

and identically with `db2` in the self-heal block (`[s, p, h, ah, acts, prof] = await Promise.all([...])`). After the other setters: `setProfile(prof);`.

- Save handler (next to `handleSelectPlan`):

```tsx
  async function handleSaveProfile(p: UserProfile) {
    setProfileError(null);
    try {
      const db = await getDBConnection();
      await saveProfile(db, p);
      setProfileVisible(false);
      await refresh();
    } catch (err) {
      setProfileError((err as Error).message);
    }
  }
```

- DATA MANAGEMENT row: add a third flex-1 button after Import:

```tsx
          <View style={{flex: 1}}>
            <TacticalButton
              title="Profile"
              icon="person"
              variant="outline"
              disabled={submitting}
              fullWidth
              onPress={() => setProfileVisible(true)}
            />
          </View>
```

- Render the modal next to `PlanSwitcherModal`:

```tsx
      <ProfileModal
        visible={profileVisible}
        initial={profile}
        error={profileError}
        onSave={handleSaveProfile}
        onClose={() => {
          setProfileVisible(false);
          setProfileError(null);
        }}
        onClearError={() => setProfileError(null)}
      />
```

- [ ] **Step 3: Verify**

Run: `node_modules/.bin/jest` (full suite) — PASS.
Run: `node_modules/.bin/eslint src/components/ProfileModal.tsx src/screens/Home.tsx` — no errors.
Run: `node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/(components/ProfileModal|screens/Home)\.tsx'` (probe-validate) — Home.tsx's 4 pre-existing `Routes.tsx`-style screen-typing errors don't live in these files; expect no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProfileModal.tsx src/screens/Home.tsx
git commit -m "feat(calories): profile editor modal, wired from Home

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: "TODAY ~N KCAL" line on Home

**Files:**
- Modify: `src/screens/Home.tsx`

**Interfaces:**
- Consumes: `fetchTodayKcal` (Task 6), `isoDate` (already imported in Home).

- [ ] **Step 1: Fetch in both fan-outs**

In `refresh()`, next to `fromKey`: `const todayKey = isoDate(new Date());`. Add `fetchTodayKcal` to the databaseService import, `fetchTodayKcal(db, todayKey)` to BOTH `Promise.all` calls, destructure as `today` (i.e. `let [s, p, h, ah, acts, prof, today] = ...`), and add state + setter:

```tsx
  const [todayKcal, setTodayKcal] = React.useState(0);
  // in refresh(), with the other setters:
  setTodayKcal(today);
```

- [ ] **Step 2: Render**

Inside the `{summary && (<>...` block, between the `ProgressCard` conditional and `CurrentWeekStrip`:

```tsx
            {todayKcal > 0 && (
              <View style={styles.kcalToday}>
                <AppText bold style={styles.kcalTodayLabel}>
                  BURNED TODAY
                </AppText>
                <AppText bold style={styles.kcalTodayValue}>
                  {`~${todayKcal} KCAL`}
                </AppText>
              </View>
            )}
```

Styles:

```tsx
  kcalToday: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  kcalTodayLabel: {fontSize: 11, letterSpacing: 2, color: colors.faint},
  kcalTodayValue: {
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
```

- [ ] **Step 3: Verify + commit**

Run: `node_modules/.bin/eslint src/screens/Home.tsx` and the scoped tsc grep from Task 8 — clean.

```bash
git add src/screens/Home.tsx
git commit -m "feat(home): today's approximate calorie burn line

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: All-time totals block on Statistics

**Files:**
- Modify: `src/screens/Statistics.tsx`

**Interfaces:**
- Consumes: `fetchKcalTotals` / `KcalTotals` (Task 6), `formatKcal` (Task 1).

- [ ] **Step 1: Fetch on mount**

Add to the imports: `fetchKcalTotals`, `type KcalTotals` (from databaseService) and `formatKcal` (from `../common/calories`). Add state `const [kcalTotals, setKcalTotals] = React.useState<KcalTotals | null>(null);`. In the existing mount effect, after `setExercises(...)`: `setKcalTotals(await fetchKcalTotals(db));`.

- [ ] **Step 2: Render**

Directly after `<AppPicker ... />`:

```tsx
      {kcalTotals != null && kcalTotals.total > 0 && (
        <View style={styles.kcalCard}>
          <View style={styles.kcalRow}>
            <AppText style={styles.kcalLabel}>TOTAL BURNED</AppText>
            <AppText bold style={styles.kcalTotal}>
              {`~${formatKcal(kcalTotals.total)} KCAL`}
            </AppText>
          </View>
          <View style={styles.kcalRow}>
            <AppText style={styles.kcalSub}>
              {`TRAINING ~${formatKcal(kcalTotals.training)}`}
            </AppText>
            <AppText style={styles.kcalSub}>
              {`ACTIVITIES ~${formatKcal(kcalTotals.activities)}`}
            </AppText>
          </View>
        </View>
      )}
```

Styles:

```tsx
  kcalCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  kcalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kcalLabel: {fontSize: 11, letterSpacing: 2, color: colors.faint},
  kcalTotal: {
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  kcalSub: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
```

Note: the root view uses `justifyContent: 'space-between'` — after adding the card as a third child, eyeball the spacing in the running app; if the gap looks wrong, wrap picker + card in one plain `<View style={{gap: 16}}>`.

- [ ] **Step 3: Verify + commit**

Run: `node_modules/.bin/eslint src/screens/Statistics.tsx`; scoped tsc grep for `src/screens/Statistics.tsx` — Statistics has KNOWN pre-existing victory-native generic errors (data/xKey/yKeys/points); only NEW error lines beyond those four-ish count as regressions.

```bash
git add src/screens/Statistics.tsx
git commit -m "feat(statistics): all-time kcal totals block

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Documentation + full verification

**Files:**
- Modify: `CLAUDE.md` (repo root — i.e. `/home/pascal/Code/workout-warden/CLAUDE.md`)

- [ ] **Step 1: Update CLAUDE.md**

Three edits:

1. Data model section, `sessions` bullet — extend with: `Nullable kcal snapshot (see "Calorie estimation").`
2. Data model section, `activity_sessions` bullet — extend with: `Nullable kcal snapshot, computed at save time.`
3. Add a new subsection after "Legacy data import" :

```markdown
### Calorie estimation

Approximate burn via the BMR-corrected MET formula in `src/common/calories.ts`
(pure module, no RN imports; MET values are TS constants there, deliberately
not seeded — `__tests__/calories.test.ts` keeps the map in sync with the
activities seed). The user profile (weight/height/birth year/sex + flat
per-workout duration) lives in `settings` as `profile_*` keys via the generic
`getSetting`/`setSetting`; `fetchProfile` returns null until all four BMR
fields are set, and the ProfileModal on Home is the only editor.

kcal is a **snapshot column** (`activity_sessions.kcal`, `sessions.kcal`),
written by `createActivitySession`/`updateActivitySession` (recomputed on
every save) and `finishSession` (flat `profile_session_minutes` ×
`STRENGTH_MET`). `saveProfile` backfills gaps only (`kcal IS NULL`) — existing
snapshots are frozen by design; NULL means "unknown", never 0 (untimed
activities stay NULL). Rendered values always carry a `~` prefix. Aggregates:
`fetchTodayKcal` (Home line, in BOTH refresh fan-outs), `fetchKcalTotals`
(Statistics), week sums in `activityStats.ActivityTotals.kcal`.
```

- [ ] **Step 2: Full test suite + lint**

Run: `node_modules/.bin/jest`
Expected: all suites PASS.
Run: `node_modules/.bin/eslint src/`
Expected: only the known deliberate seed-file violations (`src/seeds/plans/*.ts`), nothing new.

- [ ] **Step 3: tsc diff vs HEAD (repo procedure)**

```bash
git worktree add --detach /tmp/ww-head HEAD
ln -s /home/pascal/Code/workout-warden/node_modules /tmp/ww-head/node_modules
cd /tmp/ww-head && node_modules/.bin/tsc --noEmit 2>&1 | grep -v node_modules | sort > /tmp/tsc-before.txt
```

Then, as its OWN command from the repo root (never chained after the `cd`):

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -v node_modules | sort > /tmp/tsc-after.txt
diff /tmp/tsc-before.txt /tmp/tsc-after.txt
```

Expected: only exempt shapes — `Routes.tsx` screen-typing errors with shifted line numbers, and jest-typing noise (TS2304/TS2593/TS2708) from the new/extended `__tests__/*.test.ts` files. Anything else is a regression to fix before finishing. Clean up: `git worktree remove /tmp/ww-head`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: calorie-estimation architecture notes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
