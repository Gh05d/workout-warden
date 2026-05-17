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
