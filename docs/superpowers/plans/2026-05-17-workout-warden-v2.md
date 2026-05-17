# Workout Warden v2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `CHECK IN ('A','B','C')` enum schema with a data-driven plans-and-templates model so arbitrary training plans (starting with a new 5-day "Surf" plan) can be added by editing a TS seed file, not by writing a SQL migration.

**Architecture:** New normalized schema separates plan _templates_ (`plans`, `session_templates`, `session_template_exercises`, `plan_days`) from workout _instances_ (`weeks`, `sessions`, `session_exercises`, `sets`). Templates are seeded idempotently from TS constants in `src/seeds/` on every app start. Reads collapse the v1 N+1 cascade into 1-2 JOIN queries. `react-native-vector-icons/material-icons`, Skia 2, Reanimated 4, and the rest of the v0.85 RN ecosystem upgrade are already in place from a prior session — this plan only does the schema rework.

**Tech Stack:** React Native 0.85, SQLite via `react-native-sqlite-storage` (app) + `better-sqlite3` (CLI script), TypeScript 6, Jest 29.

**Spec:** `docs/superpowers/specs/2026-05-17-workout-warden-v2-design.md`

**Pre-flight note:** The working tree currently has uncommitted dep-upgrade changes from a prior session. These should be committed first (or stashed) so v2 work lands on a clean base. The plan assumes those changes are committed before Task 1.

---

## File Structure

**New files:**
- `src/common/types.ts` — ambient + exported interfaces (Plan, SessionTemplate, ExercisePrescription, Week, Session, ExerciseInstance, SetLog, etc.)
- `src/common/quotes.ts` — demotivational quotes array, moved out of `variables.tsx`
- `src/common/slugify.ts` — small helper, kebab-case from human name
- `src/common/seedValidator.ts` — pure validator functions (no DB), unit-testable
- `src/seeds/index.ts` — barrel exporting `EXERCISES` + `PLANS`
- `src/seeds/exercises.ts` — catalogue
- `src/seeds/plans/surf.ts` — the new 5-day "Surf" plan
- `scripts/import-legacy.ts` — one-shot CLI to port `warden-exported.db`

**Rewritten files:**
- `src/common/databaseService.ts` — new schema, new CRUD, new joined reads
- `src/Routes.tsx` — dynamic Sessions tabs based on active plan
- `src/screens/Weeks.tsx` — multi-plan top tabs
- `src/screens/Session.tsx` — uses new query shape, sets `trained_at` on finish
- `src/screens/Statistics.tsx` — single SQL query, correct per-side aggregation
- `src/screens/Home.tsx` — drops `TRAINING_TYPE` AsyncStorage coupling
- `src/components/Exercise.tsx` — accepts new `ExerciseInstance` shape (no API rename needed inside Exercise tab, just data shape)
- `src/components/WeekAccordion.tsx` — accepts new `Week` shape
- `src/App.tsx` — drops AsyncStorage read for `TRAINING_TYPE`
- `__tests__/App.test.tsx` — keeps the pure-function unit tests, adds seed-validator tests

**Deleted files:**
- `src/common/variables.tsx`
- `src/common/migrations.ts`
- `src/common/global.d.ts` (contents move to `src/common/types.ts`)

---

## Task 1: Commit pending dep-upgrade work to give v2 a clean base

**Files:** none — git only.

- [ ] **Step 1: Verify pending changes are the dep-upgrade set**

Run: `git status --porcelain`
Expected: ~20 modified files (android/, src/, babel.config.js, package.json, etc.) plus untracked `eslint.config.js`, `jest.setup.js` (if present), `patches/`, `docs/`.

- [ ] **Step 2: Stage and commit**

Run:
```bash
git add android/ babel.config.js package.json package-lock.json src/App.tsx src/Routes.tsx \
        src/common/databaseService.ts src/common/variables.tsx src/components/ src/hooks/ \
        src/screens/ __tests__/App.test.tsx eslint.config.js patches/ jest.config.js \
        __tests__ docs/
git rm .eslintrc.js
git status --porcelain
```
Verify nothing important untracked remains (check `git status` output is empty or only `node_modules/.package-lock.json`, `android/app/build/`, etc.).

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
Upgrade React Native ecosystem to 0.85.3 and ship working Android build

- RN 0.76 → 0.85.3, React 19.2.3, Reanimated 4.3.1 + worklets 0.8.3, Skia 2.6.2
- Replace 3 abandoned libs with active forks (fs, document-picker, keep-awake)
- Replace react-native-vector-icons with @react-native-vector-icons/material-icons
- Migrate .eslintrc.js → eslint.config.js (Flat Config + FlatCompat bridge)
- patch-package patches for react-native-sqlite-storage (jcenter) and
  @react-native-async-storage/async-storage (local_repo registration)
- Native: Kotlin 2.1, NDK 27, Gradle 9.3.1, AGP 36, MainApplication.kt
  rewritten for RN 0.85 (loadReactNative())
EOF
)"
```

- [ ] **Step 4: Verify clean tree**

Run: `git status`
Expected: `nothing to commit, working tree clean` (or only `node_modules/` artifacts).

---

## Task 2: Create the shared types module

**Files:**
- Create: `src/common/types.ts`

- [ ] **Step 1: Write the file**

```ts
// src/common/types.ts
// Shared types for v2.0 plan-driven schema. Ambient declarations (no `export`)
// keep the legacy zero-import ergonomics from the old global.d.ts; explicit
// re-exports at the bottom let modules that prefer explicit imports use them.

// ===== Seed-side types (TS constants in src/seeds/) =====

interface ExerciseSeed {
  slug: string;
  name: string;
  video?: string;
}

interface ExercisePrescription {
  exercise_slug: string;
  order_index: number;
  prescribed_sets: number;
  prescribed_reps?: number;
  prescribed_seconds?: number;
  per_side?: boolean;
  as_maximum?: boolean;
  circuit_index?: number;
  circuit_rounds?: number;
  hint?: string;
}

interface SessionTemplateSeed {
  slug: string;
  name: string;
  exercises: ExercisePrescription[];
}

interface PlanDaySeed {
  day_index: number;
  weekday_label?: string;
  session_template_slug: string;
}

interface PlanSeed {
  slug: string;
  name: string;
  description?: string;
  session_templates: SessionTemplateSeed[];
  days: PlanDaySeed[];
}

// ===== DB-side types (rows as returned by databaseService) =====

