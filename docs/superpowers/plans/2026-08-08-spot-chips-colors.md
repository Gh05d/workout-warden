# Spot Quick-Select + Color Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recently used spots become one-tap chips in the activity modal, and both color palettes are replaced (warm gym tones for plans, cool water/nature tones for activities — no more near-black fgs).

**Architecture:** One new read (`fetchRecentSpots`) in databaseService feeding a prop through the Activities screen into the modal (modal stays DB-free); the palette change is a pure data swap in `planColor.ts` that every consumer (pills, rails, bars, heatmap blends) picks up automatically.

**Tech Stack:** React Native 0.85 (TS), react-native-sqlite-storage, better-sqlite3 (tests). **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-08-spot-chips-colors-design.md`

## Global Constraints

- `yarn <cmd>` is broken. Use `npm run <script>` or `node_modules/.bin/<tool>` directly.
- Jest single file: `node_modules/.bin/jest __tests__/<file>.test.ts`. Full suite: `npm run test`.
- Prettier: singleQuote, bracketSpacing false, arrowParens avoid, trailingComma all; `prettier/prettier` is an eslint **error**, including in test files — run `node_modules/.bin/eslint` on every changed file before committing.
- TS check per file: `node_modules/.bin/tsc --noEmit 2>&1 | grep '<path>'` must print nothing for touched files (global tsc has documented pre-existing noise).
- No new hex literals in components — components consume `planColor`/`activityColor`/theme tokens; `src/common/planColor.ts` itself is the palette file and defines hex.
- Cap: **8 spots per activity**, most recent first. Spots matched as stored (already trimmed at save).
- UI copy English, ALL-CAPS labels with letterSpacing.
- No schema change, no `SEED_REVISION` bump.

---

### Task 1: fetchRecentSpots

**Files:**
- Modify: `src/common/databaseService.ts` (append to the `// ---------- Activities ----------` section)
- Test: `__tests__/activityService.test.ts` (append a describe block)

**Interfaces:**
- Consumes: existing harness (`makeDb`) and `createActivitySession` in the test file.
- Produces: `fetchRecentSpots(db: SQLiteDatabase): Promise<Map<number, string[]>>` — key = `activity_id`, value = up to 8 spot strings, most recently used first. Task 3 imports it from `../common/databaseService`.

- [ ] **Step 1: Write the failing test** — append to `__tests__/activityService.test.ts` (extend the databaseService import with `fetchRecentSpots`):

```ts
describe('fetchRecentSpots', () => {
  it('groups per activity, most recent first, excluding null spots', async () => {
    const db = makeDb();
    for (const [act, day, spot] of [
      [1, '2026-08-01', 'Uluwatu'],
      [1, '2026-08-03', 'Padang Padang'],
      [1, '2026-08-05', 'Uluwatu'],
      [2, '2026-08-04', 'Praia do Forte'],
      [1, '2026-08-02', null],
    ] as const) {
      await createActivitySession(db, {
        activityId: act,
        performedAt: day,
        durationMinutes: null,
        spot,
        note: null,
      });
    }
    const map = await fetchRecentSpots(db);
    expect(map.get(1)).toEqual(['Uluwatu', 'Padang Padang']);
    expect(map.get(2)).toEqual(['Praia do Forte']);
  });

  it('caps at 8 spots per activity', async () => {
    const db = makeDb();
    for (let i = 1; i <= 10; i++) {
      await createActivitySession(db, {
        activityId: 1,
        performedAt: `2026-07-${String(i).padStart(2, '0')}`,
        durationMinutes: null,
        spot: `Spot ${i}`,
        note: null,
      });
    }
    const map = await fetchRecentSpots(db);
    expect(map.get(1)).toHaveLength(8);
    expect(map.get(1)?.[0]).toBe('Spot 10');
    expect(map.get(1)).not.toContain('Spot 1');
  });

  it('returns an empty map when nothing has a spot', async () => {
    const db = makeDb();
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 60,
      spot: null,
      note: null,
    });
    expect((await fetchRecentSpots(db)).size).toBe(0);
  });
});
```

Note the first test: 'Uluwatu' was used on 08-01 AND 08-05 — it must appear once, ranked by its most recent use (first), proving the `GROUP BY` + `MAX` ranking.

