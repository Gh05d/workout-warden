# Home "This Week" Day-Strip + Plan-Colored Heatmap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact "This Week" day-strip (weekday letter + plan color per box) above the Home heatmap, and recolor the heatmap by plan with a weekday axis and legend.

**Architecture:** One data-layer change makes `fetchHeatmapData` carry the dominant plan per day. A pure helper (`currentWeekCells`) turns that map into seven Mon–Sun cells. Two thin view components (`CurrentWeekStrip` new, `HeatmapCard` upgraded) render it. Home wires them together. Testing follows the repo pattern: pure logic is unit-tested (better-sqlite3 for the query, plain Jest for the date helper); view components are verified with `eslint` + `tsc`, since the repo has no component-render harness.

**Tech Stack:** React Native 0.85 + TypeScript, `react-native-sqlite-storage` (runtime) / `better-sqlite3` (tests), Jest, ESLint + Prettier.

## Global Constraints

- **Package manager:** yarn berry is broken. Never run `yarn <cmd>`. Use `node_modules/.bin/<tool>` (jest, eslint, tsc) or `npm run <script>`.
- **Prettier is an ESLint error** for these files (none are `src/seeds/plans/*.ts`). New/modified files MUST pass `node_modules/.bin/eslint <file>` clean. Prettier config: `singleQuote`, `bracketSpacing: false` (`{foo: bar}`, no inner-brace spaces), `bracketSameLine: true`, `arrowParens: 'avoid'`, `trailingComma: 'all'`.
- **Theme tokens only:** use `colors.*` from `src/common/theme.ts` and `planColor()` from `src/common/planColor.ts`. No new hex literals in components. The one pre-existing local heatmap neutral `CELL_EMPTY = '#EDEAE4'` stays.
- **Visual language "Tactical Logbook":** square corners (no borderRadius), 1px `colors.rule` hairlines, ALL-CAPS labels with `letterSpacing`.
- **No schema/seed change.** `plan_id` is derivable via `sessions.week_id → weeks.plan_id`. Do NOT bump `SEED_REVISION`; `__tests__/seedMigration.test.ts` stays untouched.
- **`tsc --noEmit` is not clean on this repo** (known noise: `Statistics.tsx`, `Routes.tsx`, `useFetchData.tsx`, all of `__tests__/`). "No new errors" means: after your change, `tsc` output contains no error lines referencing the files you touched (except the pre-listed noise). None of the files in this plan are on the noise list, so they must be error-free.

---

### Task 1: Data layer — `fetchHeatmapData` carries the dominant plan per day

**Files:**
- Modify: `src/common/databaseService.ts:788-810` (the `fetchHeatmapData` function + a new exported interface just above it)
- Test: `__tests__/fetchHeatmapData.test.ts` (create)

**Interfaces:**
- Produces: `export interface HeatmapDatum {count: number; planId: number}` and `export async function fetchHeatmapData(db: SQLiteDatabase, fromLocalDate: string): Promise<Map<string, HeatmapDatum>>`. Same two-arg signature as before — only the return type changes.

- [ ] **Step 1: Write the failing test**

Create `__tests__/fetchHeatmapData.test.ts`:

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
import {fetchHeatmapData} from '../src/common/databaseService';

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
    `INSERT INTO plans (id, slug, name, description) VALUES
       (1, 'surf', 'Surf', null),
       (2, 'strength', 'Strength', null)`,
  );
  return {
    executeSql: async (sql: string, params: unknown[] = []) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
        const stmt = raw.prepare(sql);
        const arr = stmt.all(...params) as Record<string, unknown>[];
        return [
          {rows: {length: arr.length, item: (i: number) => arr[i], raw: () => arr}},
        ];
      }
      raw.prepare(sql).run(...params);
      return [{rows: {length: 0, item: () => null, raw: () => []}}];
    },
    _raw: raw,
  } as never;
}

