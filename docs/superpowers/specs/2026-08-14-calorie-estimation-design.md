# Calorie Estimation — Design

Date: 2026-08-14
Status: approved (design review in chat)

## Goal

Show an approximate calorie burn for logged activities (Surfing, Altinha) and
finished plan workouts. Surfaces: Home (today's burn), Activities (per entry +
per week), Statistics (all-time totals). The number is an explicit
approximation — every rendered value carries a `~` prefix.

## Decisions (made in design review)

1. **Profile**: weight + height + birth year + sex → BMR-corrected MET
   calculation (revised Harris-Benedict).
2. **Plan workout duration**: a flat per-session estimate, user-editable in the
   profile (`profile_session_minutes`, default 60). No per-session time
   tracking.
3. **Storage**: kcal is a **snapshot per row** (`kcal INTEGER` column on
   `activity_sessions` and `sessions`), computed at write time.
4. **Backfill**: saving the profile fills **gaps only** (`kcal IS NULL`);
   existing snapshots are never overwritten. Profile changes do not propagate
   to rows that already have a value.

## Data model

### Profile — `settings` key/value rows

No new table. Keys, all TEXT-encoded like `active_plan_id`:

| key | value | notes |
|---|---|---|
| `profile_weight_kg` | number as string | required for BMR |
| `profile_height_cm` | number as string | required for BMR |
| `profile_birth_year` | 4-digit year | stored instead of age so it never goes stale; age = current year − birth year |
| `profile_sex` | `male` \| `female` | Harris-Benedict defines only these two coefficient sets |
| `profile_session_minutes` | number as string | flat duration for plan workouts, default `60` |

A profile is **complete** when the four BMR fields are set; `fetchProfile`
returns `null` otherwise. `profile_session_minutes` falls back to 60.

New generic helpers `getSetting(db, key)` / `setSetting(db, key, value)` in
`databaseService.ts`; `fetchActivePlanId` / `setActivePlanId` are refactored
onto them (no behavior change).

### kcal snapshot columns

- `activity_sessions.kcal INTEGER` (nullable)
- `sessions.kcal INTEGER` (nullable)

Added in three places, per repo convention:

1. `CREATE TABLE` DDL in `databaseService.ts:SCHEMA` (fresh installs),
2. idempotent `try { ALTER TABLE … ADD COLUMN kcal INTEGER } catch {}` at the
   top of `seedDB` (upgrades),
3. `scripts/schema-v2.sql` (DB tests + legacy import target schema).

No `SEED_REVISION` bump — no plan content changes.

## Calculation — `src/common/calories.ts` (pure module, no RN imports)

```
bmrKcalPerDay({weightKg, heightCm, birthYear, sex}, currentYear)
  male:   88.362 + 13.397·kg + 4.799·cm − 5.677·age
  female: 447.593 + 9.247·kg + 3.098·cm − 4.330·age   (revised Harris-Benedict)

estimateKcal(met, minutes, profile)  →  round(met × (BMR / 24) × minutes / 60)
```

Returns `null` when profile or minutes is missing. This is the standard
BMR-corrected MET formula (1 h at MET 1 ≈ one hour of resting metabolism).

**MET values live as TS constants in the same module** — deliberately not a
seed/DB field, because kcal is computed in JS at write time anyway; a seed
column would be migration machinery with no consumer:

```ts
export const ACTIVITY_MET: Record<string, number> = {surf: 4.0, altinha: 5.0};
export const DEFAULT_ACTIVITY_MET = 4.0;   // fallback for future activities
export const STRENGTH_MET = 4.0;           // resistance training incl. rests
```

A unit test asserts every slug in `src/seeds/activities.ts` has an
`ACTIVITY_MET` entry, so the map cannot silently drift from the catalogue.

## Write paths (snapshot semantics)

- **`createActivitySession` / `updateActivitySession`**: fetch profile + the
  activity's slug inside the function, compute
  `estimateKcal(ACTIVITY_MET[slug], duration_minutes, profile)` and write it
  with the row. Untimed entries (`duration_minutes IS NULL`) get `kcal NULL` —
  consistent with the honest `timedMinutes` semantics; the 15-minute display
  plinth is never used for calories. Every save recomputes, so editing a
  duration refreshes the snapshot with the *current* profile.
