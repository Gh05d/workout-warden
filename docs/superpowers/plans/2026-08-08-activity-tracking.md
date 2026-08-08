# Activity Tracking (Surf/Altinha) + Quotes Curation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free-form activity logging (surf, altinha) in its own bottom tab, visible on the Home heatmap/week-strip via color blending, plus a curated demotivational-quotes list.

**Architecture:** Two new SQLite tables (`activities`, `activity_sessions`) fully parallel to the plan/week apparatus, seeded by the exercise-catalogue upsert pattern. Pure helpers (`mixHexColors`, `dayPaintPair`, ISO-week stats) carry all decidable logic and are unit-tested against better-sqlite3 / plain jest; UI components stay thin.

**Tech Stack:** React Native 0.85 (TS), react-native-sqlite-storage, better-sqlite3 (tests only), react-navigation bottom-tabs. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-08-activity-tracking-quotes-design.md`

## Global Constraints

- **No new npm/native dependencies.** Date picking = day-stepper buttons; bars = plain Views; blending = own helper.
- `yarn <cmd>` is broken (missing berry release file). Run scripts via `npm run <script>` or tools directly via `node_modules/.bin/<tool>`.
- Jest single file: `node_modules/.bin/jest __tests__/<file>.test.ts`. Full suite: `npm run test`.
- TS check for a touched file: `node_modules/.bin/tsc --noEmit 2>&1 | grep '<path/file>'` — scope by **path**, not symbol name. `tsc --noEmit` is NOT globally clean (victory-native/Routes/useFetchData/__tests__ noise is pre-existing); only NEW errors in files you touched count. To prove your grep can fail, temporarily append `const __probe: number = 'x';` to the file, confirm the grep catches it, remove it with an Edit (never `git checkout -- <file>`).
- UI copy is English, ALL-CAPS labels with letterSpacing 1.4–2. Colors only from `src/common/theme.ts` tokens or the palette modules (`planColor.ts`) — no new hex literals in components (palette files themselves may define hex).
- Android TextInput: numeric inputs need `paddingVertical: 0`, `textAlignVertical: 'center'`, `includeFontPadding: false`.
- **No `SEED_REVISION` bump** — this plan changes no shipped plan prescriptions.
- Never run prettier/eslint `--fix` on `src/seeds/plans/*.ts` (not touched here, but keep off them).
- Schema DDL lives in TWO places and must stay in sync: `src/common/databaseService.ts` `SCHEMA` array (app) and `scripts/schema-v2.sql` (test harness + legacy importer).
- ESLint uses `==` deliberately (`eqeqeq` off); `prettier/prettier` is an error — match repo prettier style (singleQuote, bracketSpacing false, arrowParens avoid, trailingComma all).
- Commit messages: conventional style (`feat(scope): …`, `test: …`, `docs: …`).

---

### Task 1: Schema, types, and activity CRUD in databaseService

**Files:**
- Modify: `src/common/databaseService.ts` (SCHEMA array ~line 118, new CRUD section after `fetchHomeSummary`)
- Modify: `src/common/types.ts`
- Modify: `scripts/schema-v2.sql` (append after the index block)
- Test: `__tests__/activityService.test.ts` (create)

**Interfaces:**
- Consumes: existing `getDBConnection`, `SQLiteDatabase` conventions.
- Produces (later tasks import these from `../common/databaseService` / `../common/types`):
  - types `Activity {id, slug, name}`, `ActivitySession {id, activity_id, activity_slug, activity_name, performed_at, duration_minutes, spot, note, created_at}`, `ActivitySeed {slug, name}`, `ActivitySessionDraft {activityId, performedAt, durationMinutes, spot, note}`
  - `fetchActivities(db): Promise<Activity[]>`
  - `fetchActivitySessions(db, opts?: {fromDate?: string}): Promise<ActivitySession[]>` (newest first)
  - `createActivitySession(db, draft: ActivitySessionDraft): Promise<number>`
  - `updateActivitySession(db, id: number, patch: Partial<ActivitySessionDraft>): Promise<void>`
  - `deleteActivitySession(db, id: number): Promise<void>`

- [ ] **Step 1: Add DDL to both schema locations**

Append to the `SCHEMA` array in `src/common/databaseService.ts` (before the `CREATE INDEX` entries, indexes at the end of the array):

```ts
  `CREATE TABLE IF NOT EXISTS activities (
     id   INTEGER PRIMARY KEY AUTOINCREMENT,
     slug TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS activity_sessions (
     id               INTEGER PRIMARY KEY AUTOINCREMENT,
     activity_id      INTEGER NOT NULL REFERENCES activities(id),
     performed_at     TEXT NOT NULL,
     duration_minutes INTEGER,
     spot             TEXT,
     note             TEXT,
     created_at       DATETIME DEFAULT (datetime('now'))
   )`,
```

and with the other indexes:

```ts
  `CREATE INDEX IF NOT EXISTS idx_actsess_date     ON activity_sessions(performed_at)`,
  `CREATE INDEX IF NOT EXISTS idx_actsess_activity ON activity_sessions(activity_id, performed_at)`,
```

Append the same two tables + two indexes to `scripts/schema-v2.sql` in SQL syntax (semicolon-terminated, matching the file's formatting). `performed_at` is a local ISO date `YYYY-MM-DD` — no time component, no timezone conversion anywhere.

- [ ] **Step 2: Add types to `src/common/types.ts`**

In the seed-side block:

```ts
interface ActivitySeed {
  slug: string;
  name: string;
}
```

In the DB-side block:

```ts
interface Activity {
  id: number;
  slug: string;
  name: string;
}

interface ActivitySession {
  id: number;
  activity_id: number;
  activity_slug: string;
  activity_name: string;
  performed_at: string; // local ISO date YYYY-MM-DD
  duration_minutes: number | null;
  spot: string | null;
  note: string | null;
  created_at: string;
}

/** Form payload for create/update — camelCase like updateSet's patch. */
interface ActivitySessionDraft {
  activityId: number;
  performedAt: string; // YYYY-MM-DD
  durationMinutes: number | null;
  spot: string | null;
  note: string | null;
}
```

Add `ActivitySeed`, `Activity`, `ActivitySession`, `ActivitySessionDraft` to the `export type {...}` block.

- [ ] **Step 3: Write the failing test**

Create `__tests__/activityService.test.ts` using the schema-file harness from `__tests__/fetchHeatmapData.test.ts` (copy its `jest.mock` header and `makeDb` verbatim — but extend the non-SELECT branch to return `insertId` like `__tests__/seedMigration.test.ts` does, because `createActivitySession` returns it):

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
  createActivitySession,
  deleteActivitySession,
  fetchActivities,
  fetchActivitySessions,
  updateActivitySession,
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
    `INSERT INTO activities (id, slug, name) VALUES
       (1, 'surf', 'Surf'),
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
            rows: {length: arr.length, item: (i: number) => arr[i], raw: () => arr},
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

