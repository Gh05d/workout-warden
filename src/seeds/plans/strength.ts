import type {PlanSeed} from '../../common/types';

// Reconstructed from v1 `training.A` in `src/common/variables.tsx`
// (commit 604f657~1). Only the A-week is modelled here; B-week alternation
// is left as a future feature. v1 `next: true` chains are folded into
// `circuit_index` groups with `circuit_rounds` = original prescribed_sets,
// and each circuit member's `prescribed_sets` collapses to 1.
export const STRENGTH: PlanSeed = {
  slug: 'strength',
  name: 'Strength',
  description: '5-day classic A/B split — legs / upper / mobility (from v1, A-week only)',
  session_templates: [
    {
      slug: 'strength-reverse-step-up-leg-day',
      name: 'Reverse Step Up Leg Day',
      exercises: [
        {exercise_slug: 'sled',                order_index: 1, prescribed_sets: 1, prescribed_seconds: 300, per_side: false, as_maximum: false},
        {exercise_slug: 'poliquin-step-up',    order_index: 2, prescribed_sets: 3, prescribed_reps: 15,     per_side: false, as_maximum: false},

        // Circuit: Split Squad + Seated Goodmorning, 3 rounds
        {exercise_slug: 'split-squad',         order_index: 3, prescribed_sets: 1, prescribed_reps: 8,      per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'seated-goodmorning',  order_index: 4, prescribed_sets: 1, prescribed_reps: 10,     per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
      ],
    },
    {
      slug: 'strength-chest-pressing-upper-body-day',
      name: 'Chest Pressing Upper Body Day',
      exercises: [
        // Circuit: Chest Press + Tibialis Raise + Pullup + Straight Leg Calf Raise, 3 rounds
        {exercise_slug: 'chest-press',             order_index: 1, prescribed_sets: 1, prescribed_reps: 8,  per_side: false, as_maximum: false, hint: 'per hand', circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'tibialis-raise',          order_index: 2, prescribed_sets: 1, prescribed_reps: 20, per_side: false, as_maximum: false,                   circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'pullup',                  order_index: 3, prescribed_sets: 1, prescribed_reps: 10, per_side: false, as_maximum: false,                   circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'straight-leg-calf-raise', order_index: 4, prescribed_sets: 1, prescribed_reps: 10, per_side: false, as_maximum: false,                   circuit_index: 1, circuit_rounds: 3},
      ],
    },
    {
      slug: 'strength-mobility-day',
      name: 'Mobility Day',
      exercises: [
        // Circuit: Pigeon Pushup + Butterfly Stretch + Jefferson Curl + Couch Stretch Lounge + Pullover, 3 rounds
        {exercise_slug: 'pigeon-pushup',       order_index: 1, prescribed_sets: 1, prescribed_reps: 20, per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'butterfly-stretch',   order_index: 2, prescribed_sets: 1, prescribed_reps: 20, per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'jefferson-curl',      order_index: 3, prescribed_sets: 1, prescribed_reps: 10, per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'couch-stretch-lounge', order_index: 4, prescribed_sets: 1, prescribed_reps: 8,  per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'pullover',            order_index: 5, prescribed_sets: 1, prescribed_reps: 10, per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
      ],
    },
    {
      slug: 'strength-split-squat-leg-day',
      name: 'Split Squat Leg Day',
      exercises: [
        {exercise_slug: 'sled',          order_index: 1, prescribed_sets: 1, prescribed_seconds: 300, per_side: false, as_maximum: false},
        {exercise_slug: 'split-squad',   order_index: 2, prescribed_sets: 3, prescribed_reps: 10,     per_side: false, as_maximum: false},

        // Circuit: Nordic + Hip Flexors + Reverse Nordic, 3 rounds
        {exercise_slug: 'nordic',         order_index: 3, prescribed_sets: 1, prescribed_reps: 5,  per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'hip-flexors',    order_index: 4, prescribed_sets: 1, prescribed_reps: 20, per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'reverse-nordic', order_index: 5, prescribed_sets: 1, prescribed_reps: 8,  per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
      ],
    },
    {
      slug: 'strength-shoulder-pressing-upper-body-day',
      name: 'Shoulder Pressing Upper Body Day',
      exercises: [
        // Circuit: Shoulder Press + Tibialis Raise + External Rotation + Bent Leg Calf Raise + Neck Flexion, 3 rounds
        {exercise_slug: 'shoulder-press',      order_index: 1, prescribed_sets: 1, prescribed_reps: 10, per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'tibialis-raise',      order_index: 2, prescribed_sets: 1, prescribed_reps: 20, per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'external-rotation',   order_index: 3, prescribed_sets: 1, prescribed_reps: 8,  per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'bent-leg-calf-raise', order_index: 4, prescribed_sets: 1, prescribed_reps: 15, per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'neck-flexion',        order_index: 5, prescribed_sets: 1, prescribed_reps: 10, per_side: false, as_maximum: false, circuit_index: 1, circuit_rounds: 3},
      ],
    },
  ],
  days: [
    {day_index: 1, session_template_slug: 'strength-reverse-step-up-leg-day'},
    {day_index: 2, session_template_slug: 'strength-chest-pressing-upper-body-day'},
    {day_index: 3, session_template_slug: 'strength-mobility-day'},
    {day_index: 4, session_template_slug: 'strength-split-squat-leg-day'},
    {day_index: 5, session_template_slug: 'strength-shoulder-pressing-upper-body-day'},
  ],
};
