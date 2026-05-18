# Home Dashboard + Plan Switcher — Design

**Status:** Design approved by user
**Date:** 2026-05-18
**Target:** v2.1
**Spec:** v2 ([2026-05-17 schema rework](./2026-05-17-workout-warden-v2-design.md))

## Goals

1. **Surface plan switching prominently.** v2.0 has `setActivePlanId` and the schema supports arbitrary plans, but the only UI access is a row of buttons in `Weeks.tsx` that's hidden when only one plan exists. With a single plan today, the concept is invisible. Plan switching becomes a first-class action.
2. **Make Home useful.** Currently Home is a dog photo + quote + Export/Import buttons. Convert it to a small dashboard that answers "what should I do next?" and "where am I in my plan?" without scrolling more than half a screen.
3. **Address review-finding #3 from v2.0:** `Routes.SessionsTabs` caches `active_plan_id` once at mount; plan switches don't propagate until the app is restarted. Fix as part of this rework.

## Non-Goals

- In-app plan editor / plan creation UI (still v2.5+).
- Streaks, achievements, weekly volume analytics on the home dashboard.
- Splash screen redesign.
- Settings screen / gear icon (deferred — Export/Import stays on Home for now).
- Animations / transitions beyond standard React Navigation defaults.

## Layout

ScrollView with cards top-to-bottom, ordered by priority. Mobile-first: the first two cards must fit above the fold on a Pixel-6-sized screen (~840 dp content height).

```
┌─────────────────────────────────────────┐
│  Home                                   │  ← Bottom-tab header (existing)
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Active Plan                       │  │
│  │ Surf                          ⇄  │  │  ← Tap-anywhere = open switcher modal
│  │ 5-day strength + mobility comp…   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Next up                           │  │
│  │ Lower Body: Mon                   │  │
│  │ 13 exercises • Week 1 • day 1/5   │  │
│  │                       [ Start  ▶] │  │  ← Tap = navigate to Sessions/Mon
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Week 1                            │  │
│  │ ████████░░░░░░░░░░░░  2/5         │  │  ← Tap = navigate to Weeks
│  │ 12.05 – ?                         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ [Tucker image]                    │  │
│  │ "In the journey of life, I        │  │
│  │  choose the psycho path."         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ─── Data management ───                │
│  [ Export DB ]    [ Import DB ]         │
│                                         │
└─────────────────────────────────────────┘
```

### Edge cases

