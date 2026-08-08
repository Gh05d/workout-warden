# Surfing Rename + Altinha Yellow — Design

**Date:** 2026-08-08
**Status:** Approved (device-feedback iteration on `2026-08-08-spot-chips-colors-design.md`, shipped as v2.2.12); executed inline in the same session.

## Changes

1. **Activity display name `Surf` → `Surfing`** (`src/seeds/activities.ts`). The plan list read "Surf, Surf 2.0, Surf" — plan and activity were indistinguishable in legends. Slug stays `surf` (the stable key all sessions reference); the catalogue upserts by slug on every start, so the name propagates on the next app launch — no migration, no `SEED_REVISION`. `seedMigration.test.ts` expectations updated.
2. **Altinha fg `#388E3C` (green) → `#F9A825` (sun gold)** (`src/common/planColor.ts`); bg stays `#FFF59D`. On device, the green fg sat too close to Surfing's ocean blue at small sizes. Altinha is now all-yellow. Accepted trade-off: the gold fg is ~2:1 on white paper — the same league as the app's `#FF9800` accent, which carries white text app-wide; darker yellows (Yellow 900+) read as orange and would collide with the plan-orange slot.

## Testing

Value-agnostic palette/blend suites unchanged and green; `seedMigration.test.ts` asserts the new name on fresh seed and idempotent re-upsert; full suite 139/139.
