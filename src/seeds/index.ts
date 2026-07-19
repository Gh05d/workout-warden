import type {ExerciseSeed, PlanSeed} from '../common/types';
import {EXERCISES as EXERCISES_LIST} from './exercises';
import {SURF} from './plans/surf';
import {SURF2} from './plans/surf-2';
import {STRENGTH} from './plans/strength';

export const EXERCISES: readonly ExerciseSeed[] = EXERCISES_LIST;
export const PLANS: readonly PlanSeed[] = [SURF, SURF2, STRENGTH];
