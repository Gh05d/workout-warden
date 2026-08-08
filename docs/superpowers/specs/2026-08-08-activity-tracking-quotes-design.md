# Activity Tracking (Surf / Altinha) + Quotes Curation — Design

**Date:** 2026-08-08
**Status:** Approved in brainstorming session, pending spec review

## Goals

1. Track free-form activities (surfing, altinha) alongside plan-driven strength training:
   - visibility on the Home calendar surfaces (heatmap, week strip),
   - volume & trends per ISO week (frequency, hours),
   - lightweight per-session details (spot + free-text note).
2. Curate the demotivational quotes list: remove duplicates and weak entries, add new ones of equal tone; list stays ~70 entries.

## Non-goals

- Training-load balancing / recovery logic (explicitly deselected).
- In-app management (create/edit) of activity types — the catalogue is seed-only.
- victory-native charts for activities — weekly bars are plain Views.
- Any change to plan/week/session semantics, the week-strip checklist rules, or the progress bar.
- iOS.

## Data model

New tables, appended to `SCHEMA` in `src/common/databaseService.ts` as `CREATE TABLE IF NOT EXISTS` (no migration framework needed — new tables materialize on next start):

```sql
CREATE TABLE IF NOT EXISTS activities (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_sessions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id      INTEGER NOT NULL REFERENCES activities(id),
  performed_at     TEXT NOT NULL,      -- ISO date YYYY-MM-DD (no time component)
  duration_minutes INTEGER,            -- NULL = not recorded
  spot             TEXT,               -- optional location, shared meaning for surf & altinha
  note             TEXT,               -- optional free text
  created_at       TEXT NOT NULL   -- set by createActivitySession at insert time
);

CREATE INDEX IF NOT EXISTS idx_activity_sessions_date
  ON activity_sessions(performed_at);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_activity
  ON activity_sessions(activity_id, performed_at);
```

Design points:

- **Fully parallel to the plan apparatus.** No FK into `plans`/`weeks`/`sessions`. Surfing has no sets, no prescription, no week membership. (The "pseudo-plan" alternative was rejected: it would bend every semantic — auto-created weeks, empty `session_exercises`, meaningless `finished` flags.)
- Multiple sessions per day are allowed (two surfs = two rows). No uniqueness on `(activity_id, performed_at)`.
- `duration_minutes` is optional; trends always count sessions, hours only where recorded.
- Backup/restore needs no work: `exportDatabase`/`importDatabase` copy the whole `warden.db`.
- Activities are never deleted (seed catalogue), so the default FK restriction is fine; no cascades.

### databaseService additions

Same conventions as existing CRUD (every function takes `SQLiteDatabase` first):

- `fetchActivities(db)` → `Activity[]`
- `fetchActivitySessions(db, {fromDate?})` → `ActivitySession[]` (list, heatmap 16-week window, week strip)
- `createActivitySession(db, {activityId, performedAt, durationMinutes?, spot?, note?})`
- `updateActivitySession(db, id, partial)` — partial update, `updateSet` pattern
- `deleteActivitySession(db, id)`

ISO-week grouping/aggregation happens in JS (fold pattern like `fetchWeeksByPlan`), not in SQL — SQLite's `%W` is not ISO and `heatmapMath` already owns ISO-week logic.

### Types

`src/common/types.ts` gains seed-side `ActivitySeed` and DB-side `Activity`, `ActivitySession` row shapes.

## Seeds

- `src/seeds/activities.ts`: `ACTIVITIES: ActivitySeed[]` = `[{slug: 'surf', name: 'Surf'}, {slug: 'altinha', name: 'Altinha'}]`, exported through the `src/seeds/index.ts` barrel.
- `seedDB` upserts activities by `slug` on every start — the exercise-catalogue pattern. Catalogue grows, never shrinks, **no `SEED_REVISION` interplay**. Adding an activity later = one seed row + release.
- `validateSeed` gains a duplicate-slug check for activities (fail fast at startup, before writes).

## Colors