describe('activity CRUD', () => {
  it('creates a session and reads it back joined with activity name', async () => {
    const db = makeDb();
    const id = await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 90,
      spot: 'Uluwatu',
      note: 'offshore, hip high',
    });
    expect(id).toBeGreaterThan(0);
    const list = await fetchActivitySessions(db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id,
      activity_id: 1,
      activity_slug: 'surf',
      activity_name: 'Surf',
      performed_at: '2026-08-05',
      duration_minutes: 90,
      spot: 'Uluwatu',
      note: 'offshore, hip high',
    });
  });

  it('lists newest-first and respects fromDate', async () => {
    const db = makeDb();
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-01',
      durationMinutes: null,
      spot: null,
      note: null,
    });
    await createActivitySession(db, {
      activityId: 2,
      performedAt: '2026-08-05',
      durationMinutes: 60,
      spot: null,
      note: null,
    });
    const all = await fetchActivitySessions(db);
    expect(all.map(s => s.performed_at)).toEqual(['2026-08-05', '2026-08-01']);
    const windowed = await fetchActivitySessions(db, {fromDate: '2026-08-03'});
    expect(windowed).toHaveLength(1);
    expect(windowed[0].activity_slug).toBe('altinha');
  });

  it('allows two sessions on the same day', async () => {
    const db = makeDb();
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 60,
      spot: null,
      note: null,
    });
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 45,
      spot: null,
      note: null,
    });
    expect(await fetchActivitySessions(db)).toHaveLength(2);
  });

  it('partially updates only the given fields', async () => {
    const db = makeDb();
    const id = await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 90,
      spot: 'Uluwatu',
      note: null,
    });
    await updateActivitySession(db, id, {durationMinutes: 120, note: 'long one'});
    const [s] = await fetchActivitySessions(db);
    expect(s).toMatchObject({
      duration_minutes: 120,
      note: 'long one',
      spot: 'Uluwatu',
      performed_at: '2026-08-05',
    });
  });

  it('deletes a session', async () => {
    const db = makeDb();
    const id = await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: null,
      spot: null,
      note: null,
    });
    await deleteActivitySession(db, id);
    expect(await fetchActivitySessions(db)).toHaveLength(0);
  });

  it('fetchActivities returns the catalogue ordered by id', async () => {
    const db = makeDb();
    const acts = await fetchActivities(db);
    expect(acts).toEqual([
      {id: 1, slug: 'surf', name: 'Surf'},
      {id: 2, slug: 'altinha', name: 'Altinha'},
    ]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `node_modules/.bin/jest __tests__/activityService.test.ts`
Expected: FAIL — `createActivitySession` etc. are not exported.

- [ ] **Step 5: Implement the CRUD block**

Append to `src/common/databaseService.ts` (new section `// ---------- Activities ----------` after `fetchHomeSummary`), importing `Activity`, `ActivitySession`, `ActivitySessionDraft` in the existing `import type` block:

```ts
// ---------- Activities ----------

export async function fetchActivities(db: SQLiteDatabase): Promise<Activity[]> {
  const [res] = await db.executeSql(
    `SELECT id, slug, name FROM activities ORDER BY id ASC`,
  );
  return res.rows.raw();
}

export async function fetchActivitySessions(
  db: SQLiteDatabase,
  opts: {fromDate?: string} = {},
): Promise<ActivitySession[]> {
  const where = opts.fromDate ? `WHERE s.performed_at >= ?` : '';
  const params = opts.fromDate ? [opts.fromDate] : [];
  const [res] = await db.executeSql(
    `SELECT s.id, s.activity_id, a.slug AS activity_slug, a.name AS activity_name,
            s.performed_at, s.duration_minutes, s.spot, s.note, s.created_at
     FROM activity_sessions s
     JOIN activities a ON a.id = s.activity_id
     ${where}
     ORDER BY s.performed_at DESC, s.id DESC`,
    params,
  );
  return res.rows.raw();
}

export async function createActivitySession(
  db: SQLiteDatabase,
  draft: ActivitySessionDraft,
): Promise<number> {
  const [ins] = await db.executeSql(
    `INSERT INTO activity_sessions (activity_id, performed_at, duration_minutes, spot, note)
     VALUES (?, ?, ?, ?, ?)`,
    [
      draft.activityId,
      draft.performedAt,
      draft.durationMinutes,
      draft.spot,
      draft.note,
    ],
  );
  return ins.insertId;
}

export async function updateActivitySession(
  db: SQLiteDatabase,
  id: number,
  patch: Partial<ActivitySessionDraft>,
): Promise<void> {
  const fields: string[] = [];
  const params: (number | string | null)[] = [];
  if (patch.activityId !== undefined) {
    fields.push('activity_id = ?');
    params.push(patch.activityId);
  }
  if (patch.performedAt !== undefined) {
    fields.push('performed_at = ?');
    params.push(patch.performedAt);
  }
  if (patch.durationMinutes !== undefined) {
    fields.push('duration_minutes = ?');
    params.push(patch.durationMinutes);
  }
  if (patch.spot !== undefined) {
    fields.push('spot = ?');
    params.push(patch.spot);
  }
  if (patch.note !== undefined) {
    fields.push('note = ?');
    params.push(patch.note);
  }
  if (fields.length === 0) return;
  params.push(id);
  await db.executeSql(
    `UPDATE activity_sessions SET ${fields.join(', ')} WHERE id = ?`,
    params,
  );
}

export async function deleteActivitySession(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.executeSql(`DELETE FROM activity_sessions WHERE id = ?`, [id]);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node_modules/.bin/jest __tests__/activityService.test.ts`
Expected: PASS (6 tests). Also run `node_modules/.bin/jest __tests__/fetchHeatmapData.test.ts __tests__/seedMigration.test.ts` — the schema-v2.sql change must not break the existing harnesses.

- [ ] **Step 7: TS check**

`node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/common/(databaseService|types)\.ts'` → no output (both files previously clean).

- [ ] **Step 8: Commit**

```bash
git add src/common/databaseService.ts src/common/types.ts scripts/schema-v2.sql __tests__/activityService.test.ts
git commit -m "feat(db): activities + activity_sessions tables with CRUD"
```

---

### Task 2: Activity seeds, validator, and seedDB upsert

**Files:**
- Create: `src/seeds/activities.ts`
- Modify: `src/seeds/index.ts`
- Modify: `src/common/seedValidator.ts`
- Modify: `src/common/databaseService.ts` (`seedDB`, ~line 156)
- Test: `__tests__/seeds.test.ts`, `__tests__/seedValidator.test.ts`, `__tests__/seedMigration.test.ts` (extend all three)

**Interfaces:**
- Consumes: `ActivitySeed` type (Task 1), `validateSeed(bundle)` / `SeedBundle`.
- Produces: `ACTIVITIES: readonly ActivitySeed[]` exported from `src/seeds`; `SeedBundle` gains required `activities: ActivitySeed[]`; `seedDB` upserts activities by slug on every start (revision-independent).

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/seeds.test.ts` (and change its import line to `import {ACTIVITIES, EXERCISES, PLANS} from '../src/seeds';` — the existing `validateSeed` call gains the `activities` key):

```ts
  it('seeds surf and altinha activities', () => {
    expect(ACTIVITIES.map(a => a.slug)).toEqual(['surf', 'altinha']);
  });
```

and change the first test to:

```ts
  it('validates without errors', () => {
    expect(() =>
      validateSeed({
        exercises: [...EXERCISES],
        plans: [...PLANS],
        activities: [...ACTIVITIES],
      }),
    ).not.toThrow();
  });
```

Append to `__tests__/seedValidator.test.ts` a duplicate-slug case (mirror the file's existing minimal-bundle style; every existing `validateSeed({...})` call in that file gains `activities: []`):

```ts
  it('rejects duplicate activity slugs', () => {
    expect(() =>
      validateSeed({
        exercises: [],
        plans: [],
        activities: [
          {slug: 'surf', name: 'Surf'},
          {slug: 'surf', name: 'Surf again'},
        ],
      }),
    ).toThrow(/duplicate activity slug 'surf'/);
  });
```

Append to `__tests__/seedMigration.test.ts` inside the existing describe (uses the existing `mockRaw` + `initDB`):

```ts
  it('seeds the activity catalogue and re-upserts it idempotently', async () => {
    await initDB();
    const rows = () =>
      mockRaw
        .prepare(`SELECT slug, name FROM activities ORDER BY id`)
        .all() as {slug: string; name: string}[];
    expect(rows()).toEqual([
      {slug: 'surf', name: 'Surf'},
      {slug: 'altinha', name: 'Altinha'},
    ]);
    await initDB();
    expect(rows()).toEqual([
      {slug: 'surf', name: 'Surf'},
      {slug: 'altinha', name: 'Altinha'},
    ]);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `node_modules/.bin/jest __tests__/seeds.test.ts __tests__/seedValidator.test.ts __tests__/seedMigration.test.ts`
Expected: FAIL — no `ACTIVITIES` export, `SeedBundle` has no `activities`.

- [ ] **Step 3: Implement**

Create `src/seeds/activities.ts`:

```ts
// src/seeds/activities.ts
// Free-form activity catalogue. Same lifecycle as the exercise catalogue:
// upserted by slug on every app start, grows but never shrinks, no
// SEED_REVISION interplay. Adding an activity later = one row here + release.
import type {ActivitySeed} from '../common/types';

export const ACTIVITIES: ActivitySeed[] = [
  {slug: 'surf', name: 'Surf'},
  {slug: 'altinha', name: 'Altinha'},
];
```

`src/seeds/index.ts` — add:

```ts
import {ACTIVITIES as ACTIVITIES_LIST} from './activities';
export const ACTIVITIES: readonly ActivitySeed[] = ACTIVITIES_LIST;
```

(and extend the `import type` line with `ActivitySeed`).

`src/common/seedValidator.ts` — extend `SeedBundle` and `validateSeed`:

```ts
export interface SeedBundle {
  exercises: ExerciseSeed[];
  plans: PlanSeed[];
  activities: ActivitySeed[];
}
```

At the top of `validateSeed` (before the exercise loop):

```ts
  const activitySlugs = new Set<string>();
  for (const act of bundle.activities) {
    if (activitySlugs.has(act.slug)) {
      throw new Error(`duplicate activity slug '${act.slug}'`);
    }
    activitySlugs.add(act.slug);
  }
```

(import `ActivitySeed` in the `import type` line.)

`src/common/databaseService.ts` — in `seedDB`: extend the import to `import {ACTIVITIES, EXERCISES, PLANS, SEED_REVISION} from '../seeds';`, pass `activities: [...ACTIVITIES]` to the `validateSeed` call, and insert after the exercise-upsert loop (step 1):

```ts
  // 1b. Upsert activities (catalogue grows, never shrinks; revision-independent)
  for (const act of ACTIVITIES) {
    await db.executeSql(
      `INSERT INTO activities (slug, name) VALUES (?, ?)
       ON CONFLICT(slug) DO UPDATE SET name = excluded.name`,
      [act.slug, act.name],
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node_modules/.bin/jest __tests__/seeds.test.ts __tests__/seedValidator.test.ts __tests__/seedMigration.test.ts`
Expected: PASS, including all pre-existing cases (fresh install, idempotence, stale-revision rewrite, user-data safety).

- [ ] **Step 5: TS check + commit**

`node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/(seeds/|common/seedValidator|common/databaseService)'` → empty.

```bash
git add src/seeds/activities.ts src/seeds/index.ts src/common/seedValidator.ts src/common/databaseService.ts __tests__/seeds.test.ts __tests__/seedValidator.test.ts __tests__/seedMigration.test.ts
git commit -m "feat(seeds): surf + altinha activity catalogue"
```

---

### Task 3: activityColor palette + mixHexColors

**Files:**
- Modify: `src/common/planColor.ts`
- Test: `__tests__/planColor.test.ts` (create)

**Interfaces:**
- Produces: `activityColor(activityId: number): {bg: string; fg: string}` and `mixHexColors(hexes: string[]): string` exported from `src/common/planColor`. Both are pure; `mixHexColors` accepts `#RRGGBB` only and returns uppercase `#RRGGBB`.

- [ ] **Step 1: Write the failing test** — create `__tests__/planColor.test.ts`:

```ts
import {activityColor, mixHexColors, planColor} from '../src/common/planColor';

describe('activityColor', () => {
  it('gives surf (id 1) and altinha (id 2) distinct pairs', () => {
    expect(activityColor(1)).not.toEqual(activityColor(2));
  });

  it('is disjoint from the plan palette', () => {
    const planFgs = new Set([1, 2, 3, 4, 5, 6].map(id => planColor(id).fg));
    expect(planFgs.has(activityColor(1).fg)).toBe(false);
    expect(planFgs.has(activityColor(2).fg)).toBe(false);
  });

  it('wraps stably beyond the palette length', () => {
    expect(activityColor(5)).toEqual(activityColor(1));
  });
});

describe('mixHexColors', () => {
  it('returns a single color unchanged', () => {
    expect(mixHexColors(['#FF9800'])).toBe('#FF9800');
  });

  it('averages channels of a pair', () => {
    expect(mixHexColors(['#000000', '#FFFFFF'])).toBe('#808080');
    expect(mixHexColors(['#FF0000', '#0000FF'])).toBe('#800080');
  });

  it('averages three colors', () => {
    expect(mixHexColors(['#300000', '#003000', '#000030'])).toBe('#101010');
  });

  it('throws on an empty list', () => {
    expect(() => mixHexColors([])).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `node_modules/.bin/jest __tests__/planColor.test.ts` → FAIL (no such exports).

- [ ] **Step 3: Implement** — append to `src/common/planColor.ts`:

```ts
// Activity palette: deliberately hue-distant from the plan palette above AND
// internally (cyan / pink / teal / deep-purple families), so activities read
// differently from plans in the heatmap and pairwise blends stay tellable.
const ACTIVITY_PALETTE: ReadonlyArray<{bg: string; fg: string}> = [
  {bg: '#B2EBF2', fg: '#006064'}, // cyan — surf
  {bg: '#F8BBD0', fg: '#880E4F'}, // pink — altinha
  {bg: '#B2DFDB', fg: '#004D40'}, // teal
  {bg: '#D1C4E9', fg: '#311B92'}, // deep purple
];

export function activityColor(activityId: number): {bg: string; fg: string} {
  const idx = Math.abs(activityId - 1) % ACTIVITY_PALETTE.length;
  return ACTIVITY_PALETTE[idx];
}

/** Per-channel sRGB mean of `#RRGGBB` colors, as an uppercase `#RRGGBB`.
 * Used for heatmap/strip cells on days with more than one color source. The
 * mix of 3+ sources drifts toward gray — accepted trade-off (see the design
 * spec); swapping this call site for a split-cell treatment is the escape
 * hatch if it reads too muddy in practice. */
export function mixHexColors(hexes: string[]): string {
  if (hexes.length === 0) {
    throw new Error('mixHexColors needs at least one color');
  }
  let r = 0;
  let g = 0;
  let b = 0;
  for (const hex of hexes) {
    const v = parseInt(hex.slice(1), 16);
    r += (v >> 16) & 0xff;
    g += (v >> 8) & 0xff;
    b += v & 0xff;
  }
  const n = hexes.length;
  const toHex = (x: number) =>
    Math.round(x / n)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
```

- [ ] **Step 4: Verify pass + commit**

`node_modules/.bin/jest __tests__/planColor.test.ts` → PASS.
`node_modules/.bin/tsc --noEmit 2>&1 | grep 'src/common/planColor.ts'` → empty.

```bash
git add src/common/planColor.ts __tests__/planColor.test.ts
git commit -m "feat(colors): activity palette + hex color blending"
```

---

### Task 4: heatmapMath day-paint rule

**Files:**
- Modify: `src/components/heatmapMath.ts`
- Test: `__tests__/heatmapMath.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `planColor`, `activityColor`, `mixHexColors` from `../common/planColor` (Task 3).
- Produces (exported from `src/components/heatmapMath`):

```ts
export interface ActivityDayEntry {
  activityId: number;
  count: number;
}
export interface DaySources {
  plan?: {planId: number; count: number};
  activities?: ReadonlyArray<ActivityDayEntry>;
}
export function dayTotalCount(s: DaySources): number;
export function dayPaintPair(s: DaySources): {bg: string; fg: string} | null;
```

Rule: 0 sources → `null`. Exactly one distinct source (the plan, or one activity id) → that source's palette pair verbatim. 2+ distinct sources → `{bg: mixHexColors(all bgs), fg: mixHexColors(all fgs)}`. The plan side contributes at most one source (`fetchHeatmapData` already collapses to the dominant plan).

- [ ] **Step 1: Write the failing tests** — append to `__tests__/heatmapMath.test.ts`:

```ts
import {activityColor, mixHexColors, planColor} from '../src/common/planColor';
import {dayPaintPair, dayTotalCount} from '../src/components/heatmapMath';

describe('dayPaintPair', () => {
  it('returns null for an empty day', () => {
    expect(dayPaintPair({})).toBeNull();
    expect(dayPaintPair({activities: []})).toBeNull();
  });

  it('returns the plan pair for a plan-only day', () => {
    expect(dayPaintPair({plan: {planId: 1, count: 1}})).toEqual(planColor(1));
  });

  it('returns the activity pair for a single-activity day', () => {
    expect(
      dayPaintPair({activities: [{activityId: 2, count: 3}]}),
    ).toEqual(activityColor(2));
  });

  it('blends plan + activity fgs and bgs on a mixed day', () => {
    const pair = dayPaintPair({
      plan: {planId: 1, count: 1},
      activities: [{activityId: 1, count: 1}],
    });
    expect(pair).toEqual({
      bg: mixHexColors([planColor(1).bg, activityColor(1).bg]),
      fg: mixHexColors([planColor(1).fg, activityColor(1).fg]),
    });
  });

  it('blends two different activities without a plan', () => {
    const pair = dayPaintPair({
      activities: [
        {activityId: 1, count: 1},
        {activityId: 2, count: 1},
      ],
    });
    expect(pair).toEqual({
      bg: mixHexColors([activityColor(1).bg, activityColor(2).bg]),
      fg: mixHexColors([activityColor(1).fg, activityColor(2).fg]),
    });
  });
});

describe('dayTotalCount', () => {
  it('sums plan and activity counts', () => {
    expect(dayTotalCount({})).toBe(0);
    expect(
      dayTotalCount({
        plan: {planId: 1, count: 2},
        activities: [
          {activityId: 1, count: 1},
          {activityId: 2, count: 3},
        ],
      }),
    ).toBe(6);
  });
});
```

(If the existing file already imports from planColor, merge the import lines instead of duplicating.)

- [ ] **Step 2: Run to verify failure** — `node_modules/.bin/jest __tests__/heatmapMath.test.ts` → the new block FAILS, all pre-existing cases still PASS.

- [ ] **Step 3: Implement** — append to `src/components/heatmapMath.ts` (add `import {activityColor, mixHexColors, planColor} from '../common/planColor';` at the top — the module stays RN-free):

```ts
export interface ActivityDayEntry {
  activityId: number;
  count: number;
}

/** Everything painted on one calendar day. The plan side is already collapsed
 * to the dominant plan by fetchHeatmapData, so it contributes at most one
 * color source; each distinct activity contributes one more. */
export interface DaySources {
  plan?: {planId: number; count: number};
  activities?: ReadonlyArray<ActivityDayEntry>;
}

export function dayTotalCount(s: DaySources): number {
  let n = s.plan ? s.plan.count : 0;
  for (const a of s.activities ?? []) n += a.count;
  return n;
}

/** The {bg, fg} pair a day renders with. One source → its palette pair; a
 * mixed day blends per variant (bg with bgs, fg with fgs) via mixHexColors.
 * Callers pick the variant: the heatmap shows fg from 2 total entries up —
 * which every mixed day has by definition — the week strip uses bg as the
 * cell fill and fg for rail/mark, exactly like its plan-only rendering. */
export function dayPaintPair(s: DaySources): {bg: string; fg: string} | null {
  const pairs: {bg: string; fg: string}[] = [];
  if (s.plan) pairs.push(planColor(s.plan.planId));
  for (const a of s.activities ?? []) pairs.push(activityColor(a.activityId));
  if (pairs.length === 0) return null;
  if (pairs.length === 1) return pairs[0];
  return {
    bg: mixHexColors(pairs.map(p => p.bg)),
    fg: mixHexColors(pairs.map(p => p.fg)),
  };
}
```

- [ ] **Step 4: Verify pass + commit**

`node_modules/.bin/jest __tests__/heatmapMath.test.ts` → PASS.
`node_modules/.bin/tsc --noEmit 2>&1 | grep 'src/components/heatmapMath.ts'` → empty.

```bash
git add src/components/heatmapMath.ts __tests__/heatmapMath.test.ts
git commit -m "feat(heatmap): day paint rule with activity blending"
```

---

### Task 5: fetchActivityHeatmapData + HeatmapCard integration

**Files:**
- Modify: `src/common/databaseService.ts` (append next to `fetchHeatmapData`)
- Modify: `src/components/HeatmapCard.tsx`
- Modify: `src/screens/Home.tsx`
- Test: `__tests__/activityService.test.ts` (append)

**Interfaces:**
- Consumes: `dayPaintPair`, `dayTotalCount`, `ActivityDayEntry` (Task 4); `fetchActivities`, `Activity` (Task 1).
- Produces: `fetchActivityHeatmapData(db, fromLocalDate: string): Promise<Map<string, ActivityDayEntry[]>>` — key = `performed_at` (already a local date, **no** `'localtime'` conversion), entries ordered by `activity_id`.
- HeatmapCard props change to: `{data, plans, activityData: Map<string, ActivityDayEntry[]>, activities: Activity[]}` — Task 6/7 do not touch HeatmapCard again.

- [ ] **Step 1: Write the failing test** — append to `__tests__/activityService.test.ts` (extend the import from databaseService with `fetchActivityHeatmapData`):

```ts
describe('fetchActivityHeatmapData', () => {
  it('groups per day and activity, honoring fromDate', async () => {
    const db = makeDb();
    for (const [act, day] of [
      [1, '2026-08-05'],
      [1, '2026-08-05'],
      [2, '2026-08-05'],
      [1, '2026-08-01'],
      [1, '2026-06-01'],
    ] as const) {
      await createActivitySession(db, {
        activityId: act,
        performedAt: day,
        durationMinutes: null,
        spot: null,
        note: null,
      });
    }
    const map = await fetchActivityHeatmapData(db, '2026-07-01');
    expect([...map.keys()]).toEqual(['2026-08-01', '2026-08-05']);
    expect(map.get('2026-08-05')).toEqual([
      {activityId: 1, count: 2},
      {activityId: 2, count: 1},
    ]);
    expect(map.get('2026-08-01')).toEqual([{activityId: 1, count: 1}]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `node_modules/.bin/jest __tests__/activityService.test.ts` → new describe FAILS.

- [ ] **Step 3: Implement the fetch** — append to the Activities section of `databaseService.ts`:

```ts
/** Per local day, the activity sessions grouped by activity. `performed_at`
 * is already a local YYYY-MM-DD string — unlike sessions.trained_at there is
 * no timestamp and therefore no 'localtime' conversion. */
export async function fetchActivityHeatmapData(
  db: SQLiteDatabase,
  fromLocalDate: string,
): Promise<Map<string, ActivityDayEntry[]>> {
  const [res] = await db.executeSql(
    `SELECT performed_at AS date, activity_id, COUNT(*) AS sessions
     FROM activity_sessions
     WHERE performed_at >= ?
     GROUP BY performed_at, activity_id
     ORDER BY date ASC, activity_id ASC`,
    [fromLocalDate],
  );
  const map = new Map<string, ActivityDayEntry[]>();
  for (const row of res.rows.raw()) {
    const list = map.get(row.date) ?? [];
    list.push({activityId: row.activity_id, count: row.sessions});
    map.set(row.date, list);
  }
  return map;
}
```

Import `ActivityDayEntry` via `import type {ActivityDayEntry} from '../components/heatmapMath';` and re-export it is NOT needed — consumers import it from heatmapMath.

Run the test → PASS.

- [ ] **Step 4: Wire HeatmapCard**

In `src/components/HeatmapCard.tsx`:

- Extend `Props`:

```ts
  /** Map of YYYY-MM-DD → activity sessions that day, grouped by activity. */
  activityData: Map<string, ActivityDayEntry[]>;
  /** Activity catalogue, used to name the legend. */
  activities: Activity[];
```

with `import type {Activity} from '../common/types';` and `import {dayPaintPair, dayTotalCount, ...} from './heatmapMath';` (keep existing named imports), plus `import {activityColor, planColor} from '../common/planColor';`.

- Replace `fillFor` with a sources-based version:

```ts
// A day is tinted by its color sources (dominant plan and/or activities):
// the pastel `bg` for a single entry, the saturated `fg` for two or more —
// mixed days always have 2+ entries, so blends always render in fg strength.
function fillFor(sources: DaySources): string {
  const pair = dayPaintPair(sources);
  if (!pair) return CELL_EMPTY;
  return dayTotalCount(sources) >= 2 ? pair.fg : pair.bg;
}
```

(import `DaySources` type too) and at the cell render site build the sources:

```ts
const sources: DaySources = {
  plan: data.get(key),
  activities: activityData.get(key),
};
```

passing `fillFor(sources)` where `fillFor(datum)` was.

- Streak/last-30/empty-state now count activity days too (the card is the whole activity picture):

```ts
const trainedSet = React.useMemo(
  () => new Set([...data.keys(), ...activityData.keys()]),
  [data, activityData],
);
const isEmpty = data.size === 0 && activityData.size === 0;
```

(replace the existing `trainedSet` memo and `isEmpty`; `streak`/`last30` keep reading `trainedSet`.)

- Legend: after `legendPlans`, add

```ts
const legendActivities = React.useMemo(() => {
  const ids = new Set<number>();
  for (const list of activityData.values())
    for (const e of list) ids.add(e.activityId);
  return activities.filter(a => ids.has(a.id));
}, [activityData, activities]);
```

render it in the same legend row (condition becomes `legendPlans.length > 0 || legendActivities.length > 0`):

```tsx
{legendActivities.map(a => (
  <View key={`act-${a.id}`} style={styles.legendItem}>
    <View
      style={[
        styles.legendSwatch,
        {backgroundColor: activityColor(a.id).fg},
      ]}
    />
    <AppText style={styles.legendText}>{a.name.toUpperCase()}</AppText>
  </View>
))}
```

- [ ] **Step 5: Wire Home.tsx**

- Add state:

```ts
const [activityHeat, setActivityHeat] = React.useState<
  Map<string, ActivityDayEntry[]>
>(new Map());
const [activities, setActivities] = React.useState<Activity[]>([]);
```

(`import type {ActivityDayEntry} from '../components/heatmapMath';`, extend the types import with `Activity`, extend the databaseService import with `fetchActivities, fetchActivityHeatmapData`.)

- In `refresh`, extend both `Promise.all` calls (normal + self-heal branch) to five fetches:

```ts
let [s, p, h, ah, acts] = await Promise.all([
  fetchHomeSummary(db),
  fetchPlans(db),
  fetchHeatmapData(db, fromKey),
  fetchActivityHeatmapData(db, fromKey),
  fetchActivities(db),
]);
```

(self-heal branch identical with `db2`), then `setActivityHeat(ah); setActivities(acts);` next to the other setters.

- Pass to the card: `<HeatmapCard data={heatmap} plans={plans} activityData={activityHeat} activities={activities} />`.

- [ ] **Step 6: Verify**

`npm run test` → all suites PASS (App smoke included).
`node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/(components/HeatmapCard|screens/Home|common/databaseService)'` → empty (Home/HeatmapCard/databaseService were previously clean; Routes noise is pre-existing and not in this grep).
`node_modules/.bin/eslint src/components/HeatmapCard.tsx src/screens/Home.tsx src/common/databaseService.ts` → no errors.

- [ ] **Step 7: Commit**

```bash
git add src/common/databaseService.ts src/components/HeatmapCard.tsx src/screens/Home.tsx __tests__/activityService.test.ts
git commit -m "feat(home): activities on the heatmap with blended mixed days"
```

---

### Task 6: CurrentWeekStrip — activity ✓ on unscheduled days

**Files:**
- Modify: `src/components/CurrentWeekStrip.tsx`
- Modify: `src/screens/Home.tsx` (one prop)

**Interfaces:**
- Consumes: `dayPaintPair`, `DaySources`, `ActivityDayEntry` (Task 4); `activityHeat` state (Task 5).
- Produces: `CurrentWeekStrip` gains prop `activityData: Map<string, ActivityDayEntry[]>`.

**Semantics (unchanged parts are load-bearing):** scheduled days stay a checklist driven by `completedWeekdays` — an activity never checks off a gym session. The progress bar stays scheduled-training-days-only. Only the *unscheduled* branch widens: trained-that-day now means "plan session OR activity that day", painted via `dayPaintPair`.

- [ ] **Step 1: Implement**

- Add to `Props`: `activityData: Map<string, ActivityDayEntry[]>;` with `import {currentWeekCells, dayPaintPair} from './heatmapMath';` and `import type {ActivityDayEntry, DaySources} from './heatmapMath';`.
- Inside the cell `.map()`, replace the paint derivation. Current code derives `done`/`paintId`/`c`; new version (scheduled branch identical, unscheduled branch source-based):

```tsx
{cells.map((cell, i) => {
  // Scheduled cells are a checklist (✓ = that weekday's session is
  // finished, in the active plan's colour); unscheduled cells keep the
  // calendar view — now including activities — painted by the day's
  // color sources (blended when plan + activity share the day).
  const sources: DaySources = {
    plan: data.get(cell.key),
    activities: activityData.get(cell.key),
  };
  const unscheduledPair = cell.scheduled ? null : dayPaintPair(sources);
  const done = cell.scheduled ? completedWeekdays.has(i) : !!unscheduledPair;
  const c = cell.scheduled
    ? done && activePlanId != null
      ? planColor(activePlanId)
      : null
    : unscheduledPair;
  ...
```

The subsequent `labelColor` / `mark` / `markColor` / cell-style expressions keep using `c` exactly as before (they only read `c.bg` / `c.fg`), so they need no change.

- In `src/screens/Home.tsx`, pass `activityData={activityHeat}` to `<CurrentWeekStrip …>`.

- [ ] **Step 2: Verify**

`npm run test` → PASS (`__tests__/heatmapMath.test.ts` already covers `dayPaintPair`; the strip has no other new logic).
`node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/(components/CurrentWeekStrip|screens/Home)'` → empty.
`node_modules/.bin/eslint src/components/CurrentWeekStrip.tsx src/screens/Home.tsx` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CurrentWeekStrip.tsx src/screens/Home.tsx
git commit -m "feat(home): week strip shows activities on unscheduled days"
```

---

### Task 7: activityStats helpers + Activities screen (read-only list) + fifth tab

**Files:**
- Create: `src/components/activityStats.ts`
- Create: `src/screens/Activities.tsx`
- Modify: `src/Routes.tsx`
- Test: `__tests__/activityStats.test.ts` (create)

**Interfaces:**
- Consumes: `fetchActivities`, `fetchActivitySessions`, `ActivitySession`, `Activity` (Task 1); `isoDate`, `startOfWeek` (heatmapMath); `activityColor` (Task 3).
- Produces (from `src/components/activityStats`):

```ts
export function parseIsoDate(s: string): Date; // 'YYYY-MM-DD' → local-midnight Date
export function isoWeekNumber(d: Date): number;
export interface ActivityTotals {
  activityId: number;
  activityName: string;
  count: number;
  minutes: number; // sum of recorded durations only
}
export interface WeekGroup {
  key: string;    // isoDate of the week's Monday
  label: string;  // e.g. 'W32 2026'
  sessions: ActivitySession[]; // newest first within the week
  totals: ActivityTotals[];    // ordered by activityId
}
export function groupByIsoWeek(sessions: ActivitySession[]): WeekGroup[]; // newest week first
export function formatTotals(totals: ActivityTotals[]): string; // 'SURF 3× / 5.0H · ALTINHA 1×'
```

Hours format: `minutes/60` with one decimal, suffix `H`; the `/ X.XH` part is omitted when `minutes === 0`. Separator between activities: ` · `.

- [ ] **Step 1: Write the failing tests** — create `__tests__/activityStats.test.ts`:

```ts
import type {ActivitySession} from '../src/common/types';
import {
  formatTotals,
  groupByIsoWeek,
  isoWeekNumber,
  parseIsoDate,
} from '../src/components/activityStats';

function sess(over: Partial<ActivitySession>): ActivitySession {
  return {
    id: 1,
    activity_id: 1,
    activity_slug: 'surf',
    activity_name: 'Surf',
    performed_at: '2026-08-05',
    duration_minutes: null,
    spot: null,
    note: null,
    created_at: '2026-08-05 12:00:00',
    ...over,
  };
}

describe('parseIsoDate / isoWeekNumber', () => {
  it('parses as local midnight', () => {
    const d = parseIsoDate('2026-08-05');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 5]);
    expect(d.getHours()).toBe(0);
  });

  it('computes ISO week numbers across year edges', () => {
    expect(isoWeekNumber(parseIsoDate('2026-08-05'))).toBe(32);
    expect(isoWeekNumber(parseIsoDate('2026-01-01'))).toBe(1);
    expect(isoWeekNumber(parseIsoDate('2027-01-01'))).toBe(53); // Fri → ISO week 53 of 2026
  });
});

describe('groupByIsoWeek', () => {
  it('groups sessions into ISO weeks, newest week first', () => {
    const groups = groupByIsoWeek([
      sess({id: 3, performed_at: '2026-08-05', duration_minutes: 90}),
      sess({id: 2, performed_at: '2026-08-03', activity_id: 2, activity_name: 'Altinha', activity_slug: 'altinha', duration_minutes: 120}),
      sess({id: 1, performed_at: '2026-07-28', duration_minutes: 60}),
    ]);
    expect(groups.map(g => g.key)).toEqual(['2026-08-03', '2026-07-27']);
    expect(groups[0].label).toBe('W32 2026');
    expect(groups[0].sessions.map(s => s.id)).toEqual([3, 2]);
    expect(groups[0].totals).toEqual([
      {activityId: 1, activityName: 'Surf', count: 1, minutes: 90},
      {activityId: 2, activityName: 'Altinha', count: 1, minutes: 120},
    ]);
  });

  it('counts untimed sessions without minutes', () => {
    const [g] = groupByIsoWeek([
      sess({id: 1, duration_minutes: 60}),
      sess({id: 2, duration_minutes: null}),
    ]);
    expect(g.totals).toEqual([
      {activityId: 1, activityName: 'Surf', count: 2, minutes: 60},
    ]);
  });
});

describe('formatTotals', () => {
  it('formats counts and hours, omitting hours at 0 minutes', () => {
    expect(
      formatTotals([
        {activityId: 1, activityName: 'Surf', count: 3, minutes: 300},
        {activityId: 2, activityName: 'Altinha', count: 1, minutes: 0},
      ]),
    ).toBe('SURF 3× / 5.0H · ALTINHA 1×');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `node_modules/.bin/jest __tests__/activityStats.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/components/activityStats.ts`**

```ts
// src/components/activityStats.ts
//
// Pure ISO-week grouping/aggregation for activity sessions. Lives next to
// heatmapMath (same extraction rationale: unit-testable without React Native).

import type {ActivitySession} from '../common/types';
import {isoDate, startOfWeek} from './heatmapMath';

/** 'YYYY-MM-DD' → Date at local midnight. `new Date('YYYY-MM-DD')` would parse
 * as UTC and shift the calendar day for west-of-UTC users — never use it. */
export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** ISO-8601 week number (the week containing the year's first Thursday). */
export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export interface ActivityTotals {
  activityId: number;
  activityName: string;
  count: number;
  minutes: number;
}

export interface WeekGroup {
  key: string;
  label: string;
  sessions: ActivitySession[];
  totals: ActivityTotals[];
}

/** Fold newest-first sessions into ISO-week groups (newest week first —
 * input order is preserved, fetchActivitySessions already sorts DESC). */
export function groupByIsoWeek(sessions: ActivitySession[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  for (const s of sessions) {
    const day = parseIsoDate(s.performed_at);
    const monday = startOfWeek(day);
    const key = isoDate(monday);
    let group = map.get(key);
    if (!group) {
      // The ISO week-numbering year can differ from monday's calendar year
      // around New Year; anchor the label's year on the week's Thursday.
      const thursday = new Date(monday);
      thursday.setDate(monday.getDate() + 3);
      group = {
        key,
        label: `W${isoWeekNumber(monday)} ${thursday.getFullYear()}`,
        sessions: [],
        totals: [],
      };
      map.set(key, group);
    }
    group.sessions.push(s);
    let t = group.totals.find(x => x.activityId === s.activity_id);
    if (!t) {
      t = {
        activityId: s.activity_id,
        activityName: s.activity_name,
        count: 0,
        minutes: 0,
      };
      group.totals.push(t);
      group.totals.sort((a, b) => a.activityId - b.activityId);
    }
    t.count += 1;
    t.minutes += s.duration_minutes ?? 0;
  }
  return Array.from(map.values());
}

/** 'SURF 3× / 5.0H · ALTINHA 1×' — hours omitted when nothing was timed. */
export function formatTotals(totals: ActivityTotals[]): string {
  return totals
    .map(t => {
      const hours =
        t.minutes > 0 ? ` / ${(t.minutes / 60).toFixed(1)}H` : '';
      return `${t.activityName.toUpperCase()} ${t.count}×${hours}`;
    })
    .join(' · ');
}
```

Run: `node_modules/.bin/jest __tests__/activityStats.test.ts` → PASS.

- [ ] **Step 4: Create the screen (read-only for now)** — `src/screens/Activities.tsx`:

```tsx
// src/screens/Activities.tsx
//
// Fifth bottom tab: the free-form activity log (surf, altinha). List of
// sessions grouped by ISO week with per-week totals. Add/edit arrives with
// ActivitySessionModal (separate task); this screen is read-only until then.

import React from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {SectionList, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from '../components/AppText';
import ErrorComp from '../components/Error';
import Loading from '../components/Loading';

import {colors} from '../common/theme';
import {activityColor} from '../common/planColor';
import {
  fetchActivities,
  fetchActivitySessions,
  getDBConnection,
} from '../common/databaseService';
import {
  formatTotals,
  groupByIsoWeek,
  parseIsoDate,
} from '../components/activityStats';
import type {Activity, ActivitySession} from '../common/types';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dayLabel(performedAt: string): string {
  const d = parseIsoDate(performedAt);
  return `${DAY_NAMES[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

const Activities: React.FC = () => {
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [sessions, setSessions] = React.useState<ActivitySession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [initError, setInitError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    const db = await getDBConnection();
    setActivities(await fetchActivities(db));
    setSessions(await fetchActivitySessions(db));
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          await refresh();
        } catch (err) {
          setInitError(err as Error);
        } finally {
          setLoading(false);
        }
      })();
    }, [refresh]),
  );

  if (loading) return <Loading text="Loading activities" />;
  if (initError) return <ErrorComp error={initError} />;

  const groups = groupByIsoWeek(sessions);
  const sections = groups.map(g => ({
    title: g.label,
    subtitle: formatTotals(g.totals),
    data: g.sessions,
  }));

  return (
    <View style={styles.container}>
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <MaterialIcons name="surfing" size={32} color={colors.primary} />
            </View>
            <AppText bold style={styles.emptyTitle}>
              NO ACTIVITIES YET
            </AppText>
            <AppText style={styles.emptyBody}>
              Surf sessions and altinha games live here — logged free-form,
              no plan attached.
            </AppText>
          </View>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={s => String(s.id)}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.list}
          renderSectionHeader={({section}) => (
            <View style={styles.sectionHeader}>
              <AppText bold style={styles.sectionTitle}>
                {section.title}
              </AppText>
              <AppText style={styles.sectionSubtitle}>
                {section.subtitle}
              </AppText>
            </View>
          )}
          renderItem={({item}) => <SessionRow session={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const SessionRow: React.FC<{session: ActivitySession}> = ({session}) => {
  const c = activityColor(session.activity_id);
  return (
    <View style={styles.row}>
      <View style={[styles.rail, {backgroundColor: c.fg}]} />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <AppText bold style={[styles.rowActivity, {color: c.fg}]}>
            {session.activity_name.toUpperCase()}
          </AppText>
          <AppText style={styles.rowDate}>
            {dayLabel(session.performed_at)}
          </AppText>
        </View>
        <View style={styles.rowMeta}>
          <AppText style={styles.rowMetaText}>
            {session.duration_minutes != null
              ? `${session.duration_minutes} MIN`
              : '—'}
          </AppText>
          {!!session.spot && (
            <AppText style={styles.rowMetaText}>
              {session.spot.toUpperCase()}
            </AppText>
          )}
        </View>
        {!!session.note && (
          <AppText style={styles.rowNote}>{session.note}</AppText>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.cream},
  list: {padding: 16, paddingBottom: 96},
  sectionHeader: {
    backgroundColor: colors.cream,
    paddingVertical: 8,
    gap: 2,
  },
  sectionTitle: {fontSize: 11, color: colors.faint, letterSpacing: 2},
  sectionSubtitle: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  separator: {height: 10},
  row: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  rail: {width: 3},
  rowBody: {flex: 1, padding: 12, gap: 4},
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowActivity: {fontSize: 12, letterSpacing: 1.4},
  rowDate: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  rowMeta: {flexDirection: 'row', gap: 12},
  rowMetaText: {fontSize: 11, color: colors.muted, letterSpacing: 1},
  rowNote: {fontSize: 13, color: colors.ink, lineHeight: 18},
  empty: {flex: 1, justifyContent: 'center', padding: 16},
  emptyCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 24,
    gap: 14,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    backgroundColor: colors.warnBg,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {fontSize: 14, letterSpacing: 2, color: colors.ink},
  emptyBody: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
});

export default Activities;
```

- [ ] **Step 5: Register the tab** — in `src/Routes.tsx` add `import ActivitiesScreen from './screens/Activities';` and, between the Weeks and Sessions screens:

```tsx
<Tab.Screen
  name="Activities"
  component={ActivitiesScreen}
  options={{tabBarIcon: renderTabBarIcon('surfing')}}
/>
```

- [ ] **Step 6: Verify**

`npm run test` → PASS (incl. App smoke — bottom tabs are lazy, the new screen doesn't mount there).
`node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/(components/activityStats|screens/Activities)\.'` → empty. (Routes.tsx has pre-existing screen-typing noise — check only that its error list is unchanged vs. HEAD if unsure.)
`node_modules/.bin/eslint src/components/activityStats.ts src/screens/Activities.tsx src/Routes.tsx` → no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/activityStats.ts src/screens/Activities.tsx src/Routes.tsx __tests__/activityStats.test.ts
git commit -m "feat(activities): fifth tab with ISO-week grouped session log"
```

---

### Task 8: ActivitySessionModal — add, edit, delete

**Files:**
- Create: `src/components/ActivitySessionModal.tsx`
- Modify: `src/screens/Activities.tsx`

**Interfaces:**
- Consumes: `Activity`, `ActivitySession`, `ActivitySessionDraft` types; `createActivitySession`, `updateActivitySession`, `deleteActivitySession` (Task 1); `isoDate` (heatmapMath), `parseIsoDate` (activityStats); `TacticalButton`, `AppInput`, theme tokens.
- Produces: `ActivitySessionModal` with props:

```ts
interface Props {
  visible: boolean;
  activities: Activity[];
  /** null = create mode; a session = edit mode (fields prefilled). */
  initial: ActivitySession | null;
  onSave: (draft: ActivitySessionDraft) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}
```

**Form spec:** activity pills (one per catalogue entry, selected = filled with `activityColor(id).fg`, default = first activity / the initial session's); date row `◀  WED 05.08.  ▶` stepping ±1 day, `▶` disabled at today, default today (no date-picker dependency); duration quick-chips `30/60/90/120` + free numeric input (Android numField fixes), empty = null; spot + note as plain `TextInput`s (note multiline), empty = null; footer `SAVE` (TacticalButton primary), `CANCEL` (outline), and in edit mode `DELETE` (dark). Save is disabled while no activity is selected (can't happen in practice — a default is always set).

- [ ] **Step 1: Implement the modal** — create `src/components/ActivitySessionModal.tsx`:

```tsx
// src/components/ActivitySessionModal.tsx
//
// Create/edit sheet for one activity session. Deliberately dependency-free:
// date = day stepper (backdating is the use case, not arbitrary jumps),
// duration = quick chips + numeric field.

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import TacticalButton from './TacticalButton';
import {colors} from '../common/theme';
import {activityColor} from '../common/planColor';
import {isoDate} from './heatmapMath';
import {parseIsoDate} from './activityStats';
import type {
  Activity,
  ActivitySession,
  ActivitySessionDraft,
} from '../common/types';

interface Props {
  visible: boolean;
  activities: Activity[];
  initial: ActivitySession | null;
  onSave: (draft: ActivitySessionDraft) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

const DURATION_CHIPS = [30, 60, 90, 120];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function stepDay(dateStr: string, delta: number): string {
  const d = parseIsoDate(dateStr);
  d.setDate(d.getDate() + delta);
  return isoDate(d);
}

function dateLabel(dateStr: string): string {
  const d = parseIsoDate(dateStr);
  return `${DAY_NAMES[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

const ActivitySessionModal: React.FC<Props> = ({
  visible,
  activities,
  initial,
  onSave,
  onDelete,
  onClose,
}) => {
  const [activityId, setActivityId] = React.useState<number>(0);
  const [performedAt, setPerformedAt] = React.useState<string>('');
  const [duration, setDuration] = React.useState<string>('');
  const [spot, setSpot] = React.useState<string>('');
  const [note, setNote] = React.useState<string>('');

  // Re-seed the form whenever the sheet opens (or switches session).
  React.useEffect(() => {
    if (!visible) return;
    setActivityId(initial?.activity_id ?? activities[0]?.id ?? 0);
    setPerformedAt(initial?.performed_at ?? isoDate(new Date()));
    setDuration(
      initial?.duration_minutes != null ? String(initial.duration_minutes) : '',
    );
    setSpot(initial?.spot ?? '');
    setNote(initial?.note ?? '');
  }, [visible, initial, activities]);

  const todayKey = isoDate(new Date());
  const parsedDuration = parseInt(duration, 10);
  const durationMinutes =
    Number.isFinite(parsedDuration) && parsedDuration > 0
      ? parsedDuration
      : null;

  function handleSave() {
    onSave({
      activityId,
      performedAt,
      durationMinutes,
      spot: spot.trim() || null,
      note: note.trim() || null,
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
              {initial ? 'EDIT ACTIVITY' : 'LOG ACTIVITY'}
            </AppText>

            <AppText style={styles.fieldLabel}>ACTIVITY</AppText>
            <View style={styles.pillRow}>
              {activities.map(a => {
                const selected = a.id === activityId;
                const c = activityColor(a.id);
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setActivityId(a.id)}
                    accessibilityRole="button"
                    accessibilityState={{selected}}
                    style={[
                      styles.pill,
                      {borderColor: c.fg},
                      selected && {backgroundColor: c.fg},
                    ]}>
                    <AppText
                      bold
                      style={[
                        styles.pillText,
                        {color: selected ? '#FFFFFF' : c.fg},
                      ]}>
                      {a.name.toUpperCase()}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <AppText style={styles.fieldLabel}>DATE</AppText>
            <View style={styles.dateRow}>
              <Pressable
                onPress={() => setPerformedAt(stepDay(performedAt, -1))}
                accessibilityLabel="Previous day"
                style={styles.dateStep}>
                <MaterialIcons
                  name="chevron-left"
                  size={24}
                  color={colors.ink}
                />
              </Pressable>
              <AppText bold style={styles.dateLabel}>
                {performedAt ? dateLabel(performedAt) : ''}
              </AppText>
              <Pressable
                onPress={() => setPerformedAt(stepDay(performedAt, 1))}
                disabled={performedAt >= todayKey}
                accessibilityLabel="Next day"
                style={[
                  styles.dateStep,
                  performedAt >= todayKey && styles.dateStepDisabled,
                ]}>
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color={colors.ink}
                />
              </Pressable>
            </View>

            <AppText style={styles.fieldLabel}>DURATION (MIN)</AppText>
            <View style={styles.pillRow}>
              {DURATION_CHIPS.map(m => {
                const selected = duration === String(m);
                return (
                  <Pressable
                    key={m}
                    onPress={() => setDuration(selected ? '' : String(m))}
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
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={colors.ghost}
                accessibilityLabel="Duration in minutes"
                style={styles.numField}
              />
            </View>

            <AppText style={styles.fieldLabel}>SPOT</AppText>
            <TextInput
              value={spot}
              onChangeText={setSpot}
              placeholder="e.g. Uluwatu / Praia do Forte"
              placeholderTextColor={colors.ghost}
              accessibilityLabel="Spot"
              style={styles.textField}
            />

            <AppText style={styles.fieldLabel}>NOTE</AppText>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Conditions, people, how it went…"
              placeholderTextColor={colors.ghost}
              multiline
              numberOfLines={3}
              accessibilityLabel="Note"
              style={[styles.textField, styles.noteField]}
            />

            <View style={styles.footer}>
              <TacticalButton
                title="Save"
                onPress={handleSave}
                disabled={activityId === 0}
                fullWidth
              />
              {!!initial && (
                <TacticalButton
                  title="Delete"
                  variant="dark"
                  icon="delete-outline"
                  onPress={() => onDelete(initial.id)}
                  fullWidth
                />
              )}
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
  title: {fontSize: 13, letterSpacing: 2, color: colors.ink, marginBottom: 4},
  fieldLabel: {
    fontSize: 10,
    color: colors.faint,
    letterSpacing: 1.4,
    marginTop: 8,
  },
  pillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  pill: {
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  pillText: {fontSize: 12, letterSpacing: 1.4},
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  dateStep: {padding: 12},
  dateStepDisabled: {opacity: 0.3},
  dateLabel: {
    fontSize: 14,
    letterSpacing: 1.4,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
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
    paddingHorizontal: 10,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  textField: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.paper,
    color: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  noteField: {minHeight: 72, textAlignVertical: 'top'},
  footer: {gap: 8, marginTop: 16},
});

export default ActivitySessionModal;
```

- [ ] **Step 2: Wire into the screen** — in `src/screens/Activities.tsx`:

- Add imports: `Pressable`, `Toast` (`../components/Toast`), `TacticalButton`, `ActivitySessionModal`, and `createActivitySession, updateActivitySession, deleteActivitySession` from databaseService, `ActivitySessionDraft` type.
- Add state:

```ts
const [editing, setEditing] = React.useState<ActivitySession | null>(null);
const [modalVisible, setModalVisible] = React.useState(false);
const [error, setError] = React.useState<Error | null>(null);
```

- Handlers:

```ts
async function handleSave(draft: ActivitySessionDraft) {
  try {
    const db = await getDBConnection();
    if (editing) await updateActivitySession(db, editing.id, draft);
    else await createActivitySession(db, draft);
    setModalVisible(false);
    setEditing(null);
    await refresh();
  } catch (err) {
    setError(err as Error);
  }
}

async function handleDelete(id: number) {
  try {
    const db = await getDBConnection();
    await deleteActivitySession(db, id);
    setModalVisible(false);
    setEditing(null);
    await refresh();
  } catch (err) {
    setError(err as Error);
  }
}

function openCreate() {
  setEditing(null);
  setModalVisible(true);
}

function openEdit(session: ActivitySession) {
  setEditing(session);
  setModalVisible(true);
}
```

- Make rows tappable: `<SessionRow session={item} onPress={() => openEdit(item)} />`, with `SessionRow` wrapping its content in a `Pressable` (`accessibilityRole="button"`, `style={({pressed}) => [styles.row, pressed && {opacity: 0.85}]}`; move the `styles.row` off the outer View).
- Empty state gains `<TacticalButton title="Log Your First Session" icon="add" onPress={openCreate} fullWidth />` inside `emptyCard`.
- Non-empty view gains the same FAB as `Weeks.tsx` (copy the `fab`/`fabPressed` styles verbatim, minus the disabled variant):

```tsx
{sections.length > 0 && (
  <Pressable
    onPress={openCreate}
    accessibilityLabel="Log activity"
    style={({pressed}) => [styles.fab, pressed && styles.fabPressed]}>
    <MaterialIcons name="add" size={28} color="#FFFFFF" />
  </Pressable>
)}
```

- Render at the bottom of the root View:

```tsx
<ActivitySessionModal
  visible={modalVisible}
  activities={activities}
  initial={editing}
  onSave={handleSave}
  onDelete={handleDelete}
  onClose={() => {
    setModalVisible(false);
    setEditing(null);
  }}
/>
{!!error && (
  <Toast
    type="error"
    message={error.message}
    onClose={() => setError(null)}
  />
)}
```

- [ ] **Step 3: Verify**

`npm run test` → PASS.
`node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/(components/ActivitySessionModal|screens/Activities)'` → empty.
`node_modules/.bin/eslint src/components/ActivitySessionModal.tsx src/screens/Activities.tsx` → no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ActivitySessionModal.tsx src/screens/Activities.tsx
git commit -m "feat(activities): log/edit/delete sessions via modal sheet"
```

---

### Task 9: Weekly bars header

**Files:**
- Modify: `src/components/activityStats.ts` (add `weeklyBarData`)
- Create: `src/components/ActivityWeeklyBars.tsx`
- Modify: `src/screens/Activities.tsx`
- Test: `__tests__/activityStats.test.ts` (append)

**Interfaces:**
- Consumes: `activityColor` (Task 3), `isoDate`/`startOfWeek` (heatmapMath), `Activity` type.
- Produces (from `activityStats`):

```ts
export const UNTIMED_PLINTH_MINUTES = 15; // untimed sessions still get a visible sliver
export interface WeekBar {
  key: string;   // Monday isoDate
  label: string; // 'W32'
  segments: {activityId: number; minutes: number}[]; // ordered by activityId
  totalMinutes: number;
}
export function weeklyBarData(
  sessions: ActivitySession[],
  today: Date,
  weeksBack?: number, // default 8
): WeekBar[]; // oldest → newest, exactly weeksBack entries, gap weeks included with empty segments
```

Segment minutes = recorded durations + `UNTIMED_PLINTH_MINUTES` per untimed session (bars are a visual gauge; the *list* totals stay honest and exclude the plinth).

- [ ] **Step 1: Write the failing test** — append to `__tests__/activityStats.test.ts` (extend the import with `weeklyBarData, UNTIMED_PLINTH_MINUTES`):

```ts
describe('weeklyBarData', () => {
  const today = parseIsoDate('2026-08-05'); // Wednesday, ISO week 32

  it('returns one bar per week incl. empty gap weeks, oldest first', () => {
    const bars = weeklyBarData(
      [
        sess({id: 1, performed_at: '2026-08-04', duration_minutes: 90}),
        sess({id: 2, performed_at: '2026-07-20', duration_minutes: 60}),
      ],
      today,
      4,
    );
    expect(bars.map(b => b.label)).toEqual(['W29', 'W30', 'W31', 'W32']);
    expect(bars[0].totalMinutes).toBe(0); // W29 empty
    expect(bars[1].totalMinutes).toBe(60); // 2026-07-20 is the Monday of W30
    expect(bars[2].totalMinutes).toBe(0);
    expect(bars[3].totalMinutes).toBe(90);
  });

  it('stacks per activity and adds the plinth for untimed sessions', () => {
    const bars = weeklyBarData(
      [
        sess({id: 1, performed_at: '2026-08-04', duration_minutes: 90}),
        sess({
          id: 2,
          performed_at: '2026-08-05',
          activity_id: 2,
          activity_name: 'Altinha',
          activity_slug: 'altinha',
          duration_minutes: null,
        }),
      ],
      today,
      1,
    );
    expect(bars).toHaveLength(1);
    expect(bars[0].segments).toEqual([
      {activityId: 1, minutes: 90},
      {activityId: 2, minutes: UNTIMED_PLINTH_MINUTES},
    ]);
    expect(bars[0].totalMinutes).toBe(90 + UNTIMED_PLINTH_MINUTES);
  });

  it('ignores sessions older than the window', () => {
    const bars = weeklyBarData(
      [sess({id: 1, performed_at: '2026-01-05', duration_minutes: 60})],
      today,
      2,
    );
    expect(bars.every(b => b.totalMinutes === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `node_modules/.bin/jest __tests__/activityStats.test.ts` → new describe FAILS.

- [ ] **Step 3: Implement `weeklyBarData`** — append to `src/components/activityStats.ts`:

```ts
export const UNTIMED_PLINTH_MINUTES = 15;

export interface WeekBar {
  key: string;
  label: string;
  segments: {activityId: number; minutes: number}[];
  totalMinutes: number;
}

/** The last `weeksBack` ISO weeks (ending with the week of `today`) as
 * stacked-bar data, oldest first. Weeks without sessions are present with
 * empty segments so the x-axis has no gaps. Untimed sessions contribute a
 * fixed plinth so they stay visible — gauge only, the list totals stay
 * honest and exclude it. */
export function weeklyBarData(
  sessions: ActivitySession[],
  today: Date,
  weeksBack: number = 8,
): WeekBar[] {
  const bars: WeekBar[] = [];
  const byKey = new Map<string, WeekBar>();
  const currentMonday = startOfWeek(today);
  for (let i = weeksBack - 1; i >= 0; i--) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - i * 7);
    const bar: WeekBar = {
      key: isoDate(monday),
      label: `W${isoWeekNumber(monday)}`,
      segments: [],
      totalMinutes: 0,
    };
    bars.push(bar);
    byKey.set(bar.key, bar);
  }
  for (const s of sessions) {
    const key = isoDate(startOfWeek(parseIsoDate(s.performed_at)));
    const bar = byKey.get(key);
    if (!bar) continue;
    const minutes = s.duration_minutes ?? UNTIMED_PLINTH_MINUTES;
    let seg = bar.segments.find(x => x.activityId === s.activity_id);
    if (!seg) {
      seg = {activityId: s.activity_id, minutes: 0};
      bar.segments.push(seg);
      bar.segments.sort((a, b) => a.activityId - b.activityId);
    }
    seg.minutes += minutes;
    bar.totalMinutes += minutes;
  }
  return bars;
}
```

Run: `node_modules/.bin/jest __tests__/activityStats.test.ts` → PASS.

- [ ] **Step 4: Create `src/components/ActivityWeeklyBars.tsx`**

```tsx
// src/components/ActivityWeeklyBars.tsx
//
// Last-8-weeks stacked hour bars for the Activities tab. Plain Views in the
// progress-bar idiom — deliberately not victory-native (see design spec).

import React from 'react';
import {StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {colors} from '../common/theme';
import {activityColor} from '../common/planColor';
import {weeklyBarData} from './activityStats';
import type {ActivitySession} from '../common/types';

interface Props {
  sessions: ActivitySession[];
}

const BAR_AREA_HEIGHT = 96;

const ActivityWeeklyBars: React.FC<Props> = ({sessions}) => {
  const today = React.useMemo(() => new Date(), []);
  const bars = React.useMemo(
    () => weeklyBarData(sessions, today),
    [sessions, today],
  );
  const max = Math.max(...bars.map(b => b.totalMinutes), 1);

  return (
    <View style={styles.card}>
      <AppText bold style={styles.label}>
        HOURS / WEEK
      </AppText>
      <View style={styles.barRow}>
        {bars.map(bar => (
          <View key={bar.key} style={styles.barCol}>
            <View style={styles.hourWrap}>
              {bar.totalMinutes > 0 && (
                <AppText style={styles.hourText}>
                  {(bar.totalMinutes / 60).toFixed(1)}
                </AppText>
              )}
            </View>
            <View style={styles.barArea}>
              {bar.segments.map(seg => (
                <View
                  key={seg.activityId}
                  style={{
                    height: Math.max(
                      2,
                      (seg.minutes / max) * BAR_AREA_HEIGHT,
                    ),
                    backgroundColor: activityColor(seg.activityId).fg,
                  }}
                />
              ))}
            </View>
            <AppText style={styles.weekLabel}>{bar.label}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 16,
    gap: 12,
  },
  label: {fontSize: 11, color: colors.faint, letterSpacing: 1.4},
  barRow: {flexDirection: 'row', gap: 6, alignItems: 'flex-end'},
  barCol: {flex: 1, gap: 4, alignItems: 'stretch'},
  hourWrap: {height: 14, justifyContent: 'flex-end'},
  hourText: {
    fontSize: 9,
    color: colors.muted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  barArea: {
    height: BAR_AREA_HEIGHT,
    justifyContent: 'flex-end',
    gap: 1,
  },
  weekLabel: {
    fontSize: 8,
    color: colors.faint,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});

export default ActivityWeeklyBars;
```

- [ ] **Step 5: Mount it** — in `src/screens/Activities.tsx`, render `<ActivityWeeklyBars sessions={sessions} />` above the list: pass it as the SectionList's `ListHeaderComponent` (wrapped in a `View` with `marginBottom: 12`) so it scrolls with the content. Not shown in the empty state.

- [ ] **Step 6: Verify + commit**

`npm run test` → PASS. `node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/(components/ActivityWeeklyBars|components/activityStats|screens/Activities)'` → empty. `node_modules/.bin/eslint src/components/ActivityWeeklyBars.tsx src/components/activityStats.ts src/screens/Activities.tsx` → clean.

```bash
git add src/components/ActivityWeeklyBars.tsx src/components/activityStats.ts src/screens/Activities.tsx __tests__/activityStats.test.ts
git commit -m "feat(activities): weekly hour bars"
```

---

### Task 10: Quotes curation

**Files:**
- Modify: `src/common/quotes.ts`

No test file — data-only change; verification is a count + tsc.

- [ ] **Step 1: Remove these 15 entries** (exact strings incl. curly apostrophes as in the file; one Edit each or one MultiEdit):

1. `"I'm not saying I hate you, but I would unplug your life support to charge my phone."`
2. `"Be yourself; everyone else is already taken. Unfortunately, being yourself isn't all that great either."`
3. `'If you think the grass is greener on the other side, you’re probably looking at artificial turf.'`
4. `'Why does a slight tax increase cost you $200 and a substantial tax cut save you 30 cents?'`
5. `'In the journey of life, I choose the psycho path.'`
6. `"If you can't make it good, at least make it look good. Said every politician ever."`
7. `'If you think you’re too small to be effective, you’ve never been in bed with a mosquito.'`
8. `'History teaches us that men and nations behave wisely once they have exhausted all other alternatives.'`
9. `'The best way to lie is to tell the truth, carefully edited truth.'`
10. `'If you think you are too small to make a difference, try sleeping with a mosquito.'`
11. `'Everybody brings joy to this office. Some when they enter, others when they leave.'`
12. `"Keep rolling your eyes. Maybe you'll find a brain back there."`
13. `"If you can't beat them, arrange to have them beaten."`
14. `'Don’t be irreplaceable. If you can’t be replaced, you can’t be promoted.'`
15. `'War does not determine who is right — only who is left.'`

Rationale (for the commit body, condensed): near-duplicates (2× mosquito, 2× grass-is-greener → the second grass one stays), office-context (2), mean rather than dry (3), dated/political/war (4), motivational-not-demotivational (both mosquitos), weak puns (rest).

- [ ] **Step 2: Append these 15 new entries** at the end of the array (repo prettier style: single quotes where no apostrophe conflict):

```ts
  'The journey of a thousand miles begins with a single step. So does walking into a wall.',
  'Believe in yourself. Someone has to.',
  "You miss 100% of the naps you don't take.",
  'Every day is a new opportunity to lower your expectations until they match reality.',
  "Aim for the stars. That way you'll miss everything at a safe distance.",
  'You are capable of amazing things. Statistically unlikely, but capable.',
  'Every accomplishment starts with the decision to try, and ends shortly after.',
  'Your comfort zone called. It misses you. Go home.',
  'Genius is 1% inspiration and 99% checking your phone.',
  'Nothing is impossible. Which is a shame — you were counting on that excuse.',
  'The secret of getting ahead is getting started. Staying behind requires no secret at all.',
  "It's not procrastination — you're just waiting for a version of you that never shows up.",
  "Shoot for the moon. Even if you miss, you'll drift uselessly through the void, which sounds familiar.",
  "Don't put off till tomorrow what you can put off till next week.",
  'Hard days build character. Easy days build nothing, which is also fine.',
```

- [ ] **Step 3: Verify**

Count check — every entry line starts with two spaces and a quote character: `rtk proxy grep -cE "^  ['\"]" src/common/quotes.ts` must print `70`.
`node_modules/.bin/tsc --noEmit 2>&1 | grep 'src/common/quotes.ts'` → empty. `node_modules/.bin/eslint src/common/quotes.ts` → clean (prettier formatting!).

- [ ] **Step 4: Commit**

```bash
git add src/common/quotes.ts
git commit -m "feat(quotes): cull duplicates and weak entries, add 15 new"
```

---

### Task 11: Docs + full verification

**Files:**
- Modify: `CLAUDE.md` (repo root)
- No code changes — this task gates the release readiness.

- [ ] **Step 1: Update `CLAUDE.md`**

- **Data model (v2)** section: add a bullet pair under "Other" for `activities` (seed catalogue, upsert-by-slug on every start, revision-independent) and `activity_sessions` (free-form log: local-date `performed_at`, nullable `duration_minutes`/`spot`/`note`, multiple rows per day allowed, no FK into plans/weeks; DDL must stay in sync with `scripts/schema-v2.sql`).
- **Navigation** section: mention the fifth bottom tab `Activities` (ISO-week grouped log + weekly bars; add/edit via `ActivitySessionModal`, day-stepper instead of a datepicker dependency).
- **UI conventions**: document the blend rule — day cells paint via `heatmapMath.dayPaintPair` (single source = palette pair, mixed day = `mixHexColors` per variant, heatmap shows fg from 2 total entries up); strip scheduled-day checklist semantics unchanged, activities only widen the *unscheduled* branch; heatmap streak/last-30 count activity days; `activityColor` palette lives in `planColor.ts` and must stay hue-distant from the plan palette.

- [ ] **Step 2: Full verification battery**

- `npm run test` → all suites green.
- `node_modules/.bin/eslint src/` → no errors beyond the documented `src/seeds/plans/*.ts` expected ones.
- tsc diff vs HEAD (per CLAUDE.md procedure): `git worktree add --detach /tmp/ww-head HEAD && ln -s "$(pwd)/node_modules" /tmp/ww-head/node_modules`, run `node_modules/.bin/tsc --noEmit` **in the worktree** (cd-scoped single command), then run it **from the repo root as its own command**, diff the sorted error lists — the diff must show no NEW errors. Clean up: `rm /tmp/ww-head/node_modules && git worktree remove /tmp/ww-head`.

- [ ] **Step 3: Commit docs**

```bash
git add CLAUDE.md
git commit -m "docs: activity tracking architecture + conventions"
```

- [ ] **Step 4: STOP — do not release**

Version bump + `./version-update.sh` + sideload is the user's call (physical device, `adb` quirks). Report readiness instead.

---

## Self-Review (done at plan time)

- **Spec coverage:** schema/CRUD (T1), seeds/validator (T2), colors+blend (T3/T4), heatmap (T5), strip (T6), tab+list+weekly grouping (T7), add-flow/edit/delete (T8), weekly bars (T9), quotes (T10), docs/rollout gate (T11). Backup/export needs no task (whole-file copy). No `SEED_REVISION` interplay anywhere.
- **Type consistency:** `ActivityDayEntry` defined once in heatmapMath, consumed by databaseService (type-only import), HeatmapCard, Strip, Home. `ActivitySessionDraft` shared by modal + CRUD. `Activity`/`ActivitySession` only from `types.ts`.
- **Known judgment calls encoded:** streak/last-30 include activity days; bars use a 15-min plinth for untimed sessions; list totals exclude the plinth; `performed_at` is a plain local date string end-to-end (never `new Date('YYYY-MM-DD')` — always `parseIsoDate`).
