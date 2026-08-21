# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

React Native 0.85 mobile app (TypeScript) for tracking strength + surf-conditioning workouts. Android is the primary target (iOS scaffolding is present but the SQLite path in `databaseService.ts` is Android-only). All workout data lives in a local SQLite database; the app makes one external network call (random dog image). **The app must work fully offline** — that fetch is decorative, lives in `VibeCard.tsx` with the state it renders, and is bounded by a 5 s `AbortController`. Never put it (or any network call) on the startup path: it previously sat in a `Promise.all` with `initDB()`, so an unreachable network held the splash screen open indefinitely, and a rejected fetch let the app render while seeding was still running. Only `initDB()` may gate `initiated`. Don't move the fetch back up to `App.tsx` either: delivering the result down through Routes' `initialParams` only works for fetches that win the race against the splash screen — a mounted screen never re-reads `initialParams`, so late resolutions silently never showed.

**Schema version: v2** — a clean-slate, plan-driven schema replaced the v1 hardcoded A/B/C program model in version 2.0.0. There is no in-app migration from v1; the only path forward for a v1 user is the CLI import script (see "Legacy data import" below).

## Commands

```bash
yarn start                       # Metro bundler with --reset-cache; sets USE_CONSOLE=true so console.* survives babel
yarn android                     # Run debug build on connected device/emulator
yarn ios                         # iOS run (untested path)
yarn lint                        # ESLint
yarn test                        # Jest (smoke test, seed/slugify units, seed-migration against real SQLite)
yarn test -- -t "renders"        # Run a single test by name

yarn build-prod:android          # cd android && ./gradlew assembleRelease
cd android && ./gradlew :app:compileDebugKotlin   # fast (~40s incremental) compile check for native-module Kotlin changes, no APK build
yarn update-version:android      # Sync android/app/build.gradle versionName from package.json, bump versionCode
./version-update.sh patch|minor|major   # Full release: npm version → sync gradle → assembleRelease → commit → push

npm run import:legacy <source.db> <target.db>   # CLI import of a v1 warden-exported.db into the v2 schema
```

The `transform-remove-console` babel plugin strips `console.*` from production bundles unless `USE_CONSOLE=true` is set (the `start` script sets it; release builds do not). Keep this in mind when debugging — `console.log` you add will be gone in release.

Package manager: yarn 3.6.4 (berry) with `nodeLinker: node-modules`. `npm` also works because of the standard `node_modules` layout.

Yarn berry is wired but **broken** — `.yarnrc.yml` points at a missing `.yarn/releases/yarn-3.6.4.cjs`. Don't use `yarn <cmd>`. Use `npm run <script>` for package.json scripts, or call tools directly via `node_modules/.bin/<tool>` (jest, eslint, tsc).

### Sideloading to the Pixel 7

`adb -s 34061FDH2005AW install -r app-release.apk` reliably prints `failed: Performing Streamed Install` even on successful installs. Verify the install actually happened with `adb -s 34061FDH2005AW shell dumpsys package com.workoutwarden | grep -E "versionName|lastUpdateTime"`. The USB connection on this device drops frequently — re-issue the `dumpsys` command after a few seconds if it returns nothing. If `dumpsys` reports the *previous* version right after an install, the connection dropped mid-verify rather than the install failing: `adb kill-server && adb start-server`, then re-check (`adb reconnect` is not enough). Same fix when `adb devices` lists nothing right after plugging in the unlocked phone — the stale daemon, not the device, is usually the problem.

Always bump the version *before* sideloading so `versionName` is the verification: `npm version patch --no-git-tag-version && node update-android-version.js`.

## Architecture

### Data model (v2)

Twelve SQLite tables defined as `CREATE TABLE IF NOT EXISTS` statements in `src/common/databaseService.ts:SCHEMA`. Foreign keys are enforced via `PRAGMA foreign_keys = ON` on every connection.

There is no schema versioning framework. New columns are added via the idempotent pattern at the top of `seedDB` — `try { ALTER TABLE … ADD COLUMN … } catch {}` — which is a no-op on fresh installs (column already exists in CREATE TABLE DDL) and a one-shot migration on upgrades. Use this sparingly; structural changes still need import-legacy.ts.

**Template side** (populated from seeds, never edited by the user; rewritten only on a `SEED_REVISION` bump — see "Seed system"):