- **`finishSession`**: computes
  `estimateKcal(STRENGTH_MET, profile_session_minutes, profile)` and writes it
  in the same UPDATE that sets `finished = 1` / `trained_at`. No profile →
  `NULL`.
- **`saveProfile(db, profile)`**: writes the settings keys, then backfills
  gaps:
  - per activity slug: `UPDATE activity_sessions SET kcal =
    ROUND(duration_minutes * ?) WHERE kcal IS NULL AND duration_minutes IS NOT
    NULL AND activity_id = ?` with the per-minute rate for that slug,
  - `UPDATE sessions SET kcal = ? WHERE kcal IS NULL AND finished = 1` with
    the flat per-session value.

## Profile UI

Bottom-sheet modal cloned from the `ActivitySessionModal` pattern (parent owns
`visible`/`error`, child re-seeds local state on open, errors render *inside*
the Modal subtree). Opened via a new **PROFILE** `TacticalButton` in Home's
DATA MANAGEMENT section.

Fields: weight (kg), height (cm), birth year — numeric `TextInput`s with the
Android fixes (`paddingVertical: 0`, `textAlignVertical: 'center'`,
`includeFontPadding: false`) — sex as a two-chip row, session duration with
chips `[45, 60, 75, 90]` + numeric input. Save requires the four BMR fields;
saving triggers the backfill above.

## Display

All rendered values use a `~` prefix (approximation marker) and the Tactical
Logbook style (ALL-CAPS labels, `colors` tokens, no new hex literals).

- **Home**: slim "TODAY · ~620 KCAL" stat line (own minimal card between
  `ProgressCard` and `CurrentWeekStrip`), visible only when a profile exists
  and today's total > 0. Data: new `fetchTodayKcal(db, todayIsoDate)` — SUM of
  today's `activity_sessions.kcal` (by `performed_at`) + today's finished
  `sessions.kcal` (`DATE(trained_at, 'localtime')`, since `trained_at` is UTC).
  Added to **both** `Promise.all` fan-outs in `Home.tsx:refresh()` (normal +
  self-heal), per the known trap.
- **Activities**: row meta line appends `· ~620 KCAL` when `kcal` is non-null;
  `ActivityTotals` gains a `kcal` sum, `groupByIsoWeek` accumulates it, and
  `formatTotals` appends `· ~1240 KCAL` to the week header when > 0.
- **Statistics**: totals block above the exercise chart: `TOTAL ~123.4K KCAL`
  with a training vs. activities breakdown. Data: new `fetchKcalTotals(db)` —
  two SUMs.

## Edge cases

- No profile yet → all writes produce `kcal NULL`, all displays hidden. No
  zeros shown anywhere.
- Untimed activity → `kcal NULL`, no kcal fragment in the row meta.
- kcal is always a rounded integer.
- Sex is limited to male/female because the formula has no other coefficient
  sets; this is a formula constraint, not a product statement.
- `finishSession` is one-way in the current app; re-finish recompute is out of
  scope.

## Testing

- `__tests__/calories.test.ts` — pure math (BMR both sexes, estimateKcal
  rounding/null paths) + MET-map ↔ `ACTIVITIES` seed sync. Pure-logic style,
  no mocks.
- `__tests__/activityService.test.ts` extension — kcal snapshot round-trip on
  create/update, backfill fills only `NULL` rows, untimed rows stay `NULL`.
  Runs against real SQLite via `scripts/schema-v2.sql`.
- `fetchTodayKcal` / `fetchKcalTotals` / `getSetting`/`setSetting` tests in the
  `fetchHomeSummary.test.ts` harness style.
- `__tests__/activityStats.test.ts` extension — week totals include kcal.

## Documentation

Update the project `CLAUDE.md` (data model: kcal columns + profile settings
keys; UI conventions: `~` prefix rule, calories module) as part of
implementation.

## Out of scope (YAGNI)

- Weight history / retroactive recalculation.
- Per-session real duration tracking.
- MET editing UI — values are code constants.
- Any calorie *goal* / budget features.
