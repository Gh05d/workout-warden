# Spot Quick-Select + Color Redesign — Design

**Date:** 2026-08-08
**Status:** Approved in brainstorming (follow-up to `2026-08-08-activity-tracking-quotes-design.md`, shipped as v2.2.11)

## Goals

1. **Spot quick-select:** logging a session at a known spot must not require typing — recently used spots are one tap away.
2. **Color redesign:** activity colors were Material-900 tones that read as near-black at small sizes (user feedback on device). Replace both palettes with a coherent scheme: **warm tones for plans (gym), cool water/nature tones for activities.** User-set anchors: Surf = ocean blue, Altinha = Brazilian yellow/green.

## Non-goals

- No spot management UI (no rename/delete of spots — the list is derived from history).
- No spots table; spots stay plain TEXT on `activity_sessions`.
- No theme/dark-mode work; `theme.ts` tokens untouched.

## 1. Spot quick-select (history chips)

### Data

New read in `src/common/databaseService.ts`:

```ts
fetchRecentSpots(db: SQLiteDatabase): Promise<Map<number, string[]>>
```

- One query over `activity_sessions WHERE spot IS NOT NULL`, grouped by `(activity_id, spot)`, ordered by recency (`MAX(performed_at) DESC, MAX(id) DESC`).
- Folded in JS into `activityId → string[]`, capped at **8 spots per activity**.
- Spots are matched as stored (they are already `trim()`ed at save time); no case folding.

### Data flow

`Activities.tsx` fetches the map in its existing `refresh()` (alongside sessions/activities) and passes it to the modal as a new prop:

```ts
recentSpotsByActivity: Map<number, string[]>
```

The modal stays DB-free (props + callbacks only). The screen refreshes after every save, so chips are current on the next open.

### UI (ActivitySessionModal)

- Chip row **below the SPOT input**, duration-chip styling, showing the spots for the **currently selected activity** (switching the activity pill switches the chips).
- Tap fills the spot field; tapping the chip matching the current field value clears it (toggle, same as duration chips). Selected state = chip whose label equals `spot.trim()`.
- No spots for the activity → no chip row, just the input.

## 2. Color redesign

Both palettes live in `src/common/planColor.ts`. `bg` stays pastel (100-level), `fg` moves to vivid 600–800 — nothing darker than 800, so nothing reads as black. Blends (`mixHexColors`) and all consumers pick the change up automatically.

### Activity palette (cool / water / nature)

| Slot | Activity | bg | fg |
|---|---|---|---|
| 1 | Surf | `#B3E5FC` | `#0277BD` (ocean blue) |
| 2 | Altinha | `#FFF59D` (yellow) | `#388E3C` (Brazilian green) — the yellow-bg/green-fg *pair* is the Brazil identity |
| 3 | reserve | `#B2DFDB` | `#00897B` (teal) |
| 4 | reserve | `#B2EBF2` | `#0097A7` (cyan) |

### Plan palette (warm / gym)

| Slot | Current plan | bg | fg |
|---|---|---|---|
| 1 | Surf | `#FFE0B2` | `#EF6C00` (orange — matches the app's primary accent family) |
| 2 | Surf 2.0 | `#FFCDD2` | `#D32F2F` (red) |
| 3 | Strength | `#E1BEE7` | `#8E24AA` (violet) |
| 4 | reserve | `#F8BBD0` | `#C2185B` (magenta) |
| 5 | reserve | `#D7CCC8` | `#6D4C41` (bronze) |
| 6 | reserve | `#CFD8DC` | `#546E7A` (slate) |

### Properties preserved

- Plan-fg set and activity-fg set are disjoint (existing `planColor.test.ts` assertion keeps passing — it checks distinctness, not concrete hex values).
- All fg values keep ≥ ~3.5:1 contrast on white paper (labels are bold) and carry white text on filled pills.
- Warm-vs-cool split keeps plans and activities tellable apart even in heatmap blends.

## Testing

- `fetchRecentSpots` against real SQLite (better-sqlite3 harness in `__tests__/activityService.test.ts`): per-activity grouping, recency order, cap at 8, NULL spots excluded, empty result.
- Palette: existing `planColor.test.ts` suite must stay green unchanged (it is value-agnostic).
- Chip UI: no dedicated component test (repo convention); toggle logic mirrors the already-shipped duration chips.

## Rollout

Standard release flow; no schema change, no `SEED_REVISION` bump, no migration.
