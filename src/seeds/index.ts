import type {ExerciseSeed, PlanSeed} from '../common/types';
import {EXERCISES as EXERCISES_LIST} from './exercises';
import {SURF} from './plans/surf';
import {SURF2} from './plans/surf-2';
import {STRENGTH} from './plans/strength';

export const EXERCISES: readonly ExerciseSeed[] = EXERCISES_LIST;
export const PLANS: readonly PlanSeed[] = [SURF, SURF2, STRENGTH];

// Bump this whenever a plan's *prescriptions* change — exercise selection, sets,
// reps, order, circuits or hints. session_templates are otherwise write-once, so
// without a bump an already-seeded device keeps the old prescriptions forever.
//
// On a bump, seedDB rewrites session_template_exercises and plan_days for every
// plan. User data is NOT touched: weeks/sessions/sets hang off session_exercises,
// which is a copy taken when the week was created.
//
// Not needed for exercise name/video/description — those upsert on every start.
//
// Also needed when a plan's `days` change — the day→template mapping and
// `weekday_label` are rewritten on a bump too.
//
// 1 = initial v2 schema · 2 = Surf 2.0 corrections (mobility spread, single-leg
//     RDL instead of Nordic, execution hints) · 3 = Strength gains Mon–Fri
//     weekday labels, so the Home strip can tell its training days from rest
//     days (Surf/Surf 2 already had them)
export const SEED_REVISION = 3;
