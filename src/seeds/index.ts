import type {ExerciseSeed, PlanSeed} from '../common/types';
import {EXERCISES as EXERCISES_LIST} from './exercises';
import {SURF} from './plans/surf';
import {STANDARD} from './plans/standard';

export const EXERCISES: readonly ExerciseSeed[] = EXERCISES_LIST;
export const PLANS: readonly PlanSeed[] = [SURF, STANDARD];