`activityColor(activityId)` analogous to `planColor(planId)` — `{bg, fg}` pairs from a palette that is hue-distant both from the plan palette and internally (cyan/teal/magenta family), so activities are not confusable with plans and pairwise blends stay distinguishable. Lives in `src/common/planColor.ts` alongside `planColor`. No new hex literals in components.

## Activities tab (fifth bottom tab)

New bottom tab **Activities** in `src/Routes.tsx`, Tactical-Logbook styling throughout (`TacticalButton`, `theme.ts` tokens).

- **Add flow** (modal, like Weeks' session-detail modal): activity pill (Surf/Altinha) → date, default today, backdatable → duration quick-chips 30/60/90/120 min + free numeric input, skippable → optional spot + note → save. Target: 3 taps for the common case.
- **Weekly bars header**: last ~8 ISO weeks, one bar per week, stacked segments per activity color, height = hours; sessions without duration contribute a small fixed plinth so they stay visible. Built from plain Views (progress-bar idiom), **not** victory-native.
- **List**: grouped by ISO week, header with sums ("KW 32 — Surf 3× / 5h · Altinha 1× / 2h"), entries below with date/duration/spot/note. Tap row → edit/delete modal.

## Home integration

### Heatmap (`HeatmapCard.tsx`)

Cell color comes from one pure helper (in `heatmapMath`), fed by the day's distinct sources (plan colors from sessions + activity colors from activity_sessions):

- 0 sources → empty cell (unchanged).
- 1 distinct source: 1 entry → `.bg`, 2+ entries → `.fg` (unchanged rule, now covering activities too).
- 2+ distinct sources → **blend**: `mixHexColors([...])`, per-channel sRGB mean of each source's `.fg` variant (a mixed day has ≥2 entries by definition, consistent with the existing 2+ → `.fg` rule).

`mixHexColors(hexes: string[]): string` is a pure utility with unit tests. **Known risk, accepted by user:** 3-source blends converge toward gray-brown; mitigated by the hue-distant palette, and the single-helper design makes a later switch to split cells (hard-stop two-color) a one-function change plus tests. Legend gains the activities present in the 16-week window. Grid geometry (`HORIZONTAL_CHROME`, `AXIS_WIDTH`, …) is untouched.

### Week strip (`CurrentWeekStrip.tsx`)

- **Unscheduled** days: activity on that day → ✓ tinted by activity color (plan training already tints the ✓ on unscheduled days — existing behavior); multiple sources on one day → same `mixHexColors` blend. Restricted to the current ISO week by `performed_at` (activities are calendar-anchored, so no week-row anchoring caveat applies).
- **Scheduled** days: **untouched.** An activity never checks off a gym session; checklist semantics and the trainings-days-only progress bar stay exactly as documented in CLAUDE.md.

## Quotes curation

`src/common/quotes.ts`:

- Remove (~14): confirmed — near-duplicate mosquito quotes (keep one of lines 19/39), duplicate grass-is-greener (keep one of 12/53), the office quote (43, out of place in a workout app), "unplug your life support" (6, mean rather than dry), the tax quote (15, dated/US-specific); plus ~8 weakest by criteria: mean-spirited rather than self-deprecating, requires external context, or is a platitude without a twist. Final list shown in the implementation diff.
- Add ~15 new **generic** demotivational quotes (no forced surf/gym theming), same tone: dry, self-ironic, not cruel. Target total stays ~70.

## Testing

- `__tests__/seeds.test.ts` pattern: activities validator (duplicate slugs throw).
- CRUD + weekly aggregation against real SQLite via `better-sqlite3` (the `seedMigration.test.ts` harness): create/edit/delete sessions, ISO-week fold sums, null-duration handling.
- `heatmapMath` units: day-source collection, cell-color rule (0/1/2+ sources, bg/fg selection), week-strip unscheduled tinting.
- `mixHexColors` units (identity, pair, triple).
- Seed migration test suite must stay green (activities seeding is revision-independent; assert idempotence).

## Rollout

Standard release flow (`version-update.sh`), version bump before sideload. No data migration, no `SEED_REVISION` bump (no shipped plan content changes).