- [ ] **Step 2: Run to verify failure**

Run: `node_modules/.bin/jest __tests__/activityService.test.ts`
Expected: new describe FAILS (`fetchRecentSpots` not exported); all pre-existing cases still pass.

- [ ] **Step 3: Implement** — append to the Activities section of `src/common/databaseService.ts`:

```ts
const RECENT_SPOTS_LIMIT = 8;

/** Recently used spots per activity, most recent first, capped at
 * RECENT_SPOTS_LIMIT per activity. Derived from history — there is no spots
 * table; the modal offers these as one-tap chips. */
export async function fetchRecentSpots(
  db: SQLiteDatabase,
): Promise<Map<number, string[]>> {
  const [res] = await db.executeSql(
    `SELECT activity_id, spot, MAX(performed_at) AS last_day, MAX(id) AS last_id
     FROM activity_sessions
     WHERE spot IS NOT NULL
     GROUP BY activity_id, spot
     ORDER BY last_day DESC, last_id DESC`,
  );
  const map = new Map<number, string[]>();
  for (const row of res.rows.raw()) {
    const list = map.get(row.activity_id) ?? [];
    if (list.length < RECENT_SPOTS_LIMIT) list.push(row.spot);
    map.set(row.activity_id, list);
  }
  return map;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node_modules/.bin/jest __tests__/activityService.test.ts` → PASS.

- [ ] **Step 5: Verify + commit**

`node_modules/.bin/tsc --noEmit 2>&1 | grep 'src/common/databaseService.ts'` → empty.
`node_modules/.bin/eslint src/common/databaseService.ts __tests__/activityService.test.ts` → no errors.

```bash
git add src/common/databaseService.ts __tests__/activityService.test.ts
git commit -m "feat(db): recent spots per activity"
```

---

### Task 2: Palette swap

**Files:**
- Modify: `src/common/planColor.ts:1-31` (both palette arrays + their comments; `planColor`/`activityColor` function bodies and `mixHexColors` untouched)

**Interfaces:**
- Consumes/Produces: function signatures unchanged — only the constant values move. No other task depends on specific hex values.

- [ ] **Step 1: Replace the two palette blocks**

Replace lines 1–31 of `src/common/planColor.ts` (everything above `mixHexColors`) with:

```ts
// Per-plan and per-activity colour palettes. Concept: warm tones for plans
// (gym — the app's orange accent family), cool water/nature tones for
// activities, so the two never look alike in the heatmap or legends. fg stays
// in the vivid 600–800 range: Material-900 fgs shipped once and read as
// near-black at small sizes (rails, bars, pills).

const PALETTE: ReadonlyArray<{bg: string; fg: string}> = [
  {bg: '#FFE0B2', fg: '#EF6C00'}, // orange — matches the app accent
  {bg: '#FFCDD2', fg: '#D32F2F'}, // red
  {bg: '#E1BEE7', fg: '#8E24AA'}, // violet
  {bg: '#F8BBD0', fg: '#C2185B'}, // magenta
  {bg: '#D7CCC8', fg: '#6D4C41'}, // bronze
  {bg: '#CFD8DC', fg: '#546E7A'}, // slate
];

export function planColor(planId: number): {bg: string; fg: string} {
  const idx = Math.abs(planId - 1) % PALETTE.length;
  return PALETTE[idx];
}

// Slot pairs are identity: surf is ocean blue, altinha is the Brazilian
// yellow-bg/green-fg pair (the combination reads as the flag).
const ACTIVITY_PALETTE: ReadonlyArray<{bg: string; fg: string}> = [
  {bg: '#B3E5FC', fg: '#0277BD'}, // ocean blue — surf
  {bg: '#FFF59D', fg: '#388E3C'}, // Brazil yellow/green — altinha
  {bg: '#B2DFDB', fg: '#00897B'}, // teal
  {bg: '#B2EBF2', fg: '#0097A7'}, // cyan
];

export function activityColor(activityId: number): {bg: string; fg: string} {
  const idx = Math.abs(activityId - 1) % ACTIVITY_PALETTE.length;
  return ACTIVITY_PALETTE[idx];
}
```

