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
