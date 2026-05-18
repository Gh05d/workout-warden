import {validateSeed} from '../src/common/seedValidator';

const validExercise = {slug: 'vmo-squat', name: 'VMO Squat'};
const validPrescription = {
  exercise_slug: 'vmo-squat',
  order_index: 1,
  prescribed_sets: 1,
  prescribed_reps: 20,
};

function bundle(overrides: any = {}) {
  // Deep-clone so per-test mutations don't leak into the shared seed objects
  // above (each test takes a fresh copy of the validExercise / validPrescription
  // graph via JSON round-trip).
  return JSON.parse(
    JSON.stringify({
      exercises: [validExercise],
      plans: [
        {
          slug: 'p1',
          name: 'Plan 1',
          session_templates: [
            {slug: 't1', name: 'T1', exercises: [validPrescription]},
          ],
          days: [{day_index: 1, session_template_slug: 't1'}],
        },
      ],
      ...overrides,
    }),
  );
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