// noon timestamps: DATE(x,'localtime') stays on the same calendar day for every
// real timezone offset (|offset| < 12h), so date bucketing is deterministic.
describe('fetchHeatmapData', () => {
  it('returns an empty map when nothing is trained', async () => {
    const db = makeDb();
    const map = await fetchHeatmapData(db, '2026-01-01');
    expect(map.size).toBe(0);
  });

  it('sums sessions of the same plan on one day', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, trained_at)
       VALUES (10, 1, 1, 'A', '2026-07-20 12:00:00'),
              (11, 1, 2, 'B', '2026-07-20 12:00:00')`,
    );
    const map = await fetchHeatmapData(db, '2026-01-01');
    expect(map.size).toBe(1);
    expect([...map.values()][0]).toEqual({count: 2, planId: 1});
  });

  it('picks the plan with the most sessions as dominant', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1), (2, 2)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, trained_at)
       VALUES (10, 2, 1, 'S', '2026-07-20 12:00:00'),
              (11, 1, 1, 'A', '2026-07-20 12:00:00'),
              (12, 1, 2, 'B', '2026-07-20 12:00:00')`,
    );
    const map = await fetchHeatmapData(db, '2026-01-01');
    // plan 1 has 2 sessions, plan 2 has 1 → dominant is plan 1, total count 3.
    expect([...map.values()][0]).toEqual({count: 3, planId: 1});
  });

  it('breaks a session-count tie toward the lowest plan_id', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1), (2, 2)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, trained_at)
       VALUES (10, 2, 1, 'S', '2026-07-20 12:00:00'),
              (11, 1, 1, 'A', '2026-07-20 12:00:00')`,
    );
    const map = await fetchHeatmapData(db, '2026-01-01');
    expect([...map.values()][0]).toEqual({count: 2, planId: 1});
  });

  it('excludes days before fromLocalDate', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, trained_at)
       VALUES (10, 1, 1, 'A', '2026-01-15 12:00:00'),
              (11, 1, 2, 'B', '2026-07-20 12:00:00')`,
    );
    const map = await fetchHeatmapData(db, '2026-06-01');
    expect(map.size).toBe(1);
    expect([...map.values()][0]).toEqual({count: 1, planId: 1});
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node_modules/.bin/jest __tests__/fetchHeatmapData.test.ts`
Expected: FAIL — the assertions expect `{count, planId}` objects, but the current function returns plain numbers (e.g. `expect(2).toEqual({count: 2, planId: 1})`).

- [ ] **Step 3: Rewrite `fetchHeatmapData`**

In `src/common/databaseService.ts`, replace the whole block currently at lines 788–810 (the doc-comment + function) with:

```ts
export interface HeatmapDatum {
  count: number;
  planId: number;
}

/** Heatmap source: per LOCAL day, the total trained-session count and the
 * dominant plan (the plan with the most sessions that day; ties broken by the
 * lowest plan_id). Rows are grouped by (date, plan_id) in SQL, then folded in
 * JS so each day resolves to one {count, planId}. Uses SQLite's `'localtime'`
 * modifier so the bucket boundary matches the device, not UTC; `today` would
 * otherwise drift by ±1 day for users near midnight. */