| State | NextSession card content | Progress card content |
|---|---|---|
| No active plan (shouldn't happen post-seed) | Hidden | Hidden |
| Active plan but no weeks ever | `[ + Start Week 1 ]` button | Hidden |
| Week exists, mid-progress (some sessions unfinished) | Shows first session where `finished = 0` (by `day_index`) with `[ Start ▶ ]` | Progress bar `done/total`, date range from min/max `trained_at` |
| Week exists, fully finished | `[ + Start Week 2 ]` button (creates next) | Progress bar 100% (full green) |
| Dog API fetch failed (offline) | Card behaves unchanged | Vibe card falls back to no image, just quote |

## Plan-Switcher Modal

```
┌─────────────────────────────────────────┐
│  Switch Plan                         ✕  │
├─────────────────────────────────────────┤
│  ✓ Surf                                 │  ← active, checkmark + highlight
│    5-day strength + mobility companion  │
│                                         │
└─────────────────────────────────────────┘
```

- Tap a plan row → call `setActivePlanId(db, planId)`, close modal, parent (Home) re-runs its data load.
- Tap ✕ or back-gesture → close, no change.
- Tapping the already-active plan row → no-op (write skipped, modal closes).
- Single-plan case: modal still opens to confirm "this is your only plan". Renders the one plan with the checkmark + a small italic line below: `Only one plan installed. Edit src/seeds/plans/ to add more.` This is honest about the v2.1 state (no in-app editor yet) and prevents a confusing "tap does nothing" feel.

## Architecture

### New files

```
src/components/PlanCard.tsx            — active-plan summary, taps open the modal
src/components/PlanSwitcherModal.tsx   — modal listing all plans
src/components/NextSessionCard.tsx     — what's next + action button
src/components/ProgressCard.tsx        — progress bar for current week
src/components/VibeCard.tsx            — dog image + random quote
```

`src/screens/Home.tsx` becomes a thin layout: data fetch in a `useFocusEffect` then renders the 4 cards + Export/Import buttons.

### New database read

```ts
// src/common/databaseService.ts

export interface HomeSummary {
  activePlan: Plan;
  currentWeek: Week | null;       // most recent week (created_at DESC LIMIT 1)
  nextSession: Session | null;    // first session WHERE finished = 0 ORDER BY day_index
                                  // null if no week OR week fully finished
}

export async function fetchHomeSummary(db: SQLiteDatabase): Promise<HomeSummary | null>;
```

Implementation uses three DB calls in sequence:
1. `fetchActivePlanId(db)` — settings table lookup, ~1ms
2. `SELECT * FROM plans WHERE id = ?` — single row, ~1ms
3. One JOIN query: most-recent week + all its sessions, ordered by `day_index`:
   ```sql
   SELECT w.id AS week_id, w.created_at, w.finished AS week_finished,
          s.id AS session_id, s.day_index, s.weekday_label, s.session_name,
          s.trained_at, s.finished AS session_finished
   FROM weeks w
   LEFT JOIN sessions s ON s.week_id = w.id
   WHERE w.plan_id = ?
     AND w.id = (SELECT MAX(id) FROM weeks WHERE plan_id = ?)
   ORDER BY s.day_index ASC
   ```

The `nextSession` is selected client-side from the sessions array (first with `finished = 0`). Returns `null` only if no active plan id is set (which means seedDB never ran — broken state).

### Plan-switch propagation

Fixes review finding #3.

- `Routes.tsx#SessionsTabs`: replace the `useEffect(..., [])` with `useFocusEffect(useCallback(async () => { ... }, []))` — re-reads `active_plan_id` + `fetchPlanDays` every time the Sessions tab gains focus. ~50ms cost per focus, fine.
- `src/screens/Weeks.tsx`: same change to its init effect. Also **remove** the existing `plans.length > 1` plan-tabs row (lines 89–101) — Home is now the canonical place.

### Navigation

- Tap NextSessionCard `Start` button:
  - If a current week exists and has the matching session, navigate using React Navigation's nested route syntax:
    ```ts
    navigation.navigate('Sessions', {
      screen: nextSessionLabel,  // matches the SubTab.Screen `name` prop
      params: {weekID: currentWeek.id, day_index: nextSession.day_index, title: nextSessionLabel},
    });
    ```
  - `nextSessionLabel` is computed the same way `Routes.SessionsTabs` builds tab labels: `${session_template_name}: ${weekday_label}` (or just template name when no weekday).
- Tap ProgressCard anywhere: `navigation.navigate('Weeks')`.
- Tap PlanCard anywhere: open local modal (no navigation).
- "Start Week N" button: `createWeek(db, activePlanId)` → then re-load Home → then `navigation.navigate('Sessions', {…})` to first session.

### State

Home holds:
```ts
const [summary, setSummary] = useState<HomeSummary | null>(null);
const [loading, setLoading] = useState(true);
const [modalVisible, setModalVisible] = useState(false);
const [error, setError] = useState<Error | null>(null);
```

`useFocusEffect` triggers `fetchHomeSummary` on mount and every navigation focus. After plan switch in modal: `await setActivePlanId(db, id); setModalVisible(false); await refresh();` inside the same handler — explicit, responsive (no implicit useEffect dependency dance).

## Data flow

```
useFocusEffect → fetchHomeSummary(db) → setSummary
                                       ↓
                       PlanCard reads summary.activePlan
                       NextSessionCard reads summary.nextSession / summary.currentWeek
                       ProgressCard reads summary.currentWeek (with derived done/total)
                       VibeCard reads its own state (dog URL passed as prop from App.tsx
                         — same wiring as v2.0)

Plan switch:
  Modal onSelect(planId)
    → setActivePlanId(db, planId)
    → modal closes
    → Home.refresh() = fetchHomeSummary again
    → cards re-render with new plan's data

Sessions tab on next focus:
  → useFocusEffect re-reads active_plan_id
  → re-fetches plan_days
  → SubTab.Navigator rebuilds with new screens
```

## Error handling

- `fetchHomeSummary` throws if DB connection fails → caught in Home's useFocusEffect → renders `<ErrorComp error={error} />` instead of cards.
- Plan switch DB write fails → toast appears, modal stays open with old selection.
- `createWeek` (from "Start Week N" button) fails → toast, no nav, retry-able.
- Dog-fetch unchanged: already handled at App.tsx with the existing toast.

## Testing

- **Unit tests** (`__tests__/databaseService.summary.test.ts` or similar — needs in-memory DB):
  - `fetchHomeSummary` with no active plan → returns null
  - With active plan, no weeks → `currentWeek` null, `nextSession` null
  - With week, all sessions unfinished → `nextSession` is day 1
  - With week, day 1 + day 3 finished → `nextSession` is day 2 (lowest day_index where finished=0)
  - With week, all finished → `nextSession` null, `currentWeek.finished` is truthy
- **Visual smoke test:** open app on emulator, verify Home renders each card with seeded Surf plan + no weeks state, then after `Add new Week`, the cards update.

## Out of scope (defer to v2.2+)

- Settings screen / gear icon
- Day-of-week-aware suggestion ("It's Wednesday — Lower Body (Nordic) today?")
- Push notifications / reminders
- Weekly volume / per-exercise progression on dashboard
- Plan duplication / per-user plan customization
- Multiple concurrent active plans

## Migration

None — additive feature, no schema change, no data change. Existing v2.0 users get the new Home on next app launch. No backwards-incompat.