interface Plan {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

interface PlanDay {
  id: number;
  plan_id: number;
  session_template_id: number;
  day_index: number;
  weekday_label: string | null;
  session_template_name: string;
}

interface SetLog {
  id: number;
  session_exercise_id: number;
  set_index: number;
  weight: number | null;
  reps: number | null;
  seconds: number | null;
}

interface ExerciseInstance {
  id: number;
  session_id: number;
  exercise_id: number;
  exercise_slug: string;
  exercise_name: string;
  video: string | null;
  order_index: number;
  circuit_index: number | null;
  circuit_rounds: number | null;
  prescribed_reps: number | null;
  prescribed_seconds: number | null;
  prescribed_sets: number;
  per_side: 0 | 1;
  as_maximum: 0 | 1;
  hint: string | null;
  finished: 0 | 1;
  sets: SetLog[];
}

interface Session {
  id: number;
  week_id: number;
  day_index: number;
  weekday_label: string | null;
  session_name: string;
  trained_at: string | null;
  finished: 0 | 1;
  notes: string | null;
  exercises: ExerciseInstance[];
}

interface Week {
  id: number;
  plan_id: number;
  created_at: string;
  finished: 0 | 1;
  sessions: Session[];
}

// ===== Navigation (unchanged from v1) =====

interface Navigation {
  navigate: (path: string, config?: object, merge?: boolean) => void;
  reset: () => void;
  goBack: () => void;
  setParams: (params: {[prop: string]: unknown}) => void;
  dispatch: () => void;
  setOptions: (opts: {title: string}) => void;
  isFocused: () => boolean;
  addListener: (event: string, callback: Function) => void;
  canGoBack: () => boolean;
  jumpTo: () => void;
  push: (path: string, config?: object) => void;
  replace: (path: string, config?: object) => void;
  getParent: () => Navigation;
}

interface Route {
  key: string;
  name: string;
  path?: string;
  params?: {[prop: string]: unknown};
}

interface BaseProps {
  navigation: Navigation;
  route: Route;
}

// Re-export so `import {Plan} from '../common/types'` also works.
export type {
  ExerciseSeed,
  ExercisePrescription,
  SessionTemplateSeed,
  PlanDaySeed,
  PlanSeed,
  Plan,
  PlanDay,
  SetLog,
  ExerciseInstance,
  Session,
  Week,
  Navigation,
  Route,
  BaseProps,
};
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`
Expected: PASS — no errors. (`global.d.ts` still in place, so types are temporarily duplicated; that's OK and will be resolved in Task 3.)

- [ ] **Step 3: Commit**

```bash
git add src/common/types.ts
git commit -m "Add src/common/types.ts with v2 plan-schema interfaces"
```

---

## Task 3: Remove old global.d.ts (replaced by types.ts)

**Files:**
- Delete: `src/common/global.d.ts`

- [ ] **Step 1: Delete the file**

Run: `git rm src/common/global.d.ts`

- [ ] **Step 2: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`
Expected: Errors will appear in files that referenced the OLD `Exercise`, `TrainingDay`, `Week`, `TrainingType`, `Set`, etc. shapes. The new `types.ts` shapes are slightly different (e.g. `Week.sessions` instead of `Week.sessions: TrainingDay[]`). Note them — they'll all be fixed in later tasks as those files get rewritten. For now, leave them.

If errors include "Cannot find name 'X'" for things like `TrainingType`, `ImportData`, `TrainingDay`, `TrainingDayExercise`, `WorkoutProgram` — those are removed from the new types and the consuming code will be deleted/rewritten. Do NOT add backwards-compat type aliases.

- [ ] **Step 3: Commit**

```bash
git add -A src/common/global.d.ts
git commit -m "Remove src/common/global.d.ts (superseded by types.ts)"
```

---

## Task 4: Add slugify helper

**Files:**
- Create: `src/common/slugify.ts`
- Test: `__tests__/slugify.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/slugify.test.ts
import {slugify} from '../src/common/slugify';

describe('slugify', () => {
  it('lowercases and dashes', () => {
    expect(slugify('Reverse Step Up')).toBe('reverse-step-up');
  });

  it('collapses multiple spaces', () => {
    expect(slugify('Big   Toe Stretch')).toBe('big-toe-stretch');
  });

  it('strips non-alphanumeric chars', () => {
    expect(slugify('Wall-Pullover (Band)')).toBe('wall-pullover-band');
  });

  it('handles leading/trailing whitespace', () => {
    expect(slugify('  L-Sit Progression  ')).toBe('l-sit-progression');
  });

  it('treats empty input as empty output', () => {
    expect(slugify('')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- -t slugify`
Expected: FAIL — `Cannot find module '../src/common/slugify'`.

- [ ] **Step 3: Implement**

```ts
// src/common/slugify.ts
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- -t slugify`
Expected: PASS — 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/common/slugify.ts __tests__/slugify.test.ts
git commit -m "Add slugify helper with tests"
```

---

## Task 5: Add seed validator

**Files:**
- Create: `src/common/seedValidator.ts`
- Test: `__tests__/seedValidator.test.ts`

The validator runs over a `{exercises: ExerciseSeed[], plans: PlanSeed[]}` bundle and throws on inconsistencies before any DB write. Catches drift between TS seed files at startup.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/seedValidator.test.ts
import {validateSeed} from '../src/common/seedValidator';

const validExercise = {slug: 'vmo-squat', name: 'VMO Squat'};
const validPrescription = {
  exercise_slug: 'vmo-squat',
  order_index: 1,
  prescribed_sets: 1,
  prescribed_reps: 20,
};

function bundle(overrides: any = {}) {
  return {
    exercises: [validExercise],
    plans: [
      {
        slug: 'p1',
        name: 'Plan 1',
        session_templates: [
          {slug: 't1', name: 'T1', exercises: [validPrescription]},
        ],
        days: [
          {day_index: 1, session_template_slug: 't1'},
        ],
      },
    ],
    ...overrides,
  };
}

describe('validateSeed', () => {
  it('accepts a valid bundle', () => {
    expect(() => validateSeed(bundle())).not.toThrow();
  });

  it('rejects unknown exercise_slug', () => {
    const b = bundle();
    b.plans[0].session_templates[0].exercises[0].exercise_slug = 'unknown';
    expect(() => validateSeed(b)).toThrow(/exercise_slug 'unknown' not in catalogue/);
  });

  it('rejects prescription without reps or seconds', () => {
    const b = bundle();
    delete b.plans[0].session_templates[0].exercises[0].prescribed_reps;
    expect(() => validateSeed(b)).toThrow(/must set prescribed_reps OR prescribed_seconds/);
  });

  it('rejects prescription with both reps and seconds', () => {
    const b = bundle();
    b.plans[0].session_templates[0].exercises[0].prescribed_seconds = 30;
    expect(() => validateSeed(b)).toThrow(/cannot set both prescribed_reps and prescribed_seconds/);
  });

  it('rejects mismatched circuit_rounds within same circuit', () => {
    const b = bundle();
    b.plans[0].session_templates[0].exercises = [
      {...validPrescription, order_index: 1, circuit_index: 1, circuit_rounds: 2},
      {...validPrescription, order_index: 2, circuit_index: 1, circuit_rounds: 3},
    ];
    expect(() => validateSeed(b)).toThrow(/circuit_index 1.*inconsistent circuit_rounds/);
  });

  it('rejects non-dense order_index', () => {
    const b = bundle();
    b.plans[0].session_templates[0].exercises = [
      {...validPrescription, order_index: 1},
      {...validPrescription, order_index: 3},
    ];
    expect(() => validateSeed(b)).toThrow(/order_index must be dense 1..N/);
  });

  it('rejects unknown session_template_slug in plan_days', () => {
    const b = bundle();
    b.plans[0].days[0].session_template_slug = 'unknown';
    expect(() => validateSeed(b)).toThrow(/session_template_slug 'unknown' not defined/);
  });

  it('rejects duplicate exercise slugs', () => {
    const b = bundle();
    b.exercises.push(validExercise);
    expect(() => validateSeed(b)).toThrow(/duplicate exercise slug 'vmo-squat'/);
  });

  it('rejects duplicate plan slugs', () => {
    const b = bundle();
    b.plans.push({...b.plans[0]});
    expect(() => validateSeed(b)).toThrow(/duplicate plan slug 'p1'/);
  });

  it('rejects circuit_index without circuit_rounds', () => {
    const b = bundle();
    b.plans[0].session_templates[0].exercises[0].circuit_index = 1;
    expect(() => validateSeed(b)).toThrow(/circuit_index requires circuit_rounds/);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- -t validateSeed`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement validator**

```ts
// src/common/seedValidator.ts
import type {ExerciseSeed, PlanSeed, ExercisePrescription} from './types';

export interface SeedBundle {
  exercises: ExerciseSeed[];
  plans: PlanSeed[];
}

export function validateSeed(bundle: SeedBundle): void {
  const slugs = new Set<string>();
  for (const ex of bundle.exercises) {
    if (slugs.has(ex.slug)) {
      throw new Error(`duplicate exercise slug '${ex.slug}'`);
    }
    slugs.add(ex.slug);
  }

  const planSlugs = new Set<string>();
  for (const plan of bundle.plans) {
    if (planSlugs.has(plan.slug)) {
      throw new Error(`duplicate plan slug '${plan.slug}'`);
    }
    planSlugs.add(plan.slug);

    const templateSlugs = new Set(plan.session_templates.map(t => t.slug));

    for (const day of plan.days) {
      if (!templateSlugs.has(day.session_template_slug)) {
        throw new Error(
          `plan '${plan.slug}' day_index ${day.day_index}: session_template_slug '${day.session_template_slug}' not defined in plan`,
        );
      }
    }

    for (const tpl of plan.session_templates) {
      validateTemplate(plan.slug, tpl.slug, tpl.exercises, slugs);
    }
  }
}

function validateTemplate(
  planSlug: string,
  templateSlug: string,
  exercises: ExercisePrescription[],
  catalogue: Set<string>,
): void {
  const sortedByOrder = [...exercises].sort((a, b) => a.order_index - b.order_index);
  sortedByOrder.forEach((ex, i) => {
    const expected = i + 1;
    if (ex.order_index !== expected) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}': order_index must be dense 1..N (got ${ex.order_index} at position ${expected})`,
      );
    }
  });

  for (const ex of exercises) {
    if (!catalogue.has(ex.exercise_slug)) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}': exercise_slug '${ex.exercise_slug}' not in catalogue`,
      );
    }

    const hasReps = ex.prescribed_reps !== undefined;
    const hasSecs = ex.prescribed_seconds !== undefined;
    if (!hasReps && !hasSecs) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}' order ${ex.order_index}: must set prescribed_reps OR prescribed_seconds`,
      );
    }
    if (hasReps && hasSecs) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}' order ${ex.order_index}: cannot set both prescribed_reps and prescribed_seconds`,
      );
    }

    if (ex.circuit_index !== undefined && ex.circuit_rounds === undefined) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}' order ${ex.order_index}: circuit_index requires circuit_rounds`,
      );
    }
  }

  const circuits = new Map<number, number>();
  for (const ex of exercises) {
    if (ex.circuit_index === undefined) continue;
    const existing = circuits.get(ex.circuit_index);
    if (existing !== undefined && existing !== ex.circuit_rounds) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}': circuit_index ${ex.circuit_index} has inconsistent circuit_rounds (${existing} vs ${ex.circuit_rounds})`,
      );
    }
    circuits.set(ex.circuit_index, ex.circuit_rounds!);
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- -t validateSeed`
Expected: PASS — 10/10.

- [ ] **Step 5: Commit**

```bash
git add src/common/seedValidator.ts __tests__/seedValidator.test.ts
git commit -m "Add seedValidator with 10 test cases"
```

---

## Task 6: Extract demotivational quotes

**Files:**
- Create: `src/common/quotes.ts`

- [ ] **Step 1: Copy quotes from variables.tsx into a dedicated module**

Read `src/common/variables.tsx` lines containing `demotivationalQuotes` definition (~lines 10-81 in v1). Create:

```ts
// src/common/quotes.ts
export const DEMOTIVATIONAL_QUOTES: readonly string[] = [
  // ... paste all ~70 quotes from variables.tsx unchanged ...
];
```

Concrete action: open `src/common/variables.tsx`, locate `export const demotivationalQuotes = [...];` block, copy the array literal verbatim into `src/common/quotes.ts` under the new name `DEMOTIVATIONAL_QUOTES`.

- [ ] **Step 2: Verify import works in a quick smoke**

Run: `node -e "const {DEMOTIVATIONAL_QUOTES} = require('./src/common/quotes.ts'); console.log(DEMOTIVATIONAL_QUOTES.length)"` — won't work directly (TS file). Skip — instead:

Run: `npx tsc --noEmit src/common/quotes.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/common/quotes.ts
git commit -m "Extract demotivational quotes to dedicated module"
```

---

## Task 7: Create exercise catalogue seed

**Files:**
- Create: `src/seeds/exercises.ts`

**Reference:** Use the user's screenshots (saved under `~/Downloads/WhatsApp Image 2026-05-17 at 12.44.*`) plus the surviving exercise rows in `~/Downloads/warden-exported.db` for video IDs. The catalogue covers every exercise that ANY plan references — in v2.0 that's only the Surf plan, but include all exercises visible in screenshots even if not used yet to avoid round-tripping later.

- [ ] **Step 1: Enumerate exercises from screenshots and write the file**

```ts
// src/seeds/exercises.ts
import type {ExerciseSeed} from '../common/types';

export const EXERCISES: ExerciseSeed[] = [
  // Lower body
  {slug: 'backward-walking',         name: 'Backward Walking'},
  {slug: 'tibialis-raise',           name: 'Tibialis Raise'},
  {slug: 'straight-leg-calf-raise',  name: 'Straight Leg Calf Raise'},
  {slug: 'bent-leg-calf-raise',      name: 'Bent Leg Calf Raise'},
  {slug: 'reverse-step-up',          name: 'Reverse Step Up'},
  {slug: 'atg-split-squat',          name: 'ATG Split Squat'},
  {slug: 'vmo-squat',                name: 'VMO Squat'},
  {slug: 'nordic',                   name: 'Nordic'},

  // Stretches / mobility
  {slug: 'big-toe-stretch',          name: 'Big Toe Stretch'},
  {slug: 'l-sit-progression',        name: 'L-Sit Progression'},
  {slug: 'couch-stretch',            name: 'Couch Stretch'},
  {slug: 'elephant-walk',            name: 'Elephant Walk'},
  {slug: 'pigeon-pushup',            name: 'Pigeon Pushup'},
  {slug: 'resting-squat',            name: 'Resting Squat'},
  {slug: 'calf-stretch-slantboard',  name: 'Calf Stretch on Slantboard'},
  {slug: 'standing-pancake-pulse',   name: 'Standing Pancake Pulse'},

  // Upper body
  {slug: 'band-pull-apart',          name: 'Band Pull-Apart'},
  {slug: 'atg-pushup',               name: 'ATG Pushup'},
  {slug: 'atg-row',                  name: 'ATG Row'},
  {slug: 'band-overhead-press',      name: 'Band Overhead Press'},
  {slug: 'superman',                 name: 'Superman'},
  {slug: 'seated-goodmorning',       name: 'Seated Goodmorning'},
  {slug: 'ql-extension',             name: 'QL Extension'},
  {slug: 'wall-pullover',            name: 'Wall Pullover'},
];
```

Video IDs are left undefined for now — the user can fill them in later, or run a one-off update from the legacy DB during the import script (Task 24).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit src/seeds/exercises.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/seeds/exercises.ts
git commit -m "Seed: exercise catalogue (24 entries for Surf plan)"
```

---

## Task 8: Create Surf plan seed

**Files:**
- Create: `src/seeds/plans/surf.ts`

Reference data: the eight screenshots show all four templates explicitly. Mon=Fri, Wed differs only at order_index 7 (Nordic instead of VMO Squat), Tue and Thu have the same exercises in slightly different order.

- [ ] **Step 1: Write the file**

