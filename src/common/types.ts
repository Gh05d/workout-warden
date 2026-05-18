// src/common/types.ts
// Shared types for v2.0 plan-driven schema. Consumers must use explicit
// `import type {...} from '../common/types'` — this file is a module
// (because of the trailing `export type {...}` block), not an ambient
// declaration file, so the bare `interface` keywords below do NOT register
// as global names.

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
