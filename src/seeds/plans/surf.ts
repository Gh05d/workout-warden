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