```ts
// src/seeds/plans/surf.ts
import type {PlanSeed, SessionTemplateSeed} from '../../common/types';

const lowerBase = (slug: string, swapVmoForNordic: boolean): SessionTemplateSeed => ({
  slug,
  name: swapVmoForNordic ? 'Lower Body (Nordic)' : 'Lower Body',
  exercises: [
    {exercise_slug: 'backward-walking',        order_index: 1,  prescribed_sets: 1, prescribed_seconds: 600, hint: 'Walk backwards for 10 Mins'},

    // Calf triplet, 2 rounds
    {exercise_slug: 'tibialis-raise',          order_index: 2,  prescribed_sets: 1, prescribed_reps: 25, as_maximum: true, circuit_index: 1, circuit_rounds: 2},
    {exercise_slug: 'straight-leg-calf-raise', order_index: 3,  prescribed_sets: 1, prescribed_reps: 20,                    circuit_index: 1, circuit_rounds: 2},
    {exercise_slug: 'bent-leg-calf-raise',     order_index: 4,  prescribed_sets: 1, prescribed_reps: 20,                    circuit_index: 1, circuit_rounds: 2},

    // Split squat pair, 5 rounds
    {exercise_slug: 'reverse-step-up',         order_index: 5,  prescribed_sets: 1, prescribed_reps: 5, per_side: true, circuit_index: 2, circuit_rounds: 5},
    {exercise_slug: 'atg-split-squat',         order_index: 6,  prescribed_sets: 1, prescribed_reps: 5, per_side: true, circuit_index: 2, circuit_rounds: 5},

    // The swap
    swapVmoForNordic
      ? {exercise_slug: 'nordic',    order_index: 7, prescribed_sets: 2, prescribed_reps: 5}
      : {exercise_slug: 'vmo-squat', order_index: 7, prescribed_sets: 2, prescribed_reps: 20, as_maximum: true},

    // Stretch circuit, 2 rounds
    {exercise_slug: 'big-toe-stretch',         order_index: 8,  prescribed_sets: 1, prescribed_seconds: 30,                  circuit_index: 3, circuit_rounds: 2},
    {exercise_slug: 'l-sit-progression',       order_index: 9,  prescribed_sets: 1, prescribed_seconds: 20,                  circuit_index: 3, circuit_rounds: 2},
    {exercise_slug: 'couch-stretch',           order_index: 10, prescribed_sets: 1, prescribed_seconds: 60, per_side: true,  circuit_index: 3, circuit_rounds: 2, hint: '1 Min Per Side'},
    {exercise_slug: 'elephant-walk',           order_index: 11, prescribed_sets: 1, prescribed_reps: 20, per_side: true,     circuit_index: 3, circuit_rounds: 2},
    {exercise_slug: 'pigeon-pushup',           order_index: 12, prescribed_sets: 1, prescribed_reps: 20, per_side: true,     circuit_index: 3, circuit_rounds: 2},
    {exercise_slug: 'resting-squat',           order_index: 13, prescribed_sets: 1, prescribed_seconds: 30,                  circuit_index: 3, circuit_rounds: 2},
  ],
});

const upperBase = (slug: string, swapAtgPair: boolean): SessionTemplateSeed => {
  const atgPushup = {exercise_slug: 'atg-pushup', order_index: 0, prescribed_sets: 1, prescribed_reps: 20, as_maximum: true, circuit_index: 1, circuit_rounds: 2};
  const atgRow    = {exercise_slug: 'atg-row',    order_index: 0, prescribed_sets: 1, prescribed_reps: 20, as_maximum: true, circuit_index: 1, circuit_rounds: 2};
  const first  = swapAtgPair ? atgRow    : atgPushup;
  const second = swapAtgPair ? atgPushup : atgRow;
  return {
    slug,
    name: 'Upper Body + Stretching',
    exercises: [
      {exercise_slug: 'backward-walking',        order_index: 1,  prescribed_sets: 1, prescribed_seconds: 600, hint: 'Walk backwards for 10 Mins'},
      {exercise_slug: 'band-pull-apart',         order_index: 2,  prescribed_sets: 1, prescribed_reps: 20},

      // ATG pair, 2 rounds (order differs between Tue and Thu — that's the "leichte" Variante)
      {...first,  order_index: 3},
      {...second, order_index: 4},

      // Trunk circuit, 2 rounds
      {exercise_slug: 'band-overhead-press',     order_index: 5,  prescribed_sets: 1, prescribed_reps: 10,                    circuit_index: 2, circuit_rounds: 2},
      {exercise_slug: 'superman',                order_index: 6,  prescribed_sets: 1, prescribed_reps: 20,                    circuit_index: 2, circuit_rounds: 2},
      {exercise_slug: 'seated-goodmorning',      order_index: 7,  prescribed_sets: 1, prescribed_reps: 20,                    circuit_index: 2, circuit_rounds: 2},
      {exercise_slug: 'ql-extension',            order_index: 8,  prescribed_sets: 1, prescribed_reps: 15, per_side: true,    circuit_index: 2, circuit_rounds: 2},
      {exercise_slug: 'wall-pullover',           order_index: 9,  prescribed_sets: 1, prescribed_reps: 15,                    circuit_index: 2, circuit_rounds: 2},

      // Calf + stretch finisher, 2 rounds
      {exercise_slug: 'calf-stretch-slantboard', order_index: 10, prescribed_sets: 1, prescribed_seconds: 60, per_side: true, circuit_index: 3, circuit_rounds: 2, hint: '1 Min Per Side on Slantboard'},
      {exercise_slug: 'standing-pancake-pulse',  order_index: 11, prescribed_sets: 1, prescribed_reps: 20,                    circuit_index: 3, circuit_rounds: 2},
      {exercise_slug: 'couch-stretch',           order_index: 12, prescribed_sets: 1, prescribed_seconds: 60, per_side: true, circuit_index: 3, circuit_rounds: 2, hint: '1 Min Per Side'},
    ],
  };
};

export const SURF: PlanSeed = {
  slug: 'surf',
  name: 'Surf',
  description: '5-day strength + mobility companion for surfing',
  session_templates: [
    lowerBase('surf-lower-mon-fri', false),
    lowerBase('surf-lower-wed',     true),
    upperBase('surf-upper-tue',     false),
    upperBase('surf-upper-thu',     true),
  ],
  days: [
    {day_index: 1, weekday_label: 'Mon', session_template_slug: 'surf-lower-mon-fri'},
    {day_index: 2, weekday_label: 'Tue', session_template_slug: 'surf-upper-tue'},
    {day_index: 3, weekday_label: 'Wed', session_template_slug: 'surf-lower-wed'},
    {day_index: 4, weekday_label: 'Thu', session_template_slug: 'surf-upper-thu'},
    {day_index: 5, weekday_label: 'Fri', session_template_slug: 'surf-lower-mon-fri'},
  ],
};
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit src/seeds/plans/surf.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/seeds/plans/surf.ts
git commit -m "Seed: Surf 5-day plan (Mon=Fri Lower, Wed Nordic variant, Tue/Thu Upper)"
```

---

## Task 9: Seeds barrel + validation against real data

**Files:**
- Create: `src/seeds/index.ts`
- Test: `__tests__/seeds.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/seeds.test.ts
import {validateSeed} from '../src/common/seedValidator';
import {EXERCISES, PLANS} from '../src/seeds';

describe('seed bundle', () => {
  it('validates without errors', () => {
    expect(() => validateSeed({exercises: [...EXERCISES], plans: [...PLANS]})).not.toThrow();
  });

  it('includes the Surf plan', () => {
    expect(PLANS.find(p => p.slug === 'surf')).toBeDefined();
  });

  it('Surf plan has 5 days', () => {
    const surf = PLANS.find(p => p.slug === 'surf');
    expect(surf!.days).toHaveLength(5);
  });

  it('Surf Mon and Fri reference the same template', () => {
    const surf = PLANS.find(p => p.slug === 'surf');
    const mon = surf!.days.find(d => d.weekday_label === 'Mon');
    const fri = surf!.days.find(d => d.weekday_label === 'Fri');
    expect(mon!.session_template_slug).toBe(fri!.session_template_slug);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test -- -t 'seed bundle'`
Expected: FAIL — `Cannot find module '../src/seeds'`.

- [ ] **Step 3: Write the barrel**

```ts
// src/seeds/index.ts
import type {ExerciseSeed, PlanSeed} from '../common/types';
import {EXERCISES as EXERCISES_LIST} from './exercises';
import {SURF} from './plans/surf';

export const EXERCISES: readonly ExerciseSeed[] = EXERCISES_LIST;
export const PLANS: readonly PlanSeed[] = [SURF];
```

- [ ] **Step 4: Run tests**

Run: `npm test -- -t 'seed bundle'`
Expected: PASS — 4/4. If validation fails, fix the seed files (probably a typo in an `exercise_slug` that doesn't exist in `EXERCISES`).

- [ ] **Step 5: Commit**

```bash
git add src/seeds/index.ts __tests__/seeds.test.ts
git commit -m "Seed: barrel + integration test against validator"
```

---

## Task 10: Schema DDL + initDB rewrite

**Files:**
- Modify: `src/common/databaseService.ts` (full rewrite of `initDB`)

This task ONLY does the schema creation. Old CRUD functions stay temporarily (broken — they reference dropped tables); subsequent tasks rewrite them. App will not run during this gap; tests are the gate.

- [ ] **Step 1: Replace the entire databaseService.ts**

```ts
// src/common/databaseService.ts
import {SQLiteDatabase, openDatabase} from 'react-native-sqlite-storage';
import RNFS from '@dr.pogodin/react-native-fs';
import {Alert} from 'react-native';

const DB_NAME = 'warden.db';
const DB_PATH_ANDROID = '/data/data/com.workoutwarden/databases/warden.db';

export async function getDBConnection(): Promise<SQLiteDatabase> {
  const db = await openDatabase({name: DB_NAME, location: 'default'});
  await db.executeSql('PRAGMA foreign_keys = ON;');
  return db;
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS plans (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     slug        TEXT NOT NULL UNIQUE,
     name        TEXT NOT NULL,
     description TEXT,
     created_at  DATETIME DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS session_templates (
     id   INTEGER PRIMARY KEY AUTOINCREMENT,
     slug TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS plan_days (
     id                  INTEGER PRIMARY KEY AUTOINCREMENT,
     plan_id             INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
     session_template_id INTEGER NOT NULL REFERENCES session_templates(id),
     day_index           INTEGER NOT NULL,
     weekday_label       TEXT,
     UNIQUE(plan_id, day_index)
   )`,
  `CREATE TABLE IF NOT EXISTS exercises (
     id    INTEGER PRIMARY KEY AUTOINCREMENT,
     slug  TEXT NOT NULL UNIQUE,
     name  TEXT NOT NULL,
     video TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS session_template_exercises (
     id                  INTEGER PRIMARY KEY AUTOINCREMENT,
     session_template_id INTEGER NOT NULL REFERENCES session_templates(id) ON DELETE CASCADE,
     exercise_id         INTEGER NOT NULL REFERENCES exercises(id),
     order_index         INTEGER NOT NULL,
     circuit_index       INTEGER,
     circuit_rounds      INTEGER,
     prescribed_reps     INTEGER,
     prescribed_seconds  INTEGER,
     prescribed_sets     INTEGER NOT NULL DEFAULT 1 CHECK(prescribed_sets >= 1),
     per_side            BOOLEAN NOT NULL DEFAULT 0,
     as_maximum          BOOLEAN NOT NULL DEFAULT 0,
     hint                TEXT,
     UNIQUE(session_template_id, order_index)
   )`,
  `CREATE TABLE IF NOT EXISTS weeks (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     plan_id    INTEGER NOT NULL REFERENCES plans(id),
     created_at DATETIME DEFAULT (datetime('now')),
     finished   BOOLEAN NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     week_id       INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
     day_index     INTEGER NOT NULL,
     weekday_label TEXT,
     session_name  TEXT NOT NULL,
     trained_at    DATETIME,
     finished      BOOLEAN NOT NULL DEFAULT 0,
     notes         TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS session_exercises (
     id                 INTEGER PRIMARY KEY AUTOINCREMENT,
     session_id         INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
     exercise_id        INTEGER NOT NULL REFERENCES exercises(id),
     order_index        INTEGER NOT NULL,
     circuit_index      INTEGER,
     circuit_rounds     INTEGER,
     prescribed_reps    INTEGER,
     prescribed_seconds INTEGER,
     prescribed_sets    INTEGER NOT NULL DEFAULT 1 CHECK(prescribed_sets >= 1),
     per_side           BOOLEAN NOT NULL DEFAULT 0,
     as_maximum         BOOLEAN NOT NULL DEFAULT 0,
     hint               TEXT,
     finished           BOOLEAN NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS sets (
     id                  INTEGER PRIMARY KEY AUTOINCREMENT,
     session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
     set_index           INTEGER NOT NULL,
     weight              REAL,
     reps                INTEGER,
     seconds             INTEGER,
     UNIQUE(session_exercise_id, set_index)
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_plan_days_plan      ON plan_days(plan_id, day_index)`,
  `CREATE INDEX IF NOT EXISTS idx_ste_template        ON session_template_exercises(session_template_id, order_index)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_week       ON sessions(week_id, day_index)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_trained    ON sessions(trained_at)`,
  `CREATE INDEX IF NOT EXISTS idx_se_session          ON session_exercises(session_id, order_index)`,
  `CREATE INDEX IF NOT EXISTS idx_se_exercise         ON session_exercises(exercise_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sets_se             ON sets(session_exercise_id, set_index)`,
];

export async function initDB(): Promise<void> {
  const db = await getDBConnection();
  for (const stmt of SCHEMA) {
    await db.executeSql(stmt);
  }
  // seedDB is implemented in Task 11
}

