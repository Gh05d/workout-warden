# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

React Native 0.85 mobile app (TypeScript) for tracking strength + surf-conditioning workouts. Android is the primary target (iOS scaffolding is present but the SQLite path in `databaseService.ts` is Android-only). All workout data lives in a local SQLite database; the app makes one external network call (random dog image on startup).

**Schema version: v2** — a clean-slate, plan-driven schema replaced the v1 hardcoded A/B/C program model in version 2.0.0. There is no in-app migration from v1; the only path forward for a v1 user is the CLI import script (see "Legacy data import" below).

## Commands

```bash
yarn start                       # Metro bundler with --reset-cache; sets USE_CONSOLE=true so console.* survives babel
yarn android                     # Run debug build on connected device/emulator
yarn ios                         # iOS run (untested path)
yarn lint                        # ESLint
yarn test                        # Jest (smoke test + seed/slugify unit tests)
yarn test -- -t "renders"        # Run a single test by name

yarn build-prod:android          # cd android && ./gradlew assembleRelease
yarn update-version:android      # Sync android/app/build.gradle versionName from package.json, bump versionCode
./version-update.sh patch|minor|major   # Full release: npm version → sync gradle → assembleRelease → commit → push

npm run import:legacy <source.db> <target.db>   # CLI import of a v1 warden-exported.db into the v2 schema
```

The `transform-remove-console` babel plugin strips `console.*` from production bundles unless `USE_CONSOLE=true` is set (the `start` script sets it; release builds do not). Keep this in mind when debugging — `console.log` you add will be gone in release.

Package manager: yarn 3.6.4 (berry) with `nodeLinker: node-modules`. `npm` also works because of the standard `node_modules` layout.

Yarn berry is wired but **broken** — `.yarnrc.yml` points at a missing `.yarn/releases/yarn-3.6.4.cjs`. Don't use `yarn <cmd>`. Use `npm run <script>` for package.json scripts, or call tools directly via `node_modules/.bin/<tool>` (jest, eslint, tsc).

### Sideloading to the Pixel 7

`adb -s 34061FDH2005AW install -r app-release.apk` reliably prints `failed: Performing Streamed Install` even on successful installs. Verify the install actually happened with `adb -s 34061FDH2005AW shell dumpsys package com.workoutwarden | grep -E "versionName|lastUpdateTime"`. The USB connection on this device drops frequently — re-issue the `dumpsys` command after a few seconds if it returns nothing.

Always bump the version *before* sideloading so `versionName` is the verification: `npm version patch --no-git-tag-version && node update-android-version.js`.

## Architecture

### Data model (v2)

Ten SQLite tables defined as `CREATE TABLE IF NOT EXISTS` statements in `src/common/databaseService.ts:SCHEMA`. Foreign keys are enforced via `PRAGMA foreign_keys = ON` on every connection.

There is no schema versioning framework. New columns are added via the idempotent pattern at the top of `seedDB` — `try { ALTER TABLE … ADD COLUMN … } catch {}` — which is a no-op on fresh installs (column already exists in CREATE TABLE DDL) and a one-shot migration on upgrades. Use this sparingly; structural changes still need import-legacy.ts.

**Template side** (immutable catalogue — populated from seeds, never edited by the user):

- `plans` — top-level program (e.g. "Surf"). `slug` is unique. The currently active plan is recorded as `settings.active_plan_id`.
- `session_templates` — a named workout (e.g. "Foundation A"). Unique by `slug`. Shared across plans by slug, but in practice each plan owns its templates.
- `plan_days` — maps a plan to its weekly schedule: `(plan_id, day_index)` is unique; `weekday_label` is an optional display string (e.g. "Mon"). `day_index` is a dense 1..N counter; the Sessions top-tab bar enumerates these.
- `exercises` — catalogue of unique movements by `slug`, with display `name` and optional YouTube `video` ID. Catalogue grows on every startup, never shrinks (upsert by slug).
- `session_template_exercises` — the prescription rows. Each row belongs to a `session_template` and references one `exercises` row. Carries `order_index` (dense 1..N within a template), optional `circuit_index` + `circuit_rounds` for circuit grouping, exactly one of `prescribed_reps` / `prescribed_seconds`, `prescribed_sets >= 1`, `per_side` / `as_maximum` flags, and an optional `hint`.

**User-data side** (created when the user adds a week):

