import type {PlanSeed} from '../../common/types';

// Surf 2.0 — research-driven successor to the original `surf` plan.
// Rationale and evidence grading live in docs/research/ (README.md indexes it).
// Design intent, condensed:
//   - Daily low-back / hip anchor  ....... ruecken-huefte.md  (LBP is the top overuse zone)
//   - Jumps for turn power  .............. surf-conditioning.md (lower-body power ↔ turns)
//   - Rotation / anti-rotation  .......... surf-conditioning.md (board control, kinetic chain)
//   - Shoulder ER + thoracic extension ... surf-conditioning.md (paddle IR/ER imbalance)
//   - Calf/Achilles + reactive jumps ..... altinha-belastungsprofil.md (sand under-loads these)
//   - Minimal effective dose, ~30 min .... recovery-periodisierung.md (~15 h sport/week already)
// The old `surf` plan is left untouched; switch via PlanSwitcher.
export const SURF2: PlanSeed = {
  slug: 'surf-2',
  name: 'Surf 2.0',
  description: 'Research-driven 5-day surf plan — power, shoulder balance, low-back/hip prevention',
  session_templates: [
    {
      slug: 'surf2-power-mon',
      name: 'Power + Posterior',
      exercises: [
        {exercise_slug: 'backward-walking',          order_index: 1, prescribed_sets: 1, prescribed_seconds: 300, hint: 'Walk backwards for 5 Mins'},
        {exercise_slug: 'squat-jump',                order_index: 2, prescribed_sets: 4, prescribed_reps: 5,  hint: 'Firm ground — max height, soft landing, full reset between reps'},
        // Volume kept low on purpose: 6 h/week of sand jumping already loads calf/Achilles
        {exercise_slug: 'pogo-hops',                 order_index: 3, prescribed_sets: 2, prescribed_reps: 15},
        {exercise_slug: 'atg-split-squat',           order_index: 4, prescribed_sets: 3, prescribed_reps: 6, per_side: true, hint: 'Neutral pelvis — do NOT arch the lower back'},
        {exercise_slug: 'glute-bridge-single-leg',   order_index: 5, prescribed_sets: 3, prescribed_reps: 10, per_side: true},

        // Core anchor, 2 rounds
        {exercise_slug: 'bird-dog',                  order_index: 6, prescribed_sets: 1, prescribed_reps: 8, per_side: true,   circuit_index: 1, circuit_rounds: 2},
        {exercise_slug: 'side-plank',                order_index: 7, prescribed_sets: 1, prescribed_seconds: 30, per_side: true, circuit_index: 1, circuit_rounds: 2},

        // Hamstring length + lumbar ROM — spread Mon/Wed/Fri, not bunched on the mobility day
        {exercise_slug: 'elephant-walk',             order_index: 8, prescribed_sets: 2, prescribed_reps: 20, per_side: true},
        {exercise_slug: 'couch-stretch',             order_index: 9, prescribed_sets: 1, prescribed_seconds: 60, per_side: true, hint: '1 Min Per Side'},
      ],
    },
    {
      slug: 'surf2-push-tue',
      name: 'Push + Shoulder',
      exercises: [
        {exercise_slug: 'band-pull-apart',           order_index: 1, prescribed_sets: 2, prescribed_reps: 20},
        {exercise_slug: 'atg-pushup',                order_index: 2, prescribed_sets: 4, prescribed_reps: 8, hint: 'Pop-up strength — control the descent'},
        // Second pull slot — one row per week is thin against 7.5-9 h/week of paddling
        {exercise_slug: 'atg-row',                   order_index: 3, prescribed_sets: 3, prescribed_reps: 12},
        {exercise_slug: 'band-overhead-press',       order_index: 4, prescribed_sets: 3, prescribed_reps: 10},

        // Shoulder-prevention circuit, 3 rounds — stretch internal rotators, strengthen external
        {exercise_slug: 'external-rotation',         order_index: 5, prescribed_sets: 1, prescribed_reps: 15, per_side: true, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'pigeon-pushup',             order_index: 6, prescribed_sets: 1, prescribed_reps: 10,                  circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'cross-body-shoulder-stretch', order_index: 7, prescribed_sets: 1, prescribed_seconds: 30, per_side: true, circuit_index: 1, circuit_rounds: 3},

        {exercise_slug: 'pallof-press',              order_index: 8, prescribed_sets: 3, prescribed_reps: 10, per_side: true},
      ],
    },
    {
      slug: 'surf2-rotation-wed',
      name: 'Rotation + Mobility',
      exercises: [
        {exercise_slug: 'band-rotation',             order_index: 1, prescribed_sets: 3, prescribed_reps: 10, per_side: true},
        {exercise_slug: 'dead-bug',                  order_index: 2, prescribed_sets: 3, prescribed_reps: 8, per_side: true},
        {exercise_slug: 'jefferson-curl',            order_index: 3, prescribed_sets: 3, prescribed_reps: 8, hint: 'Light load — roll down slowly, vertebra by vertebra'},

        // Mobility circuit, 2 rounds
        {exercise_slug: 'resting-squat',             order_index: 4, prescribed_sets: 1, prescribed_seconds: 60,               circuit_index: 1, circuit_rounds: 2},
        {exercise_slug: 'standing-pancake-pulse',    order_index: 5, prescribed_sets: 1, prescribed_reps: 20,                  circuit_index: 1, circuit_rounds: 2},
        {exercise_slug: 'elephant-walk',             order_index: 6, prescribed_sets: 1, prescribed_reps: 20, per_side: true,  circuit_index: 1, circuit_rounds: 2},
        {exercise_slug: 'big-toe-stretch',           order_index: 7, prescribed_sets: 1, prescribed_seconds: 30,               circuit_index: 1, circuit_rounds: 2},
      ],
    },
    {
      slug: 'surf2-strength-thu',
      name: 'Strength + Calves',
      exercises: [
        {exercise_slug: 'backward-walking',          order_index: 1, prescribed_sets: 1, prescribed_seconds: 300, hint: 'Walk backwards for 5 Mins'},
        {exercise_slug: 'reverse-step-up',           order_index: 2, prescribed_sets: 3, prescribed_reps: 6, per_side: true},
        // Start conservative — Nordic DOMS would eat into surfing/altinha. Add a rep when 2x3 feels easy.
        {exercise_slug: 'nordic',                    order_index: 3, prescribed_sets: 2, prescribed_reps: 3, hint: 'Start here — only add reps once this leaves no soreness'},

        // Calf pair, 3 rounds — sand under-loads the gastrocnemius/soleus
        {exercise_slug: 'straight-leg-calf-raise',   order_index: 4, prescribed_sets: 1, prescribed_reps: 20, circuit_index: 1, circuit_rounds: 3},
        {exercise_slug: 'bent-leg-calf-raise',       order_index: 5, prescribed_sets: 1, prescribed_reps: 15, circuit_index: 1, circuit_rounds: 3},

        {exercise_slug: 'tibialis-raise',            order_index: 6, prescribed_sets: 2, prescribed_reps: 25, as_maximum: true},

        // Core anchor, 2 rounds
        {exercise_slug: 'mcgill-curlup',             order_index: 7, prescribed_sets: 1, prescribed_reps: 8,                  circuit_index: 2, circuit_rounds: 2},
        {exercise_slug: 'ql-extension',              order_index: 8, prescribed_sets: 1, prescribed_reps: 12, per_side: true, circuit_index: 2, circuit_rounds: 2},

        {exercise_slug: 'hip-flexors',               order_index: 9, prescribed_sets: 1, prescribed_seconds: 60, per_side: true, hint: '1 Min Per Side'},
      ],
    },
    {
      slug: 'surf2-pull-fri',
      name: 'Pull + Posterior',
      exercises: [
        {exercise_slug: 'band-pull-apart',           order_index: 1, prescribed_sets: 2, prescribed_reps: 20},
        {exercise_slug: 'atg-row',                   order_index: 2, prescribed_sets: 4, prescribed_reps: 12},
        {exercise_slug: 'external-rotation',         order_index: 3, prescribed_sets: 3, prescribed_reps: 15, per_side: true},
        {exercise_slug: 'superman',                  order_index: 4, prescribed_sets: 3, prescribed_reps: 15},
        {exercise_slug: 'glute-bridge-single-leg',   order_index: 5, prescribed_sets: 3, prescribed_reps: 12, per_side: true},

        // Finisher circuit, 2 rounds
        {exercise_slug: 'side-plank',                order_index: 6, prescribed_sets: 1, prescribed_seconds: 30, per_side: true, circuit_index: 1, circuit_rounds: 2},
        {exercise_slug: 'wall-pullover',             order_index: 7, prescribed_sets: 1, prescribed_reps: 15,                    circuit_index: 1, circuit_rounds: 2},
        {exercise_slug: 'elephant-walk',             order_index: 8, prescribed_sets: 1, prescribed_reps: 20, per_side: true,    circuit_index: 1, circuit_rounds: 2},
      ],
    },
  ],
  days: [
    {day_index: 1, weekday_label: 'Mon', session_template_slug: 'surf2-power-mon'},
    {day_index: 2, weekday_label: 'Tue', session_template_slug: 'surf2-push-tue'},
    {day_index: 3, weekday_label: 'Wed', session_template_slug: 'surf2-rotation-wed'},
    {day_index: 4, weekday_label: 'Thu', session_template_slug: 'surf2-strength-thu'},
    {day_index: 5, weekday_label: 'Fri', session_template_slug: 'surf2-pull-fri'},
  ],
};