export async function fetchHeatmapData(
  db: SQLiteDatabase,
  fromLocalDate: string,
): Promise<Map<string, HeatmapDatum>> {
  const [res] = await db.executeSql(
    `SELECT DATE(s.trained_at, 'localtime') AS date,
            w.plan_id AS plan_id,
            COUNT(*) AS sessions
     FROM sessions s
     JOIN weeks w ON s.week_id = w.id
     WHERE s.trained_at IS NOT NULL
       AND DATE(s.trained_at, 'localtime') >= ?
     GROUP BY DATE(s.trained_at, 'localtime'), w.plan_id
     ORDER BY date ASC`,
    [fromLocalDate],
  );
  // Fold (date, plan_id, sessions) rows into one datum per date: total count
  // across plans, plus the dominant plan (max sessions; tie → lowest plan_id).
  const acc = new Map<
    string,
    {count: number; planId: number; bestSessions: number}
  >();
  for (const row of res.rows.raw()) {
    const date = row.date as string;
    const planId = row.plan_id as number;
    const sessions = row.sessions as number;
    const cur = acc.get(date);
    if (!cur) {
      acc.set(date, {count: sessions, planId, bestSessions: sessions});
    } else {
      cur.count += sessions;
      if (
        sessions > cur.bestSessions ||
        (sessions === cur.bestSessions && planId < cur.planId)
      ) {
        cur.planId = planId;
        cur.bestSessions = sessions;
      }
    }
  }
  const map = new Map<string, HeatmapDatum>();
  for (const [date, v] of acc) map.set(date, {count: v.count, planId: v.planId});
  return map;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node_modules/.bin/jest __tests__/fetchHeatmapData.test.ts`
Expected: PASS (5 passing).

- [ ] **Step 5: Lint the modified file**

Run: `node_modules/.bin/eslint src/common/databaseService.ts __tests__/fetchHeatmapData.test.ts`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/common/databaseService.ts __tests__/fetchHeatmapData.test.ts
git commit -m "feat(home): fetchHeatmapData returns dominant plan per day

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Pure helper — `currentWeekCells` + `WEEKDAY_LABELS`

**Files:**
- Modify: `src/components/heatmapMath.ts` (append exports at end of file)
- Test: `__tests__/heatmapMath.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `isoDate`, `startOfWeek` (already in `heatmapMath.ts`).
- Produces:
  - `export const WEEKDAY_LABELS: readonly string[]` = `['MO','TU','WE','TH','FR','SA','SU']` (index 0 = Monday, matching `HeatmapCard`'s grid rows and `startOfWeek`).
  - `export interface WeekDayCell {key: string; label: string; isToday: boolean; isFuture: boolean; trained: boolean; planId: number | null}`
  - `export function currentWeekCells(data: Map<string, {planId: number}>, today: Date): WeekDayCell[]` — 7 cells Mon..Sun of the ISO week containing `today`. The map value is structurally typed (`{planId: number}`) so this stays decoupled from `databaseService`; `HeatmapDatum` satisfies it.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/heatmapMath.test.ts` (add the two new names to the existing import from `../src/components/heatmapMath` — `WEEKDAY_LABELS` and `currentWeekCells`):

```ts
import {WEEKDAY_LABELS, currentWeekCells} from '../src/components/heatmapMath';

describe('currentWeekCells', () => {
  // 2026-07-22 is a Wednesday; its ISO week runs Mon 2026-07-20 .. Sun 2026-07-26.
  const wednesday = new Date(2026, 6, 22);

  it('returns 7 cells labeled MO..SU', () => {
    const cells = currentWeekCells(new Map(), wednesday);
    expect(cells.map(c => c.label)).toEqual([...WEEKDAY_LABELS]);
    expect(cells).toHaveLength(7);
  });

  it('marks today and future days relative to today', () => {
    const cells = currentWeekCells(new Map(), wednesday);
    // MO,TU past; WE today; TH,FR,SA,SU future.
    expect(cells.map(c => c.isToday)).toEqual([
      false, false, true, false, false, false, false,
    ]);
    expect(cells.map(c => c.isFuture)).toEqual([
      false, false, false, true, true, true, true,
    ]);
  });

  it('resolves trained days and their plan from the data map', () => {
    const data = new Map([['2026-07-20', {planId: 3, count: 1}]]);
    const cells = currentWeekCells(data, wednesday);
    expect(cells[0].trained).toBe(true);
    expect(cells[0].planId).toBe(3);
    expect(cells[1].trained).toBe(false);
    expect(cells[1].planId).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node_modules/.bin/jest __tests__/heatmapMath.test.ts`
Expected: FAIL — `currentWeekCells` / `WEEKDAY_LABELS` are not exported (`TypeError: (0 , _heatmapMath.currentWeekCells) is not a function`).

- [ ] **Step 3: Add the helper**

Append to the end of `src/components/heatmapMath.ts`:

```ts
/** Weekday initials, Monday-first — index 0 aligns with `startOfWeek` (Monday)
 * and with `HeatmapCard`'s grid rows. */
export const WEEKDAY_LABELS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export interface WeekDayCell {
  key: string; // isoDate of the day
  label: string; // WEEKDAY_LABELS[i]
  isToday: boolean;
  isFuture: boolean;
  trained: boolean;
  planId: number | null; // dominant plan trained that day, else null
}

/** The seven cells (Mon..Sun) of the ISO week containing `today`, resolved
 * against the heatmap `data` map. Structurally typed on the map value so it
 * stays decoupled from databaseService's HeatmapDatum. */
export function currentWeekCells(
  data: Map<string, {planId: number}>,
  today: Date,
): WeekDayCell[] {
  const monday = startOfWeek(today);
  const todayKey = isoDate(today);
  const cells: WeekDayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = isoDate(d);
    const datum = data.get(key);
    cells.push({
      key,
      label: WEEKDAY_LABELS[i],
      isToday: key === todayKey,
      isFuture: d > today,
      trained: !!datum,
      planId: datum ? datum.planId : null,
    });
  }
  return cells;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node_modules/.bin/jest __tests__/heatmapMath.test.ts`
Expected: PASS (existing tests + 3 new ones).

- [ ] **Step 5: Lint**

Run: `node_modules/.bin/eslint src/components/heatmapMath.ts __tests__/heatmapMath.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/heatmapMath.ts __tests__/heatmapMath.test.ts
git commit -m "feat(home): add currentWeekCells + WEEKDAY_LABELS helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `CurrentWeekStrip` component

**Files:**
- Create: `src/components/CurrentWeekStrip.tsx`

**Interfaces:**
- Consumes: `HeatmapDatum` (Task 1), `currentWeekCells` (Task 2), `planColor`, `colors`, `AppText`.
- Produces: default-exported `CurrentWeekStrip: React.FC<{data: Map<string, HeatmapDatum>; weekProgress: {done: number; total: number} | null}>`.

- [ ] **Step 1: Create the component**

Create `src/components/CurrentWeekStrip.tsx`:

```tsx
// src/components/CurrentWeekStrip.tsx
//
// Home-screen "This Week" strip: the current ISO week (Mon–Sun) as seven large
// boxes, each showing the weekday initial, tinted by the plan trained that day
// (done shows a check, today gets an ink ring). Reads the same map as the
// heatmap below it; it is the heatmap's newest column, rotated and labeled.

import React from 'react';
import {StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {colors} from '../common/theme';
import {planColor} from '../common/planColor';
import {currentWeekCells} from './heatmapMath';
import type {HeatmapDatum} from '../common/databaseService';

interface Props {
  data: Map<string, HeatmapDatum>;
  weekProgress: {done: number; total: number} | null;
}

const CurrentWeekStrip: React.FC<Props> = ({data, weekProgress}) => {
  const today = React.useMemo(() => new Date(), []);
  const cells = React.useMemo(
    () => currentWeekCells(data, today),
    [data, today],
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText bold style={styles.label}>
          THIS WEEK
        </AppText>
        {!!weekProgress && weekProgress.total > 0 && (
          <AppText bold style={styles.counter}>
            {`${weekProgress.done}/${weekProgress.total}`}
          </AppText>
        )}
      </View>

      <View style={styles.row}>
        {cells.map(cell => {
          const c = cell.planId != null ? planColor(cell.planId) : null;
          return (
            <View
              key={cell.key}
              style={[
                styles.cell,
                c
                  ? {backgroundColor: c.bg, borderColor: c.fg}
                  : styles.cellEmpty,
                cell.isToday && styles.cellToday,
              ]}>
              {!!c && <View style={[styles.rail, {backgroundColor: c.fg}]} />}
              <AppText bold style={[styles.dayLabel, {color: c ? c.fg : colors.faint}]}>
                {cell.label}
              </AppText>
              <AppText style={[styles.mark, {color: c ? c.fg : 'transparent'}]}>
                {cell.trained ? '✓' : ' '}
              </AppText>
            </View>
          );
        })}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {fontSize: 11, color: colors.faint, letterSpacing: 1.4},
  counter: {
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  row: {flexDirection: 'row', gap: 4},
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellEmpty: {backgroundColor: colors.paper, borderColor: colors.rule},
  cellToday: {borderWidth: 1.5, borderColor: colors.ink},
  rail: {position: 'absolute', left: 0, top: 0, bottom: 0, width: 3},
  dayLabel: {fontSize: 12, letterSpacing: 1},
  mark: {fontSize: 12, lineHeight: 14, marginTop: 1},
});

export default CurrentWeekStrip;
```

Note: the check mark is written as the escape `'✓'` (✓) to avoid a raw non-ASCII glyph in source. The empty-day mark renders a space with transparent color so every cell reserves the same height.

- [ ] **Step 2: Lint the new file**

Run: `node_modules/.bin/eslint src/components/CurrentWeekStrip.tsx`
Expected: clean. (If Prettier flags line wrapping, apply `node_modules/.bin/eslint --fix src/components/CurrentWeekStrip.tsx` — this file is NOT a seed file, so `--fix` is allowed here.)

- [ ] **Step 3: Type-check — no new errors**

Run: `node_modules/.bin/tsc --noEmit 2>&1 | grep CurrentWeekStrip`
Expected: no output (the new file introduces no type errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/CurrentWeekStrip.tsx
git commit -m "feat(home): add CurrentWeekStrip component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Upgrade `HeatmapCard` — weekday axis, plan colors, legend

**Files:**
- Modify: `src/components/HeatmapCard.tsx`

**Interfaces:**
- Consumes: `HeatmapDatum` (Task 1), `WEEKDAY_LABELS` (Task 2), `planColor`, `Plan` type.
- Produces: `HeatmapCard: React.FC<{data: Map<string, HeatmapDatum>; plans: Plan[]}>` (was `{data: Map<string, number>}`).

- [ ] **Step 1: Update imports and props type**

In `src/components/HeatmapCard.tsx`:

Add to the imports (after the existing `import {colors} ...`):

```tsx
import {planColor} from '../common/planColor';
import type {HeatmapDatum} from '../common/databaseService';
import type {Plan} from '../common/types';
```

Add `WEEKDAY_LABELS` to the existing `./heatmapMath` import so it reads:

```tsx
import {
  currentWeekStreak,
  daysInLast,
  isoDate,
  startOfWeek,
  WEEKDAY_LABELS,
} from './heatmapMath';
```

Replace the `Props` interface:

```tsx
interface Props {
  /** Map of YYYY-MM-DD (local date) → {count, dominant planId}, covering at
   * least the last 16 weeks. Days not in the map render as empty cells. */
  data: Map<string, HeatmapDatum>;
  /** All plans, used to name the color legend. */
  plans: Plan[];
}
```

- [ ] **Step 2: Replace the fill constants + helper**

Replace the current constants block:

```tsx
const CELL_EMPTY = '#EDEAE4';
const CELL_LIGHT = '#FFB870'; // primary at ~70%
const CELL_FULL = colors.primary;

function fillFor(count: number | undefined): string {
  if (!count) return CELL_EMPTY;
  if (count === 1) return CELL_LIGHT;
  return CELL_FULL;
}
```

with:

```tsx
const CELL_EMPTY = '#EDEAE4';
const AXIS_WIDTH = 20;

// A trained cell is tinted by its dominant plan: the pastel `bg` for a single
// session, the saturated `fg` for two or more.
function fillFor(datum: HeatmapDatum | undefined): string {
  if (!datum) return CELL_EMPTY;
  const c = planColor(datum.planId);
  return datum.count >= 2 ? c.fg : c.bg;
}
```

Also update the `HORIZONTAL_CHROME`-based `cellSize` calc to reserve the axis column. Replace:

```tsx
  const cellSize = Math.max(
    8,
    Math.floor(
      (width - HORIZONTAL_CHROME - GAP * (WEEKS_SHOWN - 1)) / WEEKS_SHOWN,
    ),
  );
```

with:

```tsx
  const cellSize = Math.max(
    8,
    Math.floor(
      (width - HORIZONTAL_CHROME - AXIS_WIDTH - GAP * (WEEKS_SHOWN - 1)) /
        WEEKS_SHOWN,
    ),
  );
```

- [ ] **Step 3: Add the legend memo + destructure `plans`**

Change the component signature from `({data})` to `({data, plans})`. Then, right after the `const trainedSet = React.useMemo(...)` line, add:

```tsx
  const legendPlans = React.useMemo(() => {
    const ids = new Set<number>();
    for (const v of data.values()) ids.add(v.planId);
    return plans.filter(p => ids.has(p.id));
  }, [data, plans]);
```

- [ ] **Step 4: Render the axis + plan-colored cells + legend**

Replace the current grid block:

```tsx
      <View style={styles.grid}>
        {grid.map((row, rowIdx) => (
          <View key={rowIdx} style={[styles.row, {gap: GAP}]}>
            {row.map((date, weekIdx) => {
              const key = isoDate(date);
              const count = data.get(key);
              const isToday = key === todayKey;
              const isFuture = date > today;
              const delay = weekIdx * 25 + rowIdx * 3;
              return (
                <Reanimated.View
                  key={key}
                  entering={FadeIn.delay(delay).duration(280)}
                  style={[
                    {
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: isFuture
                        ? 'transparent'
                        : fillFor(count),
                    },
                    isToday && styles.todayCell,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
```

with:

```tsx
      <View style={styles.gridWrap}>
        <View style={[styles.axis, {gap: GAP}]}>
          {WEEKDAY_LABELS.map(lbl => (
            <View key={lbl} style={{height: cellSize, justifyContent: 'center'}}>
              <AppText style={styles.axisLabel}>{lbl}</AppText>
            </View>
          ))}
        </View>
        <View style={styles.grid}>
          {grid.map((row, rowIdx) => (
            <View key={rowIdx} style={[styles.row, {gap: GAP}]}>
              {row.map((date, weekIdx) => {
                const key = isoDate(date);
                const datum = data.get(key);
                const isToday = key === todayKey;
                const isFuture = date > today;
                const delay = weekIdx * 25 + rowIdx * 3;
                return (
                  <Reanimated.View
                    key={key}
                    entering={FadeIn.delay(delay).duration(280)}
                    style={[
                      {
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: isFuture
                          ? 'transparent'
                          : fillFor(datum),
                      },
                      isToday && styles.todayCell,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {legendPlans.length > 0 && (
        <View style={styles.legend}>
          {legendPlans.map(p => (
            <View key={p.id} style={styles.legendItem}>
              <View
                style={[
                  styles.legendSwatch,
                  {backgroundColor: planColor(p.id).fg},
                ]}
              />
              <AppText style={styles.legendText}>{p.name.toUpperCase()}</AppText>
            </View>
          ))}
        </View>
      )}
```

- [ ] **Step 5: Add the new styles**

In the `StyleSheet.create({...})`, add these entries (keep the existing ones):

```tsx
  gridWrap: {flexDirection: 'row', gap: 6},
  axis: {width: AXIS_WIDTH},
  axisLabel: {
    fontSize: 8,
    color: colors.faint,
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  legend: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4},
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  legendSwatch: {width: 12, height: 12},
  legendText: {fontSize: 10, color: colors.muted, letterSpacing: 1},
```

- [ ] **Step 6: Lint**

Run: `node_modules/.bin/eslint src/components/HeatmapCard.tsx`
Expected: clean (use `--fix` if only Prettier-wrapping is flagged; this is not a seed file).

- [ ] **Step 7: Type-check — no new errors**

Run: `node_modules/.bin/tsc --noEmit 2>&1 | grep HeatmapCard`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/components/HeatmapCard.tsx
git commit -m "feat(home): recolor heatmap by plan, add weekday axis + legend

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Wire both into Home

**Files:**
- Modify: `src/screens/Home.tsx`

**Interfaces:**
- Consumes: `HeatmapDatum` (Task 1), `CurrentWeekStrip` (Task 3), upgraded `HeatmapCard` (Task 4).

- [ ] **Step 1: Update imports**

In `src/screens/Home.tsx`, add the strip import next to the other component imports (e.g. after the `import HeatmapCard` line):

```tsx
import CurrentWeekStrip from '../components/CurrentWeekStrip';
```

Change the type-only import line that currently reads:

```tsx
import type {HomeSummary as HomeSummaryShape} from '../common/databaseService';
```

to:

```tsx
import type {
  HomeSummary as HomeSummaryShape,
  HeatmapDatum,
} from '../common/databaseService';
```

- [ ] **Step 2: Update the heatmap state type**

Change:

```tsx
  const [heatmap, setHeatmap] = React.useState<Map<string, number>>(new Map());
```

to:

```tsx
  const [heatmap, setHeatmap] = React.useState<Map<string, HeatmapDatum>>(
    new Map(),
  );
```

- [ ] **Step 3: Mount the strip above the heatmap and pass `plans`**

Replace the current render fragment:

```tsx
            {summary.currentWeek && (
              <ProgressCard
                week={summary.currentWeek}
                onPress={() => navigation.navigate('Weeks')}
              />
            )}

            <HeatmapCard data={heatmap} />
```

with:

```tsx
            {summary.currentWeek && (
              <ProgressCard
                week={summary.currentWeek}
                onPress={() => navigation.navigate('Weeks')}
              />
            )}

            <CurrentWeekStrip
              data={heatmap}
              weekProgress={
                summary.currentWeek
                  ? {
                      done: summary.currentWeek.sessions.filter(s => s.finished)
                        .length,
                      total: summary.currentWeek.sessions.length,
                    }
                  : null
              }
            />

            <HeatmapCard data={heatmap} plans={plans} />
```

- [ ] **Step 4: Lint**

Run: `node_modules/.bin/eslint src/screens/Home.tsx`
Expected: clean.

- [ ] **Step 5: Type-check — no new errors**

Run: `node_modules/.bin/tsc --noEmit 2>&1 | grep Home.tsx`
Expected: no output. (Home.tsx is not on the known-noise list, so it must be error-free.)

- [ ] **Step 6: Commit**

```bash
git add src/screens/Home.tsx
git commit -m "feat(home): mount CurrentWeekStrip and pass plans to heatmap

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Integration verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `node_modules/.bin/jest`
Expected: all suites pass (the two touched test files plus the untouched rest).

- [ ] **Step 2: Lint all touched source**

Run: `node_modules/.bin/eslint src/common/databaseService.ts src/components/heatmapMath.ts src/components/CurrentWeekStrip.tsx src/components/HeatmapCard.tsx src/screens/Home.tsx`
Expected: clean.

- [ ] **Step 3: Type-check for new errors**

Run: `node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'databaseService|heatmapMath|CurrentWeekStrip|HeatmapCard|Home\.tsx'`
Expected: no output. Any line here is a NEW error you introduced — fix before finishing.

- [ ] **Step 4: (Optional, requires a device) Visual smoke test**

Only if a device/emulator is attached and the user wants to see it. Per project memory, bump the version first, then build+install:

```bash
npm version patch --no-git-tag-version && node update-android-version.js
npm run build-prod:android
adb -s 34061FDH2005AW install -r android/app/build/outputs/apk/release/app-release.apk
adb -s 34061FDH2005AW shell dumpsys package com.workoutwarden | grep -E "versionName|lastUpdateTime"
```

Confirm on the Home screen: the "THIS WEEK" strip shows MO–SU with today ringed, trained days tinted by plan and checkmarked; the heatmap below has the weekday axis, plan colors, and a legend. This step has no commit.

---

## Notes on decomposition & risks

- **Data before views:** Task 1 defines `HeatmapDatum`, which Tasks 3–5 import. Task 2's helper is independent (structurally typed) and could run in parallel, but the linear order keeps reviews simple.
- **No render tests** for `CurrentWeekStrip`/`HeatmapCard` — matches the repo (no component-render harness exists; all tests are pure-logic/DB). Their correctness rests on the unit-tested helpers plus `tsc`/`eslint` and the optional device smoke test.
- **`trainedSet` in HeatmapCard** is still `new Set(data.keys())` — keys remain date strings, so `currentWeekStreak`/`daysInLast` are unaffected by the value-type change. No edit needed there.
- **Timezone determinism** in Task 1's test uses noon timestamps, safe for every real UTC offset (< 12h) including the user's UTC+1/+2.