- `weeks` — one row per training week, linked to a `plan_id`. Has `created_at` and `finished` (set to 1 automatically when all of the week's sessions are finished — see `finishSession`).
- `sessions` — one row per scheduled session within a week. Stores the resolved `session_name`, `day_index`, optional `weekday_label`, plus `trained_at` and `finished`. `ON DELETE CASCADE` from `weeks`.
- `session_exercises` — a *copy* of the template prescription at the moment the week was created. Carries the same prescription fields plus a `finished` flag. Copying decouples user history from later seed edits.
- `sets` — recorded `weight` / `reps` / `seconds` per session_exercise. `(session_exercise_id, set_index)` is unique. Rows are pre-inserted empty when the week is created (one per `prescribed_sets`), then mutated in place by `updateSet`.

**Other:**

- `settings` — key/value store. Currently used only for `active_plan_id`.

Indexes back the lookup paths used by `fetchWeeksByPlan`, the Statistics SQL, and `fetchPlanDays` (see end of `SCHEMA` block).

### Seed system

`src/seeds/` is the source of truth for exercise + plan content. Layout:

- `src/seeds/exercises.ts` — exercise catalogue (`ExerciseSeed[]`).
- `src/seeds/plans/<slug>.ts` — one file per plan (`PlanSeed`). Currently only `surf.ts`.
- `src/seeds/index.ts` — barrel that exports `EXERCISES` and `PLANS`.

On every app start, `initDB` runs the schema DDL and then `seedDB`. `seedDB`:

1. Calls `validateSeed` (see `src/common/seedValidator.ts`) — this throws synchronously on duplicate slugs, missing exercise references, gappy `order_index` values, missing or conflicting prescription fields (`prescribed_reps` XOR `prescribed_seconds`), and inconsistent `circuit_rounds` within a `circuit_index`. **Seed drift fails fast at startup, before any rows are written.**
2. Upserts all `EXERCISES` by `slug` (the catalogue can grow between releases without losing user data).
3. For each plan: inserts the plan if missing, then inserts any missing `session_templates` (templates are *immutable* once inserted — their exercises are only written on first insert), then inserts any missing `plan_days`.
4. Sets `settings.active_plan_id` to the first seeded plan if no active plan is recorded yet.

Adding a new plan means: drop a new file in `src/seeds/plans/`, add it to the `PLANS` array in `src/seeds/index.ts`, ship. Existing user data is untouched; the new plan becomes selectable.

### Navigation

`src/Routes.tsx` builds a bottom-tab navigator (Home / Weeks / Sessions / Statistics).

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

### UI conventions

- **Exercise rendering** (`src/components/Exercise.tsx`) reads the structured prescription on the row: `prescribed_reps` vs `prescribed_seconds` controls whether a reps input or a stopwatch is shown; `per_side` adds a "/side" suffix; `as_maximum` renders the prescription as "Max" rather than a fixed number.
- **Circuit grouping** is purely visual: `Session.tsx`'s `groupByCircuit` helper folds consecutive `session_exercises` that share a `circuit_index` into a single grouped block with an "× N rounds" badge. The DB stores them as a flat ordered list.
- **Quotes** come from `src/common/quotes.ts` (extracted from the deleted `variables.tsx`) — a flat list picked randomly on Home mount.
- **Theme** lives in `src/common/theme.ts`. It is the single source of truth for the `colors` palette used by `NavigationContainer` and component styles.
- **`Accordion` unmounts its children when collapsed** (`{open && <View>{children}</View>}`), not just visibility-hidden. State inside children is lost; stateful side effects (MediaPlayer instances, JS intervals) need explicit cleanup in their unmount path. System-level effects (`Vibration`) survive unmount since they're owned by the OS.
- **Statistics chart** (`src/screens/Statistics.tsx`): `victory-native`'s `CartesianChart` crashes when any value in a `yKey`'d column is `null` — it can't compute a domain from nulls. `fetchExerciseStats` returns `max_weight: null` for bodyweight exercises (reps but no weight). Filter null y-values out of `data` before passing to the chart.

### Global TypeScript types

`src/common/types.ts` is a **module** (not an ambient `.d.ts`), so consumers must `import type {Plan, Week, Session, ExerciseInstance, SetLog, ...} from '../common/types'`. The v1 ambient `src/common/global.d.ts` is gone. Two type families live in this file: seed-side (`ExerciseSeed`, `PlanSeed`, `SessionTemplateSeed`, `ExercisePrescription`, `PlanDaySeed`) and DB-side (the row shapes returned by `databaseService` functions).

### Patches

`patches/` contains `patch-package` patches applied on `postinstall`:

- `react-native-sqlite-storage+6.0.1.patch` — removes the `jcenter()` Maven repo, which is dead and breaks Android builds.
- `@react-native-async-storage+async-storage+3.0.2.patch` — registers `mavenLocal()` / `local_repo` so async-storage 3.x resolves on AGP setups that don't expose the React Native Maven repo to library modules.

Both patches must travel with the repo; CI / fresh clones will fail to assemble Android without them.

### Native modules

- **`TimerSound`** (`android/app/src/main/java/com/workoutwarden/TimerSoundModule.kt`) — minimal MediaPlayer bridge playing `res/raw/timer_done.mp3` on the `USAGE_ALARM` stream. JS wrapper at `src/common/timerSound.ts` exposes `TimerSound.play()` / `.stop()`. `play()` is idempotent: a second call while already playing is a no-op (guards against React 19 strict-mode double-invocation when called from inside a state updater). iOS = no-op fallback. Swap the alarm sound by replacing the mp3 file in-place — filename must stay `timer_done.mp3` (Android raw-resource names are lowercase + underscores only).
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

## TypeScript errors

Treat TS errors on imports from third-party libraries as **real contracts**, not pre-existing noise. TS1192 "no default export" on `@dr.pogodin/react-native-fs` was a real runtime bug (`undefined.copyFile`), not a config quirk. Check the library's actual export shape before dismissing as noise.

## Code style

- ESLint: `eqeqeq` off (the codebase uses `==` deliberately), `react-native/no-inline-styles` off, `max-lines` warns at 500. `prettier/prettier` is an error.
- Prettier: `singleQuote`, `bracketSpacing: false`, `bracketSameLine: true`, `arrowParens: 'avoid'`, `trailingComma: 'all'`.
- Files mix `.ts` and `.tsx`; `.tsx` is reserved for modules that actually contain JSX. Data files (`seeds/*.ts`, `quotes.ts`, `theme.ts`, `types.ts`) are plain `.ts`.

## Known stale code

`src/hooks/useFetchData.tsx` references `axios`, a `mixedCache`, and an `apiCall` from theme — none of which are wired up in this app. Treat it as dead boilerplate carried over from a template; don't model new code on it.