- `plans` — top-level program (e.g. "Surf"). `slug` is unique. The currently active plan is recorded as `settings.active_plan_id`.
- `session_templates` — a named workout (e.g. "Foundation A"). Unique by `slug`. Shared across plans by slug, but in practice each plan owns its templates.
- `plan_days` — maps a plan to its weekly schedule: `(plan_id, day_index)` is unique; `weekday_label` is an optional display string (e.g. "Mon"). `day_index` is a dense 1..N counter; the Sessions top-tab bar enumerates these.
- `exercises` — catalogue of unique movements by `slug`, with display `name` and optional YouTube `video` ID. Catalogue grows on every startup, never shrinks (upsert by slug).
- `session_template_exercises` — the prescription rows. Each row belongs to a `session_template` and references one `exercises` row. Carries `order_index` (dense 1..N within a template), optional `circuit_index` + `circuit_rounds` for circuit grouping, exactly one of `prescribed_reps` / `prescribed_seconds`, `prescribed_sets >= 1`, `per_side` / `as_maximum` flags, and an optional `hint`.

**User-data side** (created when the user adds a week):

- `weeks` — one row per training week, linked to a `plan_id`. Has `created_at` and `finished` (set to 1 automatically when all of the week's sessions are finished — see `finishSession`).
- `sessions` — one row per scheduled session within a week. Stores the resolved `session_name`, `day_index`, optional `weekday_label`, plus `trained_at` and `finished`. `ON DELETE CASCADE` from `weeks`. Nullable kcal snapshot (see "Calorie estimation").
- `session_exercises` — a *copy* of the template prescription at the moment the week was created. Carries the same prescription fields plus a `finished` flag. Copying decouples user history from later seed edits.
- `sets` — recorded `weight` / `reps` / `seconds` per session_exercise. `(session_exercise_id, set_index)` is unique. Rows are pre-inserted empty when the week is created (one per `prescribed_sets`), then mutated in place by `updateSet`.

**Other:**

- `settings` — key/value store: `active_plan_id`, `seed_revision`, and the `profile_*` keys (see "Calorie estimation").
- `activities` — free-form activity catalogue (surf, altinha), seeded from `src/seeds/activities.ts` and upserted by `slug` on every start like `exercises` — grows over releases, never gated by `SEED_REVISION`.
- `activity_sessions` — one row per logged activity occurrence: local-date `performed_at` (a plain `YYYY-MM-DD` string, never `new Date('YYYY-MM-DD')` — see `parseIsoDate`), nullable `duration_minutes` / `spot` / `note`. Multiple rows per day are expected (two surf sessions in a morning). No FK into `plans`/`weeks`/`sessions` — activities are logged independently of the plan system. DDL here must stay in sync with `scripts/schema-v2.sql`. Nullable kcal snapshot, computed at save time.

Indexes back the lookup paths used by `fetchWeeksByPlan`, the Statistics SQL, and `fetchPlanDays` (see end of `SCHEMA` block).

### Seed system

`src/seeds/` is the source of truth for exercise + plan content. Layout:

- `src/seeds/exercises.ts` — exercise catalogue (`ExerciseSeed[]`).
- `src/seeds/plans/<slug>.ts` — one file per plan (`PlanSeed`): `surf.ts`, `surf-2.ts`, `strength.ts`.
- `src/seeds/index.ts` — barrel that exports `EXERCISES`, `PLANS` and `SEED_REVISION`.

On every app start, `initDB` runs the schema DDL and then `seedDB`. `seedDB`:

1. Calls `validateSeed` (see `src/common/seedValidator.ts`) — this throws synchronously on duplicate slugs, missing exercise references, gappy `order_index` values, missing or conflicting prescription fields (`prescribed_reps` XOR `prescribed_seconds`), and inconsistent `circuit_rounds` within a `circuit_index`. **Seed drift fails fast at startup, before any rows are written.**
2. Reads `settings.seed_revision` and compares it against `SEED_REVISION` (see below).
3. Upserts all `EXERCISES` by `slug` (the catalogue can grow between releases without losing user data).
4. For each plan: inserts the plan if missing, then inserts any missing `session_templates`, then inserts any missing `plan_days`. On a revision bump it additionally *rewrites* the content of rows that already exist.
5. Writes `settings.seed_revision`.
6. Sets `settings.active_plan_id` to the first seeded plan if no active plan is recorded yet.

Adding a new plan means: drop a new file in `src/seeds/plans/`, add it to the `PLANS` array in `src/seeds/index.ts`, ship. Existing user data is untouched; the new plan becomes selectable.

#### Changing an existing plan: bump `SEED_REVISION`

`session_templates` and their `session_template_exercises` are **write-once per slug**. A device that has already seeded a plan will never see edits to that plan's prescriptions — and the plan is seeded on the *first app start after install*, not when the user switches to it or creates a week. Editing a shipped plan without a revision bump therefore silently does nothing on any device that already ran the app.

`SEED_REVISION` (in `src/seeds/index.ts`) is the escape hatch. When it is greater than the stored `settings.seed_revision`, `seedDB` rewrites, for every plan: `plans.name`/`description`, `session_templates.name`, all `session_template_exercises` (delete + re-insert), and `plan_days` (template mapping + `weekday_label`).

**Bump it whenever you change exercise selection, sets, reps, order, circuits or hints — or a plan's `days` (day→template mapping, `weekday_label`).** You do *not* need to bump for exercise `name`/`video`/`description` — those live on `exercises` and upsert on every start, so they can be backfilled at any time.

This is safe for user data: weeks/sessions/sets hang off `session_exercises`, which is a *copy* taken by `createWeek`, and is never read back from the template. Fresh installs (no `plans` rows) skip the refresh entirely. `__tests__/seedMigration.test.ts` drives `seedDB` against real SQLite (`better-sqlite3`) and asserts fresh-install, idempotence, stale-revision rewrite, and that recorded sets survive a refresh — extend it when you touch this path.

### Navigation

`src/Routes.tsx` builds a bottom-tab navigator (Home / Weeks / Activities / Sessions / Statistics).

The **Activities** tab (`src/screens/Activities.tsx`) is a flat, plan-independent log — not built from `plan_days` like Sessions. Log entries are grouped by ISO week (`activityStats.groupByIsoWeek`) with per-week totals in the section header, plus `ActivityWeeklyBars` up top. Add/edit go through `ActivitySessionModal`, a bottom sheet opened from the FAB or by tapping a row; delete lives in the same modal. The date field is a day-stepper (±1 day, capped at today), not a datepicker — deliberately dependency-free, since backdating one day at a time is the actual use case.

The **Sessions** tab nests a `createMaterialTopTabNavigator` whose tabs are built dynamically from `plan_days` for the current `active_plan_id`:

```
Routes mounts → SessionsTabs reads active_plan_id from settings
              → fetchPlanDays(planId) returns ordered PlanDay[]
              → one SubTab.Screen per day, label = session_template_name (+ weekday_label if set)
```

This means the tab bar reflects the structure of the active plan: switch plans (by updating `settings.active_plan_id`) and the Sessions tab will rebuild on next mount. There is no longer any A/B/C type distinction, no `AsyncStorage` `TRAINING_TYPE` flag, and no separate `Standard` / `Surf` top tabs in `Weeks` — Weeks shows weeks for the active plan.

### Database access pattern

Every CRUD function takes a `SQLiteDatabase` as its first argument; callers grab one with `getDBConnection()` (which also enables foreign keys). There is no module-level cached connection — connections are cheap with `react-native-sqlite-storage`.

**Reads** are designed to avoid N+1:

- `fetchWeeksByPlan(db, planId)` is a **two-query fold**: one `weeks LEFT JOIN sessions` query, then one `session_exercises JOIN exercises LEFT JOIN sets ... WHERE session_id IN (?, ?, ...)` query. Result is folded back into nested `Week → Session → ExerciseInstance → SetLog[]` objects in JS.
- `fetchWeekById` is a thin wrapper around `fetchWeeksByPlan`.
- `fetchExerciseStats(db, slug)` aggregates in SQL with `MAX(weight)`, `MAX(reps)`, and a per-side correction (`CASE WHEN per_side = 1 THEN reps * 2 ELSE reps END`), grouped by `DATE(trained_at)`. No JS-side aggregation.

**Mutations** are the primitives the UI calls:

- `createWeek(db, planId)` — inserts a week, then enumerates `plan_days`, copying template exercises into `session_exercises` and pre-creating empty `sets` rows.
- `deleteWeek(db, weekId)` — cascade delete via FK.
- `updateSet(db, setId, {weight?, reps?, seconds?})` — partial update; undefined fields are left alone.
- `setSessionExerciseFinished(db, sessionExerciseId, finished)` — toggle on an exercise row.
- `finishSession(db, sessionId)` — marks session finished, stamps `trained_at`, and cascades the week to finished if all its sessions are done.
- `setActivePlanId(db, planId)` — upserts the `settings` row.

**Backup / restore:** `exportDatabase` / `importDatabase` copy `warden.db` to/from `RNFS.DownloadDirectoryPath`. The DB path (`/data/data/com.workoutwarden/databases/warden.db`) is hardcoded for Android.

### Legacy data import (v1 → v2)

`scripts/import-legacy.ts` (run via `npm run import:legacy`) is a Node CLI (uses `better-sqlite3` + `tsx`) that reads a v1 `warden-exported.db` and writes into the v2 schema. It:

1. Builds the schema from `scripts/schema-v2.sql` if the target is empty.
2. Creates a single `'legacy'` plan with `name = 'Standard (Legacy)'`.
3. Builds `session_templates` and `plan_days` from the *distinct* `day` strings in the v1 `training_days` table (slugified via `src/common/slugify.ts`).
4. Re-IDs exercises, weeks, sessions, session_exercises, and sets, preserving `weight` / `reps` / `finished` / `trained_at` (using the program's `end_date` as a fallback).

The script is meant to run once on a developer machine, producing a `warden.db` the user can side-load via the in-app import. It is not invoked by the app at runtime.

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

### UI conventions

- **Exercise rendering** (`src/components/Exercise.tsx`) reads the structured prescription on the row: `prescribed_reps` vs `prescribed_seconds` controls whether a reps input or a stopwatch is shown; `per_side` adds a "/side" suffix; `as_maximum` renders the prescription as "Max" rather than a fixed number.
- **Circuit grouping** is purely visual: `Session.tsx`'s `groupByCircuit` helper folds consecutive `session_exercises` that share a `circuit_index` into a single grouped block with an "× N rounds" badge. The DB stores them as a flat ordered list.
- **Quotes** come from `src/common/quotes.ts` (extracted from the deleted `variables.tsx`) — a flat list picked randomly on Home mount.
- **Theme** lives in `src/common/theme.ts`. It is the single source of truth for the `colors` palette used by `NavigationContainer` and component styles.
- **`Accordion` unmounts its children when collapsed** (`{open && <View>{children}</View>}`), not just visibility-hidden. State inside children is lost; stateful side effects (MediaPlayer instances, JS intervals) need explicit cleanup in their unmount path. System-level effects (`Vibration`) survive unmount since they're owned by the OS.
- **Home "This Week" strip** (`CurrentWeekStrip.tsx`): current ISO week Mon–Sun with two regimes per cell (ink ring = today). *Scheduled* days are a checklist: ✓ (active-plan colour) when that weekday's **session is finished** — mapped via `heatmapMath.completedScheduledWeekdays` from the current week row's finished sessions to the weekday `plan_days` schedules them on, restricted to `trained_at` within the current ISO week (week rows are **not** calendar-anchored, a months-old row must not light up a fresh week). A quiet dot = session still open. *Unscheduled* days keep the calendar view: ✓ tinted by the plan trained that day. Checks are per **scheduled** weekday, not per trained calendar day — Tuesday's plan finished on Wednesday checks off Tuesday, Friday's plan pre-trained on Thursday checks off Friday; otherwise the strip contradicts the sessions-finished counter next to it (5/5 with missing checks). Its progress bar counts **scheduled training days only** — putting rest days in the denominator means a Mon–Fri plan can never read 100%. Scheduled weekdays come from the active plan's `plan_days.weekday_label`, the *recurring* schedule; a plan without labels yields no dots and no bar.
- **Home heatmap** (`HeatmapCard.tsx`): 16w × 7d grid with the weekday letters on the left axis (no text fits in a ~15px cell), cells tinted `planColor(planId).bg` for one session that day / `.fg` for two or more, legend below naming the plans and activities present in the window. `cellSize` must subtract *every* horizontal chrome item (`HORIZONTAL_CHROME`, `AXIS_WIDTH`, `AXIS_GAP`, inter-cell gaps) — the card has no `overflow: hidden`, so a forgotten term makes the grid poke past its border at some widths.
- **Day-cell band rule** (`heatmapMath.dayPaintBands`): a calendar day's color is a function of its `DaySources` (one dominant plan session + zero or more activity entries). It returns one `{bg, fg}` palette pair **per source**, in a stable order — dominant plan first, then activities sorted by `activityId` *inside the function*, so band order doesn't depend on row order from the query. Colors are **never averaged**: `planColor` is deliberately warm and `activityColor` deliberately cool, and averaging complementary hues lands near gray in *any* color space — a gym+surf day rendered as an olive-brown belonging to neither. (A blend via `mixHexColors` shipped once and was replaced for exactly this; don't reintroduce it, and don't try to fix it with a "better" color space or a duration/kcal weighting — weighting only moves the mud, and `duration_minutes`/`kcal` are nullable anyway, with plan-side kcal a flat constant.) Multi-source days paint as equal-width, **hard-edged diagonal bands** built by `planColor.diagonalBands(colors)` → a `linear-gradient(135deg, …)` CSS string where each color repeats at both ends of its slice (the repeated stop offset is what makes the edge hard instead of a blur); first color top-left, last bottom-right. It returns `null` below two colors — one source stays a plain `backgroundColor`, cheaper than a gradient drawable. Consumed via RN 0.85's `experimental_backgroundImage` (no SVG/gradient dependency; native side is `LinearGradient.kt` + `BackgroundImageDrawable.kt`). **Always set `backgroundColor` to `bands[0]` alongside the gradient** — the prop is still `experimental_`, and that fallback is what makes a cell degrade to one solid color instead of to nothing. Callers pick which variant to band: the heatmap uses `fg` from 2 total entries up (`dayTotalCount(s) >= 2`, matching the existing single-plan-day threshold), `CurrentWeekStrip` bands `bg` for the cell fill and `fg` for the rail, and takes `bands[0].fg` for the things that must stay one color (border, day label, ✓/• mark). `CurrentWeekStrip`'s scheduled-day checklist semantics are unchanged by any of this — activities only widen the *unscheduled* branch (calendar view), never touch the ✓/dot logic or the progress bar. The heatmap streak (`currentWeekStreak`) and "last 30 days" count (`daysInLast`) both run over the union of trained-plan-days and activity-days, so an activity-only week keeps a streak alive. `activityColor` (in `planColor.ts`) follows the palette concept **warm = plans (gym), cool/water = activities** (surf ocean-blue, altinha all-yellow — user-chosen identities). Keep fg tones in the vivid 600–800 range — Material-900 fgs shipped once and read as near-black at small sizes (rails, bars, 15px cells) — and keep entries hue-distant across both palettes. Activity display *names* share legend space with plan names: keep them distinct (the activity is "Surfing", not "Surf" — the legend once read "Surf, Surf 2.0, Surf").
- **Home data fetches**: `Home.tsx`'s `refresh()` has **two** `Promise.all` fan-outs — the normal path and the self-heal path (re-run after `initDB` when the summary is null, e.g. right after an import). A fetch added to only one of them works in normal testing and silently misses on self-healed starts; extend both.
- **Errors while a `<Modal>` is open** must render *inside* the Modal subtree (see `ActivitySessionModal`'s `error`/`onClearError` props): RN's native Modal layers above the entire host view, so a root-level `<Toast>` fired on a failed save is invisible behind the open sheet — and auto-dismisses before the sheet ever closes.
- **Statistics chart** (`src/screens/Statistics.tsx`): `victory-native`'s `CartesianChart` crashes when any value in a `yKey`'d column is `null` — it can't compute a domain from nulls; only feed it non-null points. `fetchExerciseStats` returns `max_weight: null` for bodyweight exercises (reps but no weight); the screen charts the `max_weight` series when present and falls back to the `max_reps` series otherwise (`metric` state switches the y-axis suffix kg/reps).

### Global TypeScript types

`src/common/types.ts` is a **module** (not an ambient `.d.ts`), so consumers must `import type {Plan, Week, Session, ExerciseInstance, SetLog, ...} from '../common/types'`. The v1 ambient `src/common/global.d.ts` is gone. Two type families live in this file: seed-side (`ExerciseSeed`, `PlanSeed`, `SessionTemplateSeed`, `ExercisePrescription`, `PlanDaySeed`) and DB-side (the row shapes returned by `databaseService` functions).

### Patches

`patches/` contains `patch-package` patches applied on `postinstall`:

- `react-native-sqlite-storage+6.0.1.patch` — removes the `jcenter()` Maven repo, which is dead and breaks Android builds.
- `@react-native-async-storage+async-storage+3.0.2.patch` — registers `mavenLocal()` / `local_repo` so async-storage 3.x resolves on AGP setups that don't expose the React Native Maven repo to library modules.

Both patches must travel with the repo; CI / fresh clones will fail to assemble Android without them.

### Native modules

- **`TimerSound`** (`android/app/src/main/java/com/workoutwarden/TimerSoundModule.kt`) — minimal MediaPlayer bridge playing `res/raw/timer_done.mp3` on the `USAGE_ALARM` stream. `play()` is idempotent and the module is `@Synchronized` (the completion listener fires on a different thread than @ReactMethod calls). JS side: don't call the bridge directly from components — use `startAlarm()` / `stopAlarm()` from `src/common/timerSound.ts`, which pair the sound with the repeating vibration pattern. Components drive the alarm from a status-state effect (`if (expired) { startAlarm(); return () => stopAlarm(); }`), never from inside a state updater — the effect cleanup is what guarantees vibration+sound stop on unmount (`Vibration.vibrate(pattern, true)` repeats forever otherwise). iOS = no-op fallback. Swap the alarm sound by replacing the mp3 file in-place — filename must stay `timer_done.mp3` (Android raw-resource names are lowercase + underscores only).
- **`TimerTick`** (`android/app/src/main/java/com/workoutwarden/TimerTickModule.kt`, registered alongside `TimerSound` in `TimerSoundPackage.kt`) — a Handler-driven native ticker emitting a `WorkoutTimerTick` DeviceEventEmitter event every `intervalMs`. `timerController.ts` uses it (when present) to drive the running notification's per-second refresh instead of JS `setInterval`, because RN's Timing module pauses `setInterval` on host-pause even with the foreground service alive — the native Handler keeps firing as long as the FGS keeps the process alive. iOS / Jest (`NativeModules.TimerTick` undefined) fall back to `setInterval`.
- Native packages use the legacy `ReactPackage` interface registered manually in `MainApplication.kt`. Under RN 0.85's new arch they work via the interop layer but emit a `createNativeModules` deprecation warning — suppress with `@Suppress("DEPRECATION")` on the package class rather than migrating one-off modules to codegen.

## Visual language

The in-app aesthetic is "Tactical Logbook": dark surfaces (`colors.ink`), orange accents (`colors.primary`), green for completion, square corners, 1px `colors.rule` hairlines, ALL-CAPS labels with `letterSpacing: 1.4–2`. No soft drop-shadows, no rounded-12 pastel cards. Use `TacticalButton` instead of native `<Button />`. Use tokens from `src/common/theme.ts` — don't introduce new hex literals in components.

Per-plan colour identity comes from `planColor(planId)` (palette in `src/common/planColor.ts`). Reuse the same pill shape for plan tags across Home / Weeks / PlanSwitcher so visual identity is stable.

## Android quirks

- **TextInput text gets clipped / pushed up** on Android. Always set `paddingVertical: 0`, `textAlignVertical: 'center'`, `includeFontPadding: false` on numeric inputs (see `Exercise.tsx` `numField` and `InlineTimer.tsx`).
- **Vibration patterns**: the first array element is always a *wait* duration, not a buzz. `Vibration.vibrate([1000, 2000, 3000], true)` is silent for 1s before the first pulse. Start with `0` for an immediate buzz — `InlineTimer.tsx` / `CountdownTimer.tsx` use `[0, 600, 250, 600, 250, 1200]`.
- **Accordion-style open/close** must use `react-native-reanimated` (`FadeIn` + `FadeOut` + `LinearTransition`). Plain `LayoutAnimation` is flaky under Fabric / RN 0.85 — silently no-ops on body height.
- **Adaptive launcher icon** foregrounds must be full-bleed (no white padding). To regenerate from `assets/icon.png`, use the Python+PIL script pattern that writes to `mipmap-{mdpi…xxxhdpi}/ic_launcher{,_foreground,_round}.png` at 48/72/96/144/192 (legacy) and 108/162/216/324/432 (adaptive).

## Navigation gotcha

`navigation.navigate('Sessions', {screen: <name>, params})` only works when `<name>` exists as a `SubTab.Screen` in the Sessions top-tab navigator, and those screens are generated from the **currently active plan's** `plan_days`. Navigating to a session of a different plan via this form silently no-ops the params → `Session.tsx` falls back to "newest week of active plan". For cross-plan / historical session access, render `SessionScreen` directly in a `<Modal>` with `weekID` + `day_index` props (see `Weeks.tsx`'s session-detail modal).

Build the route name from `plan_days` — the same source `Routes.tsx` names the screens from — never from a session row's `session_name`/`weekday_label`. `createWeek` snapshots those at week creation, so a `SEED_REVISION` bump that rewrites `plan_days` leaves already-created weeks holding stale copies that name a screen which no longer exists, and `navigate()` no-ops silently. See `Home.tsx`'s `sessionRouteLabel`.

## TypeScript errors

Treat TS errors on imports from third-party libraries as **real contracts**, not pre-existing noise. TS1192 "no default export" on `@dr.pogodin/react-native-fs` was a real runtime bug (`undefined.copyFile`), not a config quirk. Check the library's actual export shape before dismissing as noise.

That said, `tsc --noEmit` is **not clean** on this repo. Known pre-existing noise: victory-native `CartesianChart` generics in `Statistics.tsx` (data/xKey/yKeys/points errors — the chart works at runtime), `Routes.tsx` screen-component typings, everything in the dead `useFetchData.tsx`, and all of `__tests__/` (no jest types in tsconfig). To check whether a change introduces NEW errors, diff the error list against HEAD: `git worktree add --detach /tmp/ww-head HEAD`, symlink `node_modules` into it, run tsc in both, compare. Don't run bare `git stash` to get a baseline — and remember to run tsc from the repo root, not the worktree, for the "after" list. A compound `cd <worktree> && tsc … ; tsc …` keeps the `cd` for the *whole* command, so both lists silently come from the worktree and the diff is vacuously clean — run the "after" pass as its own command from the repo root.

Before trusting the diff, normalize `node_modules` paths: the worktree's `node_modules` is a symlink, so tsc reports those files as `../../home/…/workout-warden/node_modules/…` relative to the worktree, instead of the plain `node_modules/…` the repo-root run prints for the identical file — diffing the two lists as-is shows hundreds of spurious add/remove pairs for *unchanged* library noise (webgpu/dom lib conflicts, react-native-svg, d3-scale/d3-shape, react-navigation generics) even when nothing about the dependency graph changed. Strip the worktree's leading `../../home/…/<repo>/` prefix (or just `grep -v node_modules` out of both lists) before diffing. Two other shapes of "new" line are expected, not regressions: `Routes.tsx`'s screen-component-typing errors shifting line numbers because code was inserted above them (same 4 errors, same message, different `(line,col)`), and brand-new/extended `__tests__/*.test.ts` files producing more instances of the already-blanket-exempt jest-typing noise (TS2304/TS2593/TS2708) — expected because the file is new, not because it introduces a real type error.

To check a single file, scope the grep by **path** (`tsc --noEmit 2>&1 | grep 'HeatmapCard.tsx'`), not by bare symbol name: a bare name also matches error *messages* that mention the type (a broken `Home.tsx` reports "HeatmapCard"), and `grep heatmapMath` sweeps in `__tests__/heatmapMath.test.ts`'s jest-types noise. Before trusting a "clean" result, prove the pattern can fail — append a throwaway `const x: number = 'y'`, confirm the grep catches it, then delete that line with an Edit. Never `git checkout -- <file>` to clean it up: that reverts the file's uncommitted fixes along with the probe.

## Code style

- ESLint: `eqeqeq` off (the codebase uses `==` deliberately), `react-native/no-inline-styles` off, `max-lines` warns at 500. `prettier/prettier` is an error.
- Prettier: `singleQuote`, `bracketSpacing: false`, `bracketSameLine: true`, `arrowParens: 'avoid'`, `trailingComma: 'all'`.
- Files mix `.ts` and `.tsx`; `.tsx` is reserved for modules that actually contain JSX. Data files (`seeds/*.ts`, `quotes.ts`, `theme.ts`, `types.ts`) are plain `.ts`.
- **`src/seeds/plans/*.ts` deliberately violate prettier.** Each prescription row is one column-aligned line so the plan reads as a table. `eslint src/seeds/plans/surf.ts` reports errors on the committed code — that is expected, not new drift. Never run `--fix` / `prettier --write` on these files; match the sibling alignment instead. Verify seed changes with `jest __tests__/seeds.test.ts` (runs `validateSeed`) and `tsc --noEmit`, not with lint.

## Known stale code

`src/hooks/useFetchData.tsx` references `axios`, a `mixedCache`, and an `apiCall` from theme — none of which are wired up in this app. Treat it as dead boilerplate carried over from a template; don't model new code on it.