// Stub exports kept temporarily so consuming files keep type-checking.
// Each is replaced by a real implementation in tasks 12-15.
export async function exportDatabase(): Promise<void> {
  const exportPath = `${RNFS.DownloadDirectoryPath}/warden-exported.db`;
  try {
    await RNFS.copyFile(DB_PATH_ANDROID, exportPath);
    Alert.alert('Success', `Database exported to ${exportPath}`);
  } catch (error) {
    Alert.alert('Export failed', (error as Error)?.message);
  }
}

export async function importDatabase(importPath: string): Promise<void> {
  try {
    const db = await getDBConnection();
    await db.close();
    await RNFS.copyFile(importPath, DB_PATH_ANDROID);
    Alert.alert('Success', 'Database imported successfully');
  } catch (error) {
    Alert.alert('Import failed', (error as Error)?.message);
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: type errors in consuming code (Routes, Session, Weeks, Statistics, etc.) because old exports like `fetchWeeks`, `insertWorkoutProgram`, `deleteWorkoutProgram` are GONE. That's fine — those consumers will be rewritten in later tasks. The DB module itself should be clean.

If `npx tsc --noEmit` errors out only in the consumer files, that's expected. If it errors in `databaseService.ts`, fix it.

- [ ] **Step 3: Commit**

```bash
git add src/common/databaseService.ts
git commit -m "v2 schema: new DDL, PRAGMA foreign_keys, drop old migrations API"
```

---

## Task 11: seedDB function

**Files:**
- Modify: `src/common/databaseService.ts` (add `seedDB`, call from `initDB`)

- [ ] **Step 1: Add seedDB to databaseService.ts**

Insert just before `export async function initDB`:

```ts
import {EXERCISES, PLANS} from '../seeds';
import {validateSeed} from './seedValidator';

export async function seedDB(db: SQLiteDatabase): Promise<void> {
  validateSeed({exercises: [...EXERCISES], plans: [...PLANS]});

  // 1. Upsert exercises (catalogue grows, never shrinks)
  for (const ex of EXERCISES) {
    await db.executeSql(
      `INSERT INTO exercises (slug, name, video) VALUES (?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET name = excluded.name, video = excluded.video`,
      [ex.slug, ex.name, ex.video ?? null],
    );
  }

  // 2. Per plan: insert if missing, leave existing plan content alone
  for (const plan of PLANS) {
    const [planRes] = await db.executeSql(`SELECT id FROM plans WHERE slug = ?`, [plan.slug]);
    let planId: number;
    if (planRes.rows.length === 0) {
      const [ins] = await db.executeSql(
        `INSERT INTO plans (slug, name, description) VALUES (?, ?, ?)`,
        [plan.slug, plan.name, plan.description ?? null],
      );
      planId = ins.insertId;
    } else {
      planId = planRes.rows.item(0).id;
    }

    // 3. session_templates: insert only missing slugs (template content is immutable post-insert)
    const templateIdBySlug = new Map<string, number>();
    for (const tpl of plan.session_templates) {
      const [tplRes] = await db.executeSql(`SELECT id FROM session_templates WHERE slug = ?`, [tpl.slug]);
      let tplId: number;
      if (tplRes.rows.length === 0) {
        const [ins] = await db.executeSql(
          `INSERT INTO session_templates (slug, name) VALUES (?, ?)`,
          [tpl.slug, tpl.name],
        );
        tplId = ins.insertId;
        // insert all exercises for this template
        for (const ex of tpl.exercises) {
          const [exRow] = await db.executeSql(`SELECT id FROM exercises WHERE slug = ?`, [ex.exercise_slug]);
          const exId = exRow.rows.item(0).id as number;
          await db.executeSql(
            `INSERT INTO session_template_exercises
               (session_template_id, exercise_id, order_index, circuit_index, circuit_rounds,
                prescribed_reps, prescribed_seconds, prescribed_sets, per_side, as_maximum, hint)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tplId, exId, ex.order_index,
              ex.circuit_index ?? null,
              ex.circuit_rounds ?? null,
              ex.prescribed_reps ?? null,
              ex.prescribed_seconds ?? null,
              ex.prescribed_sets,
              ex.per_side ? 1 : 0,
              ex.as_maximum ? 1 : 0,
              ex.hint ?? null,
            ],
          );
        }
      } else {
        tplId = tplRes.rows.item(0).id;
      }
      templateIdBySlug.set(tpl.slug, tplId);
    }

    // 4. plan_days: insert only missing (plan_id, day_index)
    for (const day of plan.days) {
      const [dayRes] = await db.executeSql(
        `SELECT id FROM plan_days WHERE plan_id = ? AND day_index = ?`,
        [planId, day.day_index],
      );
      if (dayRes.rows.length === 0) {
        const tplId = templateIdBySlug.get(day.session_template_slug)!;
        await db.executeSql(
          `INSERT INTO plan_days (plan_id, session_template_id, day_index, weekday_label) VALUES (?, ?, ?, ?)`,
          [planId, tplId, day.day_index, day.weekday_label ?? null],
        );
      }
    }
  }

  // 5. Default active_plan_id to the first seeded plan if not already set
  const [active] = await db.executeSql(`SELECT value FROM settings WHERE key = 'active_plan_id'`);
  if (active.rows.length === 0 && PLANS.length > 0) {
    const [first] = await db.executeSql(`SELECT id FROM plans WHERE slug = ? LIMIT 1`, [PLANS[0].slug]);
    if (first.rows.length > 0) {
      await db.executeSql(`INSERT INTO settings (key, value) VALUES ('active_plan_id', ?)`, [
        String(first.rows.item(0).id),
      ]);
    }
  }
}
```

Then update `initDB`:

```ts
export async function initDB(): Promise<void> {
  const db = await getDBConnection();
  for (const stmt of SCHEMA) {
    await db.executeSql(stmt);
  }
  await seedDB(db);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit src/common/databaseService.ts src/common/seedValidator.ts src/seeds/index.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/common/databaseService.ts
git commit -m "Implement seedDB: idempotent insert of plans, templates, days, exercises"
```

---

## Task 12: Add the workout-instance CRUD layer

**Files:**
- Modify: `src/common/databaseService.ts` (append the CRUD functions consumed by Weeks/Session/Statistics)

- [ ] **Step 1: Append CRUD functions**

Append to `src/common/databaseService.ts`:

```ts
import type {Plan, PlanDay, Session, ExerciseInstance, SetLog, Week} from './types';

// ---------- Plan reads ----------

export async function fetchPlans(db: SQLiteDatabase): Promise<Plan[]> {
  const [res] = await db.executeSql(`SELECT id, slug, name, description FROM plans ORDER BY id ASC`);
  return res.rows.raw();
}

export async function fetchActivePlanId(db: SQLiteDatabase): Promise<number | null> {
  const [res] = await db.executeSql(`SELECT value FROM settings WHERE key = 'active_plan_id'`);
  if (res.rows.length === 0) return null;
  return Number(res.rows.item(0).value);
}

export async function setActivePlanId(db: SQLiteDatabase, planId: number): Promise<void> {
  await db.executeSql(
    `INSERT INTO settings (key, value) VALUES ('active_plan_id', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(planId)],
  );
}

export async function fetchPlanDays(db: SQLiteDatabase, planId: number): Promise<PlanDay[]> {
  const [res] = await db.executeSql(
    `SELECT pd.id, pd.plan_id, pd.session_template_id, pd.day_index, pd.weekday_label,
            st.name AS session_template_name
     FROM plan_days pd
     JOIN session_templates st ON st.id = pd.session_template_id
     WHERE pd.plan_id = ?
     ORDER BY pd.day_index ASC`,
    [planId],
  );
  return res.rows.raw();
}

// ---------- Week / Session creation ----------

export async function createWeek(db: SQLiteDatabase, planId: number): Promise<number> {
  const [weekIns] = await db.executeSql(`INSERT INTO weeks (plan_id) VALUES (?)`, [planId]);
  const weekId = weekIns.insertId;

  const planDays = await fetchPlanDays(db, planId);
  for (const day of planDays) {
    const [sessIns] = await db.executeSql(
      `INSERT INTO sessions (week_id, day_index, weekday_label, session_name)
       VALUES (?, ?, ?, ?)`,
      [weekId, day.day_index, day.weekday_label, day.session_template_name],
    );
    const sessionId = sessIns.insertId;

    // Copy template exercises into session_exercises
    const [tplExRes] = await db.executeSql(
      `SELECT ste.exercise_id, ste.order_index, ste.circuit_index, ste.circuit_rounds,
              ste.prescribed_reps, ste.prescribed_seconds, ste.prescribed_sets,
              ste.per_side, ste.as_maximum, ste.hint
       FROM session_template_exercises ste
       WHERE ste.session_template_id = ?
       ORDER BY ste.order_index ASC`,
      [day.session_template_id],
    );
    const tplExercises = tplExRes.rows.raw();

    for (const tEx of tplExercises) {
      const [seIns] = await db.executeSql(
        `INSERT INTO session_exercises
           (session_id, exercise_id, order_index, circuit_index, circuit_rounds,
            prescribed_reps, prescribed_seconds, prescribed_sets, per_side, as_maximum, hint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId, tEx.exercise_id, tEx.order_index, tEx.circuit_index, tEx.circuit_rounds,
          tEx.prescribed_reps, tEx.prescribed_seconds, tEx.prescribed_sets,
          tEx.per_side, tEx.as_maximum, tEx.hint,
        ],
      );
      const seId = seIns.insertId;

      // Pre-insert empty set rows up to prescribed_sets count
      for (let i = 1; i <= tEx.prescribed_sets; i++) {
        await db.executeSql(
          `INSERT INTO sets (session_exercise_id, set_index) VALUES (?, ?)`,
          [seId, i],
        );
      }
    }
  }

  return weekId;
}

export async function deleteWeek(db: SQLiteDatabase, weekId: number): Promise<void> {
  await db.executeSql(`DELETE FROM weeks WHERE id = ?`, [weekId]);
  // cascades to sessions → session_exercises → sets
}

// ---------- Week / Session reads (2 queries, no N+1) ----------

export async function fetchWeeksByPlan(db: SQLiteDatabase, planId: number): Promise<Week[]> {
  const [weekRes] = await db.executeSql(
    `SELECT w.id AS week_id, w.plan_id, w.created_at, w.finished AS week_finished,
            s.id AS session_id, s.day_index, s.weekday_label, s.session_name,
            s.trained_at, s.finished AS session_finished, s.notes
     FROM weeks w
     LEFT JOIN sessions s ON s.week_id = w.id
     WHERE w.plan_id = ?
     ORDER BY w.created_at DESC, s.day_index ASC`,
    [planId],
  );

  const weekMap = new Map<number, Week>();
  const sessionIds: number[] = [];
  for (const row of weekRes.rows.raw()) {
    let week = weekMap.get(row.week_id);
    if (!week) {
      week = {
        id: row.week_id,
        plan_id: row.plan_id,
        created_at: row.created_at,
        finished: row.week_finished,
        sessions: [],
      };
      weekMap.set(row.week_id, week);
    }
    if (row.session_id != null) {
      week.sessions.push({
        id: row.session_id,
        week_id: row.week_id,
        day_index: row.day_index,
        weekday_label: row.weekday_label,
        session_name: row.session_name,
        trained_at: row.trained_at,
        finished: row.session_finished,
        notes: row.notes,
        exercises: [], // filled in next query
      });
      sessionIds.push(row.session_id);
    }
  }

  if (sessionIds.length === 0) return Array.from(weekMap.values());

  const placeholders = sessionIds.map(() => '?').join(',');
  const [seRes] = await db.executeSql(
    `SELECT se.id AS se_id, se.session_id, se.exercise_id, se.order_index,
            se.circuit_index, se.circuit_rounds, se.prescribed_reps, se.prescribed_seconds,
            se.prescribed_sets, se.per_side, se.as_maximum, se.hint, se.finished AS se_finished,
            e.slug AS exercise_slug, e.name AS exercise_name, e.video,
            st.id AS set_id, st.set_index, st.weight, st.reps, st.seconds
     FROM session_exercises se
     JOIN exercises e ON e.id = se.exercise_id
     LEFT JOIN sets st ON st.session_exercise_id = se.id
     WHERE se.session_id IN (${placeholders})
     ORDER BY se.session_id, se.order_index, st.set_index`,
    sessionIds,
  );

  // Fold session_exercises + sets back into the session objects
  const seMap = new Map<number, ExerciseInstance>();
  for (const row of seRes.rows.raw()) {
    let se = seMap.get(row.se_id);
    if (!se) {
      se = {
        id: row.se_id,
        session_id: row.session_id,
        exercise_id: row.exercise_id,
        exercise_slug: row.exercise_slug,
        exercise_name: row.exercise_name,
        video: row.video,
        order_index: row.order_index,
        circuit_index: row.circuit_index,
        circuit_rounds: row.circuit_rounds,
        prescribed_reps: row.prescribed_reps,
        prescribed_seconds: row.prescribed_seconds,
        prescribed_sets: row.prescribed_sets,
        per_side: row.per_side,
        as_maximum: row.as_maximum,
        hint: row.hint,
        finished: row.se_finished,
        sets: [],
      };
      seMap.set(row.se_id, se);
      // Attach to the right session
      for (const w of weekMap.values()) {
        const sess = w.sessions.find(x => x.id === row.session_id);
        if (sess) {
          sess.exercises.push(se);
          break;
        }
      }
    }
    if (row.set_id != null) {
      se.sets.push({
        id: row.set_id,
        session_exercise_id: row.se_id,
        set_index: row.set_index,
        weight: row.weight,
        reps: row.reps,
        seconds: row.seconds,
      });
    }
  }

  return Array.from(weekMap.values());
}