- [ ] **Step 2: Run the value-agnostic suites**

Run: `node_modules/.bin/jest __tests__/planColor.test.ts __tests__/heatmapMath.test.ts`
Expected: PASS unchanged — these assert distinctness, disjointness from the plan palette, wrap behavior, and blend arithmetic via the functions, not concrete hex values. If anything fails, the palette violates a stated invariant — fix the palette, not the test.

- [ ] **Step 3: Full suite + verify + commit**

`npm run test` → all green. `node_modules/.bin/tsc --noEmit 2>&1 | grep 'src/common/planColor.ts'` → empty. `node_modules/.bin/eslint src/common/planColor.ts` → clean.

```bash
git add src/common/planColor.ts
git commit -m "feat(colors): warm plan palette, ocean/brazil activity palette"
```

---

### Task 3: Spot chips in the modal

**Files:**
- Modify: `src/components/ActivitySessionModal.tsx`
- Modify: `src/screens/Activities.tsx`

**Interfaces:**
- Consumes: `fetchRecentSpots` (Task 1).
- Produces: `ActivitySessionModal` gains required prop `recentSpotsByActivity: Map<number, string[]>`.

- [ ] **Step 1: Modal — prop + chip row**

In `src/components/ActivitySessionModal.tsx`:

1. Add to `Props` (after `error`):

```ts
  /** Recently used spots per activity (fetchRecentSpots) — one-tap chips. */
  recentSpotsByActivity: Map<number, string[]>;
```

2. Destructure `recentSpotsByActivity` in the component parameters.

3. Below the `durationMinutes` derivation, add:

```ts
  const spotChips = recentSpotsByActivity.get(activityId) ?? [];
```

4. Directly after the SPOT `<TextInput …style={styles.textField} />` (before the NOTE label), insert:

```tsx
            {spotChips.length > 0 && (
              <View style={styles.pillRow}>
                {spotChips.map(s => {
                  const selected = spot.trim() === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setSpot(selected ? '' : s)}
                      accessibilityRole="button"
                      accessibilityState={{selected}}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <AppText
                        bold
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}>
                        {s.toUpperCase()}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            )}
```

No new styles — reuses `pillRow`/`chip`/`chipSelected`/`chipText`/`chipTextSelected` from the duration chips. Chips display uppercase (list-row convention); the value written into the field keeps its stored casing. Switching the activity pill switches `spotChips` automatically via `activityId`.

- [ ] **Step 2: Screen — fetch + prop**

In `src/screens/Activities.tsx`:

1. Extend the databaseService import with `fetchRecentSpots`.
2. Add state after `activities`:

```ts
  const [recentSpots, setRecentSpots] = React.useState<Map<number, string[]>>(
    new Map(),
  );
```

3. In `refresh`, after `setActivities(...)`:

```ts
    setRecentSpots(await fetchRecentSpots(db));
```

4. Pass to the modal: `recentSpotsByActivity={recentSpots}` (next to `initial={editing}`).

- [ ] **Step 3: Verify + commit**

`npm run test` → all green (no dedicated component test — repo convention; the toggle logic mirrors the shipped duration chips).
`node_modules/.bin/tsc --noEmit 2>&1 | grep -E 'src/(components/ActivitySessionModal|screens/Activities)'` → empty.
`node_modules/.bin/eslint src/components/ActivitySessionModal.tsx src/screens/Activities.tsx` → clean.

```bash
git add src/components/ActivitySessionModal.tsx src/screens/Activities.tsx
git commit -m "feat(activities): recent-spot quick-select chips in modal"
```

---

## Self-Review (done at plan time)

- **Spec coverage:** fetchRecentSpots incl. cap/ordering/NULL handling (T1), both palettes verbatim from spec tables (T2), chip UI incl. toggle + per-activity filter + hidden-when-empty (T3). Rollout needs no task (no schema/seed change).
- **Type consistency:** `Map<number, string[]>` end-to-end; prop name `recentSpotsByActivity` in modal, state `recentSpots` in screen — wired in T3 step 2.4.
- **No CLAUDE.md task:** the palette values aren't documented anywhere (CLAUDE.md documents the hue-distance convention, which still holds); no doc change needed.
