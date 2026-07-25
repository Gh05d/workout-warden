# Home Screen: "This Week" day-strip + plan-colored heatmap

**Date:** 2026-07-25
**Status:** Design approved, pending spec review

## Problem

The Home screen's ACTIVITY heatmap (`HeatmapCard.tsx`) is a 16-week × 7-day
GitHub-style grid of featureless ~15px boxes, colored only by session count
(empty / light-orange / full-orange) and completely plan-agnostic. Two gaps:

1. The boxes carry no day identity — a wall of anonymous squares.
2. Every plan's sessions feed the same orange grid, so you can't see *which*
   plan you trained on a given day.

## Goal

- Give the day boxes a letter that identifies the weekday.
- Color trained days by the plan they belong to.
- Add supporting UI that makes the Home screen read at a glance.

## Approach

Add a compact **"This Week" day-strip** above the heatmap and **upgrade the
heatmap** to plan colors, a weekday axis, and a legend. The strip is the
current ISO week (Mon–Sun) rendered as seven large, labeled boxes — which is
literally the heatmap's rightmost column rotated horizontal, so the two views
stay conceptually unified (`startOfWeek` is Monday-based; `isoDate` is local
`YYYY-MM-DD`, matching the SQLite `DATE(..., 'localtime')` bucket).

The letter-in-the-box requirement is satisfied *in the strip* (48px boxes fit
text); in the 15px heatmap cells the weekday letters live on the row axis
instead, because no legible glyph fits a 15px cell.

## Data layer

`fetchHeatmapData(db, fromLocalDate)` today returns `Map<string, number>`
(date → session count), plan-agnostic. Change it to carry the plan:

- **Return type:** `Map<string, HeatmapDatum>` where
  `HeatmapDatum = {count: number; planId: number}`.
- **Query:** join `sessions → weeks`, group by `DATE(..., 'localtime'), plan_id`,
  returning `(date, plan_id, sessions)` rows.
- **Dominant-plan fold (JS):** a day can hold sessions from more than one plan.
  Per date, pick the plan with the most sessions that day; tie → lowest
  `plan_id` (deterministic; multi-plan-same-day is rare, and the active plan
  already dominates the strip via the current week). `count` is the summed
  session count across all plans that day (drives the heatmap intensity). This
  keeps `fetchHeatmapData`'s signature unchanged — no `activePlanId` param.
- **No schema change** — `plan_id` is derivable via the existing FK path
  `sessions.week_id → weeks.plan_id`.

The active plan id is already fetched on Home (`summary.activePlan.id`) and is
passed into the fold for tie-breaking.

## Component: `CurrentWeekStrip` (new)

`src/components/CurrentWeekStrip.tsx`. Placed in `Home.tsx` directly above
`HeatmapCard`.

**Props:**
- `data: Map<string, HeatmapDatum>` — same map the heatmap consumes.
- `weekProgress: {done: number; total: number} | null` — from
  `summary.currentWeek` (trained-session count / planned-session count of the
  active plan's current week). Null when there is no current week.

**Layout:** a header row (`THIS WEEK` left, `{done}/{total}` counter right when
progress is present) over a row of 7 boxes, Mon–Sun, full-width / 7 (~48px).

**Per-day box states:**
- **Trained** (`data.get(dayKey)` present): background `planColor(planId).bg`,
  weekday label + `✓` in `planColor(planId).fg`, 3px left rail in `.fg`.
- **Today** (`isoDate === todayKey`): additionally a 1.5px `colors.ink` ring,
  matching the heatmap's `todayCell`. Combines with the trained styling when
  today was already trained.
- **Rest / empty** (no entry, not today): `colors.paper` background, hairline
  `colors.rule` border, weekday label in `colors.faint`, no check.

**Weekday labels:** English two-letter, ALL-CAPS: `MO TU WE TH FR SA SU`
(matches the app's English tactical labels; single letters collide).

**Not interactive in v1.** The start/continue flow already lives in the
`NextSessionCard` directly above the strip; a second tap path would be
redundant and would open the cross-plan navigation pitfall documented in
CLAUDE.md ("Navigation gotcha"). Tap-to-open a day is a possible later
extension, explicitly out of scope here.

## Component: `HeatmapCard` (upgrade)

`src/components/HeatmapCard.tsx`.

- **Weekday axis:** a narrow left column with `MO TU WE TH FR SA SU` aligned to
  the 7 grid rows. This is the grid's "letter per day" — text inside 15px cells
  is not legible, so it lives on the axis.
- **Plan colors replace orange:** a trained cell uses `planColor(planId).bg`
  when `count === 1` and `planColor(planId).fg` when `count >= 2` (a two-tone
  intensity per plan). Empty and future cells stay neutral (`CELL_EMPTY` /
  transparent). The existing today ring is unchanged. The local `CELL_LIGHT` /
  `CELL_FULL` / `fillFor` constants are replaced by a `planColor`-driven helper.
- **Legend:** below the grid, one swatch + plan name per plan that appears in
  the visible window. Decodes the colors for *both* the strip and the heatmap.
  Distinct plan ids are collected from the `data` map; names come from the
  `plans` list Home already loads (`fetchPlans`).

**New/changed props:** `data: Map<string, HeatmapDatum>` (was
`Map<string, number>`); `plans: Plan[]` (for legend names).

## Home wiring

`src/screens/Home.tsx`:
- Update the `heatmap` state type to `Map<string, HeatmapDatum>`.
- Render `<CurrentWeekStrip data={heatmap} weekProgress={...} />` above
  `<HeatmapCard data={heatmap} plans={plans} />`.
- `weekProgress` derived from `summary.currentWeek.sessions`:
  `total = sessions.length`, `done = sessions.filter(s => s.finished).length`.

## Files touched

| File | Change |
|---|---|
| `src/common/databaseService.ts` | `fetchHeatmapData` query + return type; export `HeatmapDatum` |
| `src/screens/Home.tsx` | state type, strip mount, pass `plans` + `weekProgress` |
| `src/components/CurrentWeekStrip.tsx` | **new** |
| `src/components/HeatmapCard.tsx` | weekday axis, plan colors, legend, new props |

Tests: `fetchHeatmapData`'s return shape changes — update any test that asserts
on it. The strip and heatmap are pure views; a light render smoke test for the
strip is sufficient. No schema/seed change, so `seedMigration.test.ts` is
untouched.

## Out of scope (YAGNI)

- No split/striped boxes for multi-plan days (dominant plan wins).
- No calendar scheduling of future rest days.
- No tap handler on strip days in v1.

## Visual language compliance

Reuses existing tokens only: `planColor()` (already used by `WeekStrip`),
`colors.ink` / `colors.paper` / `colors.rule` / `colors.faint`, square corners,
1px hairlines, ALL-CAPS `letterSpacing` labels. No new hex literals in
components beyond the existing local heatmap neutrals.