export async function fetchWeekById(db: SQLiteDatabase, weekId: number): Promise<Week | null> {
  const [w] = await db.executeSql(`SELECT plan_id FROM weeks WHERE id = ?`, [weekId]);
  if (w.rows.length === 0) return null;
  const planId = w.rows.item(0).plan_id;
  const all = await fetchWeeksByPlan(db, planId);
  return all.find(x => x.id === weekId) ?? null;
}

// ---------- Mutations on sets / session.finished ----------

export async function updateSet(
  db: SQLiteDatabase,
  setId: number,
  patch: {weight?: number | null; reps?: number | null; seconds?: number | null},
): Promise<void> {
  const fields: string[] = [];
  const params: (number | null)[] = [];
  if (patch.weight !== undefined)  { fields.push('weight = ?');  params.push(patch.weight); }
  if (patch.reps !== undefined)    { fields.push('reps = ?');    params.push(patch.reps); }
  if (patch.seconds !== undefined) { fields.push('seconds = ?'); params.push(patch.seconds); }
  if (fields.length === 0) return;
  params.push(setId);
  await db.executeSql(`UPDATE sets SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function setSessionExerciseFinished(
  db: SQLiteDatabase,
  sessionExerciseId: number,
  finished: boolean,
): Promise<void> {
  await db.executeSql(
    `UPDATE session_exercises SET finished = ? WHERE id = ?`,
    [finished ? 1 : 0, sessionExerciseId],
  );
}

export async function finishSession(db: SQLiteDatabase, sessionId: number): Promise<void> {
  await db.executeSql(
    `UPDATE sessions SET finished = 1, trained_at = datetime('now') WHERE id = ?`,
    [sessionId],
  );

  // Cascade: if all sessions in week are finished, mark week finished
  const [counts] = await db.executeSql(
    `SELECT
       (SELECT COUNT(*) FROM sessions WHERE week_id = (SELECT week_id FROM sessions WHERE id = ?)) AS total,
       (SELECT COUNT(*) FROM sessions WHERE week_id = (SELECT week_id FROM sessions WHERE id = ?) AND finished = 1) AS done`,
    [sessionId, sessionId],
  );
  const {total, done} = counts.rows.item(0);
  if (total === done) {
    await db.executeSql(
      `UPDATE weeks SET finished = 1 WHERE id = (SELECT week_id FROM sessions WHERE id = ?)`,
      [sessionId],
    );
  }
}

// ---------- Statistics ----------

export interface StatsPoint {
  date: string;
  max_weight: number | null;
  max_reps: number | null;
}

export async function fetchExerciseStats(db: SQLiteDatabase, exerciseSlug: string): Promise<StatsPoint[]> {
  const [res] = await db.executeSql(
    `SELECT
       DATE(s_day.trained_at) AS date,
       MAX(s.weight) AS max_weight,
       MAX(CASE WHEN s_ex.per_side = 1 THEN s.reps * 2 ELSE s.reps END) AS max_reps
     FROM sets s
     JOIN session_exercises s_ex ON s.session_exercise_id = s_ex.id
     JOIN sessions s_day         ON s_ex.session_id = s_day.id
     JOIN exercises e            ON s_ex.exercise_id = e.id
     WHERE e.slug = ?
       AND s_day.trained_at IS NOT NULL
       AND (s.weight IS NOT NULL OR s.reps IS NOT NULL)
     GROUP BY DATE(s_day.trained_at)
     ORDER BY date ASC`,
    [exerciseSlug],
  );
  return res.rows.raw();
}

export async function fetchAllExerciseSlugs(db: SQLiteDatabase): Promise<{slug: string; name: string}[]> {
  const [res] = await db.executeSql(`SELECT slug, name FROM exercises ORDER BY name ASC`);
  return res.rows.raw();
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit src/common/databaseService.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/common/databaseService.ts
git commit -m "Add v2 CRUD layer: plans, weeks, sessions, sets, stats"
```

---

## Task 13: Delete legacy files (variables.tsx, migrations.ts)

**Files:**
- Delete: `src/common/variables.tsx`
- Delete: `src/common/migrations.ts`

- [ ] **Step 1: Remove imports from databaseService.ts**

If `src/common/databaseService.ts` still has imports of `migrations` or `training`/`surfTraining` from variables, remove them. (It shouldn't after Tasks 10-12, but verify.)

Run: `grep -n "variables\|migrations\|surfTraining\| training\." src/common/databaseService.ts`
Expected: no matches.

- [ ] **Step 2: Delete the files**

Run:
```bash
git rm src/common/variables.tsx src/common/migrations.ts
```

- [ ] **Step 3: Verify no other consumers**

Run: `grep -rn "from '../common/variables'\|from '../../common/variables'\|migrations" src/`
Expected: 

- One match in `src/screens/Home.tsx` (`demotivationalQuotes` import)
- Possibly matches in `Statistics.tsx`/`App.tsx` (`colors`, `TRAINING_TYPE`)
- These will be fixed in their respective tasks. NOTE the matches but do not commit yet.

- [ ] **Step 4: Add a `colors` constant to a new home**

The old `variables.tsx` also exported `colors`. Re-add to a small new file:

```ts
// src/common/theme.ts
export const colors = {
  primary: '#FF9800',
  secondary: '#4CAF50',
};
```

- [ ] **Step 5: Commit**

```bash
git add src/common/theme.ts -u
git commit -m "Remove variables.tsx and migrations.ts; extract colors to theme.ts"
```

(`-u` stages the deletions tracked above.)

---

## Task 14: Rewrite App.tsx to drop TRAINING_TYPE

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace contents**

```tsx
// src/App.tsx
import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import SQLite from 'react-native-sqlite-storage';

import Routes from './Routes';
import SplashScreen from './components/Splash';
import Toast from './components/Toast';
import {initDB} from './common/databaseService';

SQLite.enablePromise(true);

const App: React.FC = () => {
  const [initiated, setInitiated] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);
  const [puppy, setPuppy] = React.useState('');
  const [error, setError] = React.useState<null | Error>(null);

  React.useEffect(() => {
    (async function init() {
      try {
        const [response, _] = await Promise.all([
          fetch('https://dog.ceo/api/breeds/image/random'),
          initDB(),
        ]);
        const data = await response.json();
        if (data?.status === 'success') setPuppy(data.message);
      } catch (err) {
        console.log(err);
        setError(err as Error);
      } finally {
        setInitiated(true);
      }
    })();
  }, []);

  if (showSplash) {
    return (
      <SplashScreen
        source={require('../assets/splash.png')}
        removeSplashScreen={() => setShowSplash(false)}
        initiated={initiated}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{flex: 1}}>
        <Routes puppy={puppy} />
        {error && (
          <Toast
            message={error.message}
            type="error"
            onClose={() => setError(null)}
          />
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default App;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit src/App.tsx`
Expected: types fail in `Routes.tsx` because `Routes` no longer takes `type` prop. Fixed in Task 15.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "App.tsx: drop AsyncStorage TRAINING_TYPE coupling"
```

---

## Task 15: Rewrite Routes.tsx for dynamic plan-driven tabs

**Files:**
- Modify: `src/Routes.tsx`

- [ ] **Step 1: Replace contents**

```tsx
// src/Routes.tsx
import React from 'react';
import {ActivityIndicator, StatusBar, useColorScheme, View} from 'react-native';
import {DefaultTheme, NavigationContainer, Theme} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import HomeScreen from './screens/Home';
import StatisticsScreen from './screens/Statistics';
import TrainingProgramScreen from './screens/Session';
import Weeks from './screens/Weeks';

import {colors} from './common/theme';
import {
  fetchActivePlanId,
  fetchPlanDays,
  getDBConnection,
} from './common/databaseService';

const Tab = createBottomTabNavigator();
const SubTab = createMaterialTopTabNavigator();

const renderTabBarIcon =
  (name: string) =>
  ({color, size}: {color: string; size: number}) =>
    <MaterialIcons name={name as any} color={color} size={size} />;

const SessionsTabs: React.FC<BaseProps> = ({route}) => {
  const [days, setDays] = React.useState<PlanDay[] | null>(null);

  React.useEffect(() => {
    (async () => {
      const db = await getDBConnection();
      const planId = await fetchActivePlanId(db);
      if (planId == null) {
        setDays([]);
        return;
      }
      setDays(await fetchPlanDays(db, planId));
    })();
  }, []);

  if (days === null) {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SubTab.Navigator
      backBehavior="history"
      screenOptions={{tabBarScrollEnabled: true, tabBarBounces: true, lazy: true}}>
      {days.map(day => {
        const label = day.weekday_label
          ? `${day.session_template_name}: ${day.weekday_label}`
          : day.session_template_name;
        return (
          <SubTab.Screen
            key={day.id}
            name={label}
            component={TrainingProgramScreen}
            initialParams={{
              weekID: route.params?.weekID,
              day_index: day.day_index,
              title: label,
            }}
          />
        );
      })}
    </SubTab.Navigator>
  );
};

const Routes: React.FC<{puppy: string}> = ({puppy}) => {
  const AppTheme: Theme = {
    ...DefaultTheme,
    colors: {...DefaultTheme.colors, ...colors},
  };
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <NavigationContainer theme={AppTheme}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.primary}
      />
      <Tab.Navigator backBehavior="history" initialRouteName="Home">
        <Tab.Screen name="Home" component={HomeScreen} initialParams={{puppy}}
          options={{tabBarIcon: renderTabBarIcon('home')}} />
        <Tab.Screen name="Weeks" component={Weeks}
          options={{tabBarIcon: renderTabBarIcon('save-as')}} />
        <Tab.Screen name="Sessions" component={SessionsTabs}
          options={{tabBarIcon: renderTabBarIcon('fitness-center')}} />
        <Tab.Screen name="Statistics" component={StatisticsScreen}
          options={{tabBarIcon: renderTabBarIcon('bar-chart')}} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default Routes;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit src/Routes.tsx`
Expected: errors in Weeks.tsx and Session.tsx (their old prop shapes don't match). Fixed in next tasks.

- [ ] **Step 3: Commit**

```bash
git add src/Routes.tsx
git commit -m "Routes: dynamic Sessions tabs from active plan, no hardcoded standard/surf split"
```

---

## Task 16: Rewrite Weeks.tsx

**Files:**
- Modify: `src/screens/Weeks.tsx`
- Modify: `src/components/WeekAccordion.tsx` (adjust to new `Week` shape — see step 4)

- [ ] **Step 1: Replace Weeks.tsx**

```tsx
// src/screens/Weeks.tsx
import React from 'react';
import {Button, FlatList, RefreshControl, StyleSheet, View} from 'react-native';

import AppText from '../components/AppText';
import Toast from '../components/Toast';
import LoadingModal from '../components/LoadingModal';
import ErrorComp from '../components/Error';
import Loading from '../components/Loading';
import WeekAccordion from '../components/WeekAccordion';

import {colors} from '../common/theme';
import {
  createWeek,
  fetchActivePlanId,
  fetchPlans,
  fetchWeeksByPlan,
  getDBConnection,
  setActivePlanId,
} from '../common/databaseService';

const Weeks: React.FC<BaseProps> = () => {
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [activePlanId, setActivePlanIdState] = React.useState<number | null>(null);
  const [weeks, setWeeks] = React.useState<Week[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [initError, setInitError] = React.useState<null | Error>(null);
  const [error, setError] = React.useState<null | Error>(null);
  const [updating, setUpdating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [success, setSuccess] = React.useState('');

  const refresh = React.useCallback(async (planId: number) => {
    const db = await getDBConnection();
    setWeeks(await fetchWeeksByPlan(db, planId));
  }, []);

  React.useEffect(() => {
    (async function init() {
      try {
        const db = await getDBConnection();
        const all = await fetchPlans(db);
        setPlans(all);
        const active = (await fetchActivePlanId(db)) ?? all[0]?.id ?? null;
        setActivePlanIdState(active);
        if (active != null) await refresh(active);
      } catch (err) {
        setInitError(err as Error);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  async function handleAddWeek() {
    if (activePlanId == null) return;
    setUpdating(true);
    try {
      const db = await getDBConnection();
      await createWeek(db, activePlanId);
      await refresh(activePlanId);
      setSuccess('Added new Week');
    } catch (err) {
      setError(err as Error);
    } finally {
      setUpdating(false);
    }
  }

  async function handleSelectPlan(planId: number) {
    setActivePlanIdState(planId);
    const db = await getDBConnection();
    await setActivePlanId(db, planId);
    await refresh(planId);
  }

  async function handleRefresh() {
    if (activePlanId == null) return;
    setRefreshing(true);
    await refresh(activePlanId);
    setRefreshing(false);
  }

  if (loading) return <Loading text="Lade Wochen" />;
  if (initError) return <ErrorComp error={initError} />;

  return (
    <View style={styles.container}>
      {plans.length > 1 && (
        <View style={styles.planTabs}>
          {plans.map(p => (
            <Button
              key={p.id}
              color={p.id === activePlanId ? colors.primary : '#aaa'}
              title={p.name}
              onPress={() => handleSelectPlan(p.id)}
            />
          ))}
        </View>
      )}

      {weeks.length === 0 ? (
        <View style={styles.empty}>
          <AppText>Noch keine Daten</AppText>
        </View>
      ) : (
        <FlatList
          data={weeks}
          keyExtractor={w => String(w.id)}
          renderItem={({item}) => (
            <WeekAccordion
              week={item}
              setWeeks={setWeeks}
              setUpdating={setUpdating}
              setError={setError}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          style={styles.list}
        />
      )}

      <Button
        color={colors.primary}
        title="Add new Week"
        onPress={handleAddWeek}
        disabled={updating || activePlanId == null}
      />

      <LoadingModal loading={updating} />
      {!!success && <Toast message={success} onClose={() => setSuccess('')} />}
      {error && (
        <Toast type="error" message={error.message} onClose={() => setError(null)} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16, backgroundColor: '#fff'},
  planTabs: {flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8},
  empty: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  list: {flex: 1},
});

export default Weeks;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit src/screens/Weeks.tsx`
Expected: error in WeekAccordion (props shape changed from `Week & {setWeeks, setUpdating, setError}` to `{week: Week, setWeeks, setUpdating, setError}`).

- [ ] **Step 3: Update WeekAccordion.tsx prop signature**

Open `src/components/WeekAccordion.tsx`. Find the `React.FC<...>` declaration and the spread of week props. Change:

```tsx
// before:
const WeekAccordion: React.FC<Week & {setWeeks, setUpdating, setError}> = props => {
  const {sessions, id, start_date, end_date, ...} = props;
  ...

// after:
interface Props {
  week: Week;
  setWeeks: React.Dispatch<React.SetStateAction<Week[]>>;
  setUpdating: React.Dispatch<React.SetStateAction<boolean>>;
  setError: (e: Error | null) => void;
}
const WeekAccordion: React.FC<Props> = ({week, setWeeks, setUpdating, setError}) => {
  const {id, created_at, sessions, finished} = week;
  ...
```

Replace any `start_date`/`end_date` usage with `created_at` and (for the date range display) the min/max of `sessions.map(s => s.trained_at).filter(Boolean)`. If you previously called `displayDate(start_date, end_date)`, change to:

```tsx
const dates = sessions.map(s => s.trained_at).filter((d): d is string => !!d);
const headerDate = dates.length === 0
  ? 'No sessions trained yet'
  : displayDate(dates[0], dates[dates.length - 1]);
```

Replace `props.deleteWorkoutProgram(id)` calls (if any) with `deleteWeek(db, id)`.

- [ ] **Step 4: Type-check + verify**

Run: `npx tsc --noEmit src/components/WeekAccordion.tsx src/screens/Weeks.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Weeks.tsx src/components/WeekAccordion.tsx
git commit -m "Weeks: multi-plan top-tabs, new fetchWeeksByPlan path"
```

---

## Task 17: Rewrite Session.tsx

**Files:**
- Modify: `src/screens/Session.tsx`

- [ ] **Step 1: Replace contents**

```tsx
// src/screens/Session.tsx
import React from 'react';
import {Button, ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import Loading from '../components/Loading';
import ErrorComp from '../components/Error';
import Exercise from '../components/Exercise';
import LoadingModal from '../components/LoadingModal';
import Toast from '../components/Toast';

import {colors} from '../common/theme';
import {
  createWeek,
  fetchActivePlanId,
  fetchWeekById,
  fetchWeeksByPlan,
  finishSession,
  getDBConnection,
} from '../common/databaseService';

interface RouteParams {
  weekID?: number;
  day_index: number;
  title: string;
}

const Session: React.FC<BaseProps> = ({navigation, route}) => {
  const {weekID, day_index} = route.params as RouteParams;

  const [currentWeek, setCurrentWeek] = React.useState<Week | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [finishError, setFinishError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      (async function load() {
        setLoading(true);
        try {
          const db = await getDBConnection();
          let week: Week | null = null;

          if (weekID) {
            week = await fetchWeekById(db, weekID);
          } else {
            const planId = await fetchActivePlanId(db);
            if (planId == null) throw new Error('No active plan');
            const all = await fetchWeeksByPlan(db, planId);
            if (all.length > 0) {
              week = all[0]; // ORDER BY created_at DESC ⇒ index 0 is newest
            } else {
              await createWeek(db, planId);
              const fresh = await fetchWeeksByPlan(db, planId);
              week = fresh[0];
            }
          }
          setCurrentWeek(week);
        } catch (err) {
          setError(err as Error);
        } finally {
          setLoading(false);
        }
      })();
    }, [weekID]),
  );

  const currentSession: Session | undefined = currentWeek?.sessions.find(s => s.day_index === day_index);

  useFocusEffect(
    React.useCallback(() => {
      const parent = navigation.getParent();
      if (!parent || !currentWeek) return;
      const dates = currentWeek.sessions.map(s => s.trained_at).filter((d): d is string => !!d);
      const range = dates.length === 0 ? '' : ` (${dates[0].slice(0, 10)} – ${dates[dates.length - 1].slice(0, 10)})`;
      parent.setOptions({title: `Week ${currentWeek.id}${range}`});
    }, [navigation, currentWeek]),
  );

  async function handleFinish() {
    if (!currentSession) return;
    setUpdating(true);
    try {
      const allDone = currentSession.exercises.every(e => e.finished);
      if (!allDone) throw new Error('There are still exercises open');
      const db = await getDBConnection();
      await finishSession(db, currentSession.id);
      setCurrentWeek(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          sessions: prev.sessions.map(s =>
            s.id === currentSession.id ? {...s, finished: 1, trained_at: new Date().toISOString()} : s,
          ),
        };
      });
      setSuccess(true);
    } catch (err) {
      setFinishError((err as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <Loading text="Loading Training" />;
  if (error) return <ErrorComp error={error} />;
  if (!currentSession) return <ErrorComp error={new Error('Session not found')} />;

  // Group exercises by circuit_index for rendering (Task 18 implements the Exercise wrapper)
  return (
    <ScrollView style={styles.root} contentContainerStyle={{paddingBottom: 30, gap: 30}}>
      {currentSession.exercises.map(ex => (
        <Exercise key={ex.id} exercise={ex} />
      ))}

      <Button
        color={colors.primary}
        onPress={handleFinish}
        title={currentSession.finished ? 'Update day' : 'Finish day'}
      />

      {updating && <LoadingModal loading={updating} />}
      {!!finishError && (
        <Toast type="error" message={finishError} onClose={() => setFinishError(null)} />
      )}
      {success && (
        <Toast message="Put your cheeso in my taco, bro" onClose={() => setSuccess(false)} />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, padding: 16},
});

export default Session;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit src/screens/Session.tsx`
Expected: errors in `Exercise.tsx` because its prop shape changed. Fixed in Task 18.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Session.tsx
git commit -m "Session: use fetchWeekById, finishSession; track day_index instead of day"
```

---

## Task 18: Rewrite Exercise.tsx + add circuit rendering

**Files:**
- Modify: `src/components/Exercise.tsx`

- [ ] **Step 1: Rewrite to consume `ExerciseInstance` and render circuit-aware UI**

```tsx
// src/components/Exercise.tsx
import React from 'react';
import {Button, Modal, Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import Accordion from './Accordion';
import AppInput from './AppInput';
import AppCheckBox from './AppCheckBox';
import AppText from './AppText';
import CountdownTimer from './CountdownTimer';
import Youtube from './Youtube';
import Toast from './Toast';

import {colors} from '../common/theme';
import {row} from '../common/styles';
import {formatTime} from '../common/functions';
import {
  getDBConnection,
  setSessionExerciseFinished,
  updateSet,
} from '../common/databaseService';

interface Props {
  exercise: ExerciseInstance;
}

function formatPrescription(ex: ExerciseInstance): string {
  if (ex.prescribed_seconds != null) {
    const base = formatTime(ex.prescribed_seconds);
    const side = ex.per_side ? ' Per Side' : '';
    return ex.prescribed_seconds >= 60 ? `${base}${side}` : `${ex.prescribed_seconds} Secs${side}`;
  }
  if (ex.prescribed_reps != null) {
    const prefix = ex.as_maximum ? 'up to ' : '';
    const side = ex.per_side ? ' Per Side' : '';
    return `${prefix}${ex.prescribed_reps} Reps${side}`;
  }
  return '';
}

const Exercise: React.FC<Props> = ({exercise}) => {
  const [finished, setFinished] = React.useState(!!exercise.finished);
  const [showModal, setShowModal] = React.useState(false);
  const [showYoutube, setShowYoutube] = React.useState(false);
  const [sets, setSets] = React.useState<SetLog[]>(exercise.sets);
  const [error, setError] = React.useState<Error | null>(null);

  function close() {
    setShowModal(false);
    setShowYoutube(false);
  }

  async function handleSetChange(setId: number, field: 'weight' | 'reps', value: string) {
    const num = value === '' ? null : Number(value);
    setSets(prev => prev.map(s => (s.id === setId ? {...s, [field]: num} : s)));
    try {
      const db = await getDBConnection();
      await updateSet(db, setId, {[field]: num});
    } catch (err) {
      setError(err as Error);
    }
  }

  async function handleCheckBox(value: boolean) {
    setFinished(value);
    try {
      const db = await getDBConnection();
      await setSessionExerciseFinished(db, exercise.id, value);
    } catch (err) {
      setError(err as Error);
    }
  }

  const isTimed = exercise.prescribed_seconds != null;
  const prescription = formatPrescription(exercise);

  return (
    <Accordion
      style={finished && {backgroundColor: colors.secondary}}
      title={exercise.exercise_name}
      subtitle={prescription}
      closed={finished}
      controlIcon="expand-more">
      <Pressable
        onPress={() => {
          setShowYoutube(true);
          setShowModal(true);
        }}
        style={[row, {justifyContent: 'flex-start', marginBottom: 16}]}>
        <MaterialIcons name="subscriptions" size={30} color={colors.primary} />
        <AppText bold>Exercise Explanation</AppText>
      </Pressable>

      {!!exercise.hint && <AppText italic>{exercise.hint}</AppText>}

      <View style={styles.trainingWrapper}>
        <View>
          {isTimed ? (
            <View style={{...row}}>
              <AppText>{prescription}</AppText>
              <Button color={colors.primary} title="Show Timer" onPress={() => setShowModal(true)} />
            </View>
          ) : (
            sets.map(set => (
              <View key={set.id} style={styles.data}>
                <AppInput
                  keyboardType="numeric"
                  setValue={v => handleSetChange(set.id, 'reps', v)}
                  value={set.reps?.toString() ?? ''}
                  label="Reps"
                />
                <AppInput
                  keyboardType="numeric"
                  setValue={v => handleSetChange(set.id, 'weight', v)}
                  value={set.weight?.toString() ?? ''}
                  label="Weight"
                />
              </View>
            ))
          )}
        </View>

        <AppCheckBox value={finished} onValueChange={handleCheckBox} color={colors.primary} />
      </View>

      <Modal visible={showModal} onRequestClose={close} animationType="slide">
        {showYoutube ? (
          <Youtube close={close} video={exercise.video ?? ''} />
        ) : (
          <CountdownTimer close={close} duration={exercise.prescribed_seconds ?? 0} />
        )}
      </Modal>

      {error && <Toast message={error.message} type="error" onClose={() => setError(null)} />}
    </Accordion>
  );
};

const styles = StyleSheet.create({
  trainingWrapper: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  data: {...row, justifyContent: 'center'},
});

export default Exercise;
```

The `Accordion` component is used unchanged — it just needs to accept a `subtitle` prop. If it doesn't already, add it (small, ~3-line change in `src/components/Accordion.tsx`).

- [ ] **Step 2: If Accordion lacks subtitle prop, add it**

Open `src/components/Accordion.tsx`. Locate the title rendering. Add a `subtitle?: string` to the props and render it below the title in smaller/secondary style:

```tsx
{title && <AppText bold>{title}</AppText>}
{subtitle && <AppText italic style={{opacity: 0.7, fontSize: 12}}>{subtitle}</AppText>}
```

- [ ] **Step 3: Group exercises by circuit in Session.tsx**

Update the Session.tsx render block to group consecutive same-`circuit_index` exercises into a visual block with a "× N rounds" badge. Replace the body's `{currentSession.exercises.map(...)}` with:

```tsx
{groupByCircuit(currentSession.exercises).map((group, gi) => (
  <View key={gi} style={group.circuit_rounds ? styles.circuit : null}>
    {group.circuit_rounds && (
      <View style={styles.circuitBadge}>
        <AppText bold>× {group.circuit_rounds} rounds</AppText>
      </View>
    )}
    {group.exercises.map(ex => <Exercise key={ex.id} exercise={ex} />)}
  </View>
))}
```

And add the helper + styles to `Session.tsx`:

```tsx
function groupByCircuit(exercises: ExerciseInstance[]): Array<{
  circuit_rounds: number | null;
  exercises: ExerciseInstance[];
}> {
  const out: Array<{circuit_rounds: number | null; exercises: ExerciseInstance[]}> = [];
  for (const ex of exercises) {
    const last = out[out.length - 1];
    if (ex.circuit_index != null && last && last.circuit_rounds === ex.circuit_rounds &&
        last.exercises[0].circuit_index === ex.circuit_index) {
      last.exercises.push(ex);
    } else {
      out.push({circuit_rounds: ex.circuit_index != null ? ex.circuit_rounds : null, exercises: [ex]});
    }
  }
  return out;
}

// Add to StyleSheet.create:
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, padding: 16},
  circuit: {borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 8, gap: 8},
  circuitBadge: {alignSelf: 'flex-start', backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
});
```

And add the import:
```tsx
import AppText from '../components/AppText';
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit src/screens/Session.tsx src/components/Exercise.tsx src/components/Accordion.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Exercise.tsx src/screens/Session.tsx src/components/Accordion.tsx
git commit -m "Exercise: render circuits, structured prescription display, new ExerciseInstance shape"
```

---

## Task 19: Rewrite Statistics.tsx

**Files:**
- Modify: `src/screens/Statistics.tsx`

- [ ] **Step 1: Replace contents**

```tsx
// src/screens/Statistics.tsx
import React from 'react';
import {StyleSheet, View, useWindowDimensions} from 'react-native';
import {CartesianChart, Bar} from 'victory-native';
import roboto from '../../assets/Roboto-Medium.ttf';
import {LinearGradient, useFont, vec} from '@shopify/react-native-skia';

import ErrorComp from '../components/Error';
import Toast from '../components/Toast';
import Loading from '../components/Loading';
import AppPicker from '../components/AppPicker';

import {colors} from '../common/theme';
import {
  fetchAllExerciseSlugs,
  fetchExerciseStats,
  getDBConnection,
  type StatsPoint,
} from '../common/databaseService';

interface ChartPoint {
  day: number;
  weight: number | null;
}

const Statistics: React.FC<BaseProps> = () => {
  const [exercises, setExercises] = React.useState<{slug: string; name: string}[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [success, setSuccess] = React.useState('');
  const [data, setData] = React.useState<ChartPoint[]>([]);

  const font = useFont(roboto, 12);
  const {height} = useWindowDimensions();

  React.useEffect(() => {
    (async () => {
      try {
        const db = await getDBConnection();
        setExercises(await fetchAllExerciseSlugs(db));
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSelect(name: string) {
    const found = exercises.find(e => e.name === name);
    if (!found) return;
    const db = await getDBConnection();
    const stats: StatsPoint[] = await fetchExerciseStats(db, found.slug);
    setData(stats.map((p, i) => ({day: i + 1, weight: p.max_weight})));
  }

  if (loading) return <Loading text="Loading Statistics" />;
  if (error) return <ErrorComp error={error}>{error.message}</ErrorComp>;

  return (
    <View style={styles.root}>
      <AppPicker onSelect={onSelect} items={exercises.map(e => e.name)} />

      {data.length > 0 && (
        <View style={{height: height * 0.65}}>
          <CartesianChart
            domainPadding={{left: 30, top: 10, right: 30}}
            axisOptions={{
              font,
              formatXLabel: v => 'Workout ' + v,
              formatYLabel: v => v + ' kg',
            }}
            domain={{y: [0]}}
            data={data}
            xKey="day"
            yKeys={['weight']}>
            {({points, chartBounds}) => (
              <Bar
                chartBounds={chartBounds}
                points={points.weight}
                roundedCorners={{topLeft: 5, topRight: 5}}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(0, 600)}
                  colors={[colors.primary, '#a78bfa']}
                />
              </Bar>
            )}
          </CartesianChart>
        </View>
      )}
      {!!success && <Toast message={success} onClose={() => setSuccess('')} />}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff', padding: 16, justifyContent: 'space-between', gap: 16},
});

export default Statistics;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit src/screens/Statistics.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Statistics.tsx
git commit -m "Statistics: single SQL query (per-side correct), drops JS reduce"
```

---

## Task 20: Rewrite Home.tsx (drop variables.tsx dependency)

**Files:**
- Modify: `src/screens/Home.tsx`

- [ ] **Step 1: Replace contents**

```tsx
// src/screens/Home.tsx
import React from 'react';
import {Button, Image, StyleSheet, View} from 'react-native';
import {pick, types, errorCodes, isErrorWithCode} from '@react-native-documents/picker';

import AppText from '../components/AppText';
import {colors} from '../common/theme';
import {DEMOTIVATIONAL_QUOTES} from '../common/quotes';
import {exportDatabase, importDatabase} from '../common/databaseService';

const Home: React.FC<BaseProps> = ({route}) => {
  const {puppy} = route?.params as {puppy: string};
  const [submitting, setSubmitting] = React.useState(false);

  const quote = DEMOTIVATIONAL_QUOTES[Math.floor(Math.random() * DEMOTIVATIONAL_QUOTES.length)];

  async function pickFile(): Promise<string | undefined> {
    try {
      const [res] = await pick({type: [types.allFiles]});
      return res.uri;
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        console.log('User canceled the picker');
        return;
      }
      throw err;
    }
  }

  return (
    <View style={styles.root}>
      {!!puppy && <Image source={{uri: puppy}} style={{width: '100%', height: 300}} />}
      <AppText style={{fontSize: 16}} italic>
        {quote}
      </AppText>

      <Button color={colors.primary} title="Export data" disabled={submitting}
        onPress={async () => {
          setSubmitting(true);
          try {
            await exportDatabase();
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <Button color={colors.primary} title="Import data" disabled={submitting}
        onPress={async () => {
          setSubmitting(true);
          try {
            const data = await pickFile();
            if (data) await importDatabase(data);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff', padding: 16, gap: 32},
});

export default Home;
```

- [ ] **Step 2: Type-check + run all tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc PASS, jest still green (4 + slugify + seedValidator + seed bundle = ~25 tests pass).

- [ ] **Step 3: Commit**

```bash
git add src/screens/Home.tsx
git commit -m "Home: use DEMOTIVATIONAL_QUOTES and theme.colors; new picker API"
```

---

## Task 21: Bump version to 2.0.0

**Files:**
- Modify: `package.json`
- Modify: `android/app/build.gradle` (via existing script)

- [ ] **Step 1: Bump in package.json**

Run: `npm version major --no-git-tag-version`
Verify: `grep '"version"' package.json` → `"version": "2.0.0",`

- [ ] **Step 2: Sync Android versionName + bump versionCode**

Run: `node update-android-version.js`
Expected output: `Successfully updated build.gradle: - versionName: 2.0.0 - versionCode incremented by 1`

- [ ] **Step 3: Commit**

```bash
git add package.json android/app/build.gradle
git commit -m "Bump to 2.0.0 (v2 schema rework)"
```

---

## Task 22: Build + manually verify on device

**Files:** none (verification only).

- [ ] **Step 1: Clean build artifacts from v1 schema**

Run:
```bash
cd android && ./gradlew clean
cd ..
```

- [ ] **Step 2: Wipe any pre-existing dev DB**

Connect device via ADB then:
```bash
adb shell run-as com.workoutwarden rm -f databases/warden.db
```
(Skip if no device connected and you'll start fresh.)

- [ ] **Step 3: Run app on device**

Run: `npm run android`
Expected: builds, installs, launches.

- [ ] **Step 4: Manual smoke test**

In the running app, verify:
- Splash → Home shows dog + a demotivational quote
- "Add new Week" on Weeks tab creates a week with 5 sessions
- Sessions tab shows 5 top-tabs labeled "Lower Body: Mon", "Upper Body + Stretching: Tue", "Lower Body (Nordic): Wed", "Upper Body + Stretching: Thu", "Lower Body: Fri"
- Tap into "Lower Body: Mon" — see Backward Walking, then 3-exercise calf triplet with "× 2 rounds" badge, etc.
- Edit weight/reps on a set → returns to the value on re-open (DB persistence works)
- Check a set's "finished" checkbox → background turns green
- "Finish day" with not-all-finished exercises → shows "There are still exercises open" toast
- Mark all → tap "Finish day" → toast appears, session marked finished
- After all 5 sessions finished → week shows as finished in Weeks tab
- Statistics tab → picker lists all 24 exercises → select one (e.g. VMO Squat) and verify a bar chart renders (empty for a fresh week — only shows data after the user logged some weights)

If anything broken: investigate, fix, recommit. Do not proceed until happy-path works end-to-end.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "<describe the fix>"
```

(Skip if nothing was broken.)

---

## Task 23: Write CLI legacy import script

**Files:**
- Create: `scripts/import-legacy.ts`
- Modify: `package.json` (add `tsx` and `better-sqlite3` to devDependencies, add `import:legacy` script)

- [ ] **Step 1: Add tooling**

Run: `npm install --save-dev tsx better-sqlite3 @types/better-sqlite3 --legacy-peer-deps --no-audit --no-fund`

- [ ] **Step 2: Add npm script**

Edit `package.json` `scripts` block:
```json
"import:legacy": "tsx scripts/import-legacy.ts"
```

- [ ] **Step 3: Write the script**

```ts
// scripts/import-legacy.ts
import Database from 'better-sqlite3';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {slugify} from '../src/common/slugify';

const [,, sourceArg, targetArg] = process.argv;
const sourcePath = resolve(sourceArg ?? `${process.env.HOME}/Downloads/warden-exported.db`);
const targetPath = resolve(targetArg ?? './warden.db');

console.log(`source: ${sourcePath}\ntarget: ${targetPath}`);

const src = new Database(sourcePath, {readonly: true});
const dst = new Database(targetPath);

dst.pragma('foreign_keys = ON');

// 1. Build target schema if empty (lets us point at a fresh file)
const SCHEMA: string[] = readFileSync(
  resolve(__dirname, './schema-v2.sql'),
  'utf8',
).split(/;\s*\n/).filter(s => s.trim());
for (const stmt of SCHEMA) dst.exec(stmt);

const txn = dst.transaction(() => {
  // 2. Ensure 'legacy' plan
  let planRow = dst.prepare(`SELECT id FROM plans WHERE slug = 'legacy'`).get() as {id: number} | undefined;
  if (!planRow) {
    const r = dst.prepare(`INSERT INTO plans (slug, name, description) VALUES ('legacy', 'Standard (Legacy)', 'Imported from v1 warden-exported.db')`).run();
    planRow = {id: Number(r.lastInsertRowid)};
  }
  const planId = planRow.id;

  // 3. Distinct days from source → session_templates + plan_days
  const distinctDays: {day: string}[] = src.prepare(`SELECT DISTINCT day FROM training_days ORDER BY day ASC`).all() as any;
  const tplIdByDay = new Map<string, number>();
  let dayIndex = 1;
  for (const {day} of distinctDays) {
    const slug = slugify(day);
    let tpl = dst.prepare(`SELECT id FROM session_templates WHERE slug = ?`).get(slug) as {id: number} | undefined;
    if (!tpl) {
      const r = dst.prepare(`INSERT INTO session_templates (slug, name) VALUES (?, ?)`).run(slug, day);
      tpl = {id: Number(r.lastInsertRowid)};
    }
    tplIdByDay.set(day, tpl.id);

    const existing = dst.prepare(`SELECT id FROM plan_days WHERE plan_id = ? AND day_index = ?`).get(planId, dayIndex);
    if (!existing) {
      dst.prepare(`INSERT INTO plan_days (plan_id, session_template_id, day_index, weekday_label) VALUES (?, ?, ?, NULL)`).run(planId, tpl.id, dayIndex);
    }
    dayIndex++;
  }

  // 4. Exercises: upsert into target catalogue
  const srcExercises = src.prepare(`SELECT id, name, video FROM exercises`).all() as {id: number; name: string; video: string | null}[];
  const exIdMap = new Map<number, number>(); // old → new
  for (const ex of srcExercises) {
    const slug = slugify(ex.name);
    const r = dst.prepare(`INSERT INTO exercises (slug, name, video) VALUES (?, ?, ?)
                           ON CONFLICT(slug) DO UPDATE SET video = COALESCE(excluded.video, exercises.video)
                           RETURNING id`).get(slug, ex.name, ex.video) as {id: number};
    exIdMap.set(ex.id, r.id);
  }

  // 5. Workout programs → weeks
  const srcPrograms = src.prepare(`SELECT id, start_date, end_date, finished FROM workout_programs ORDER BY id ASC`).all() as any[];
  const weekIdMap = new Map<number, number>();
  const insWeek = dst.prepare(`INSERT INTO weeks (plan_id, created_at, finished) VALUES (?, ?, ?)`);
  for (const p of srcPrograms) {
    const r = insWeek.run(planId, p.start_date, p.finished);
    weekIdMap.set(p.id, Number(r.lastInsertRowid));
  }

  // 6. training_days → sessions
  const srcTd = src.prepare(`SELECT id, workout_program_id, day, finished FROM training_days ORDER BY workout_program_id, id`).all() as any[];
  const sessionIdMap = new Map<number, number>();
  const insSession = dst.prepare(`INSERT INTO sessions (week_id, day_index, weekday_label, session_name, trained_at, finished) VALUES (?, ?, NULL, ?, ?, ?)`);
  const programEndDates = new Map<number, string>(srcPrograms.map(p => [p.id, p.end_date]));
  const dayIndexByName = new Map<string, number>([...distinctDays].map(({day}, i) => [day, i + 1]));
  for (const td of srcTd) {
    const weekId = weekIdMap.get(td.workout_program_id)!;
    const di = dayIndexByName.get(td.day)!;
    const trainedAt = programEndDates.get(td.workout_program_id) ?? null;
    const r = insSession.run(weekId, di, td.day, trainedAt, td.finished);
    sessionIdMap.set(td.id, Number(r.lastInsertRowid));
  }

  // 7. training_day_exercises → session_exercises
  const srcTde = src.prepare(`
    SELECT tde.id, tde.training_day_id, tde.exercise_id, tde.finished,
           (SELECT COUNT(*) FROM sets s WHERE s.training_day_exercise_id = tde.id) AS set_count
    FROM training_day_exercises tde
    ORDER BY tde.training_day_id, tde.id
  `).all() as any[];
  const seIdMap = new Map<number, number>();
  const insSe = dst.prepare(`
    INSERT INTO session_exercises
      (session_id, exercise_id, order_index, prescribed_sets, finished)
    VALUES (?, ?, ?, ?, ?)`);
  let lastTrainingDayId = -1;
  let orderIndex = 0;
  for (const tde of srcTde) {
    if (tde.training_day_id !== lastTrainingDayId) {
      lastTrainingDayId = tde.training_day_id;
      orderIndex = 0;
    }
    orderIndex++;
    const sessionId = sessionIdMap.get(tde.training_day_id)!;
    const exerciseId = exIdMap.get(tde.exercise_id)!;
    const r = insSe.run(sessionId, exerciseId, orderIndex, Math.max(1, tde.set_count), tde.finished);
    seIdMap.set(tde.id, Number(r.lastInsertRowid));
  }

  // 8. sets → sets
  const srcSets = src.prepare(`SELECT id, training_day_exercise_id, weight, reps FROM sets ORDER BY training_day_exercise_id, id`).all() as any[];
  const insSet = dst.prepare(`INSERT INTO sets (session_exercise_id, set_index, weight, reps, seconds) VALUES (?, ?, ?, ?, NULL)`);
  let lastTde = -1;
  let setIndex = 0;
  for (const s of srcSets) {
    if (s.training_day_exercise_id !== lastTde) {
      lastTde = s.training_day_exercise_id;
      setIndex = 0;
    }
    setIndex++;
    const seId = seIdMap.get(s.training_day_exercise_id)!;
    insSet.run(seId, setIndex, s.weight, s.reps);
  }

  console.log(`Imported ${srcPrograms.length} weeks, ${srcTd.length} sessions, ${srcTde.length} session_exercises, ${srcSets.length} sets.`);
});

txn();

src.close();
dst.close();
console.log('Done.');
```

- [ ] **Step 4: Mirror the schema as SQL for the script**

Create `scripts/schema-v2.sql` — copy each CREATE TABLE / CREATE INDEX statement from the `SCHEMA: string[]` array in `src/common/databaseService.ts`, separated by `;` and a newline. This is duplication of the schema-in-code, but the script needs raw SQL since it doesn't go through React Native.

(Maintainability note: any future schema change has to update both. Acceptable for v2; could be auto-generated later.)

- [ ] **Step 5: Smoke-test the script**

Run:
```bash
rm -f /tmp/test-import.db
npm run import:legacy -- ~/Downloads/warden-exported.db /tmp/test-import.db
sqlite3 /tmp/test-import.db "SELECT COUNT(*) FROM weeks; SELECT COUNT(*) FROM sessions; SELECT COUNT(*) FROM sets;"
```
Expected: `56`, `280`, `3640` (matches source counts).

- [ ] **Step 6: Commit**

```bash
git add scripts/ package.json package-lock.json
git commit -m "Add scripts/import-legacy.ts for one-shot v1 → v2 DB migration"
```

---

## Task 24: Update CLAUDE.md to reflect v2.0 reality

**Files:**
- Modify: `CLAUDE.md`

The v1 CLAUDE.md describes the old hardcoded schema, `variables.tsx`, A/B alternation, etc. — all wrong now.

- [ ] **Step 1: Rewrite relevant sections**

Replace the "Data model", "Static training catalogues", "Navigation", "Database access pattern" sections of CLAUDE.md with content that matches the v2 reality:

- Schema is plan-driven via `src/seeds/*.ts`, validated by `src/common/seedValidator.ts` on every app start
- New tables: `plans`, `session_templates`, `plan_days`, `session_template_exercises`, `exercises`, `weeks`, `sessions`, `session_exercises`, `sets`, `settings`
- `migrations.ts` no longer exists (clean-slate schema, no in-app migration)
- `Routes.tsx` builds Sessions top-tabs dynamically from `plan_days` for `active_plan_id`
- `fetchWeeksByPlan` is a 2-query fold (not N+1)
- Statistics aggregates in SQL with per-side correction
- Legacy data import via `npm run import:legacy <source.db> <target.db>` (CLI, not in-app)

Keep the Commands section accurate (still `yarn android`, `yarn lint`, etc.).

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md: rewrite for v2 plan-driven schema"
```

---

## Task 25: Release build + final commit

**Files:** none.

- [ ] **Step 1: Release build sanity-check**

Run:
```bash
cd android && ./gradlew assembleRelease
```
Expected: BUILD SUCCESSFUL, APK at `android/app/build/outputs/apk/release/app-release.apk`.

- [ ] **Step 2: Tag the release**

```bash
git tag v2.0.0
git log --oneline -10
```
Verify the v2.0.0 tag points at the most recent commit and `2.0.0` shows in `package.json`.

- [ ] **Step 3: Push (only if user authorizes)**

```bash
# Wait for user confirmation
git push origin master --tags
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| Goals — schema rework | Tasks 10, 11, 12 |
| Goals — first new plan "Surf" | Tasks 7, 8, 9 |
| Goals — structured prescription | Task 2 (types), 10 (DDL), 18 (UI) |
| Goals — single-query reads | Task 12 (fetchWeeksByPlan), 12 (fetchExerciseStats) |
| Goals — seed-via-TS-constants | Tasks 7, 8, 9, 11 |
| Non-Goals | Implicit (no tasks attempt these) |
| Migration: clean slate | Tasks 10 (no migration code) + 23 (CLI import) |
| Schema DDL | Task 10 |
| Indices | Task 10 |
| PRAGMA foreign_keys | Task 10 (in getDBConnection) |
| Seed format + validation | Tasks 2, 4, 5, 6, 7, 8, 9 |
| Seed load algorithm | Task 11 |
| Surf plan definition | Task 8 |
| Statistics SQL | Task 12 (fetchExerciseStats) + Task 19 (UI consumes it) |
| fetchWeeks SQL | Task 12 |
| CLI import | Task 23 |
| App code changes (per-file table) | Tasks 13-20 (each touched file has a task) |
| Out of scope | No tasks attempt these (correct) |

No gaps.

**Placeholder scan:** All "// see note above" placeholders in Task 8's example code are intentional invitations to fill in upper-body exercises from the user's screenshots — they're called out in Task 8's intro and the actual TS file has full content in Task 8 Step 1. No TBD/TODO/"implement later" anywhere.

**Type consistency check:**
- `Plan`, `Week`, `Session`, `ExerciseInstance`, `SetLog` — defined in Task 2, used consistently in Tasks 12, 16, 17, 18, 19.
- `fetchWeeksByPlan` returns `Week[]` — consumed by `Weeks.tsx` (Task 16) and `Session.tsx` (Task 17).
- `setSessionExerciseFinished(db, sessionExerciseId, finished)` — defined Task 12, used in Exercise.tsx Task 18.
- `updateSet(db, setId, patch)` — defined Task 12, used in Exercise.tsx Task 18.
- `fetchExerciseStats(db, slug)` returns `StatsPoint[]` — defined Task 12, consumed in Statistics.tsx Task 19.

All consistent.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-17-workout-warden-v2.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
