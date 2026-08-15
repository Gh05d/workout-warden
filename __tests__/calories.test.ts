import {
  ACTIVITY_MET,
  activityMet,
  bmrKcalPerDay,
  DEFAULT_ACTIVITY_MET,
  estimateKcal,
  formatKcal,
  STRENGTH_MET,
} from '../src/common/calories';
import {ACTIVITIES} from '../src/seeds/activities';
import type {UserProfile} from '../src/common/types';

const MALE: UserProfile = {
  weightKg: 80,
  heightCm: 180,
  birthYear: 1990,
  sex: 'male',
  sessionMinutes: 60,
};
const FEMALE: UserProfile = {
  weightKg: 60,
  heightCm: 165,
  birthYear: 1992,
  sex: 'female',
  sessionMinutes: 60,
};

describe('bmrKcalPerDay (revised Harris-Benedict)', () => {
  it('male: 80kg/180cm/age 36', () => {
    // 88.362 + 13.397*80 + 4.799*180 - 5.677*36
    expect(bmrKcalPerDay(MALE, 2026)).toBeCloseTo(1819.57, 2);
  });

  it('female: 60kg/165cm/age 34', () => {
    // 447.593 + 9.247*60 + 3.098*165 - 4.330*34
    expect(bmrKcalPerDay(FEMALE, 2026)).toBeCloseTo(1366.36, 2);
  });
});

describe('estimateKcal', () => {
  it('MET 4.0 for 90 min, male profile → 455', () => {
    // 4.0 * (1819.57/24) * 1.5 = 454.89…
    expect(estimateKcal(4.0, 90, MALE, 2026)).toBe(455);
  });

  it('MET 5.0 for 60 min, female profile → 285', () => {
    expect(estimateKcal(5.0, 60, FEMALE, 2026)).toBe(285);
  });

  it('returns null without a profile', () => {
    expect(estimateKcal(4.0, 90, null, 2026)).toBeNull();
  });

  it('returns null without a duration', () => {
    expect(estimateKcal(4.0, null, MALE, 2026)).toBeNull();
    expect(estimateKcal(4.0, 0, MALE, 2026)).toBeNull();
  });

  it('returns null for an implausible profile that drives BMR negative', () => {
    const nonsense: UserProfile = {
      weightKg: 1,
      heightCm: 1,
      birthYear: 1900,
      sex: 'male',
      sessionMinutes: 60,
    };
    expect(estimateKcal(4.0, 60, nonsense, 2026)).toBeNull();
  });
});

describe('MET table', () => {
  it('covers every seeded activity slug', () => {
    for (const a of ACTIVITIES) {
      expect(ACTIVITY_MET[a.slug]).toBeGreaterThan(0);
    }
  });

  it('falls back to the default for unknown slugs', () => {
    expect(activityMet('spikeball')).toBe(DEFAULT_ACTIVITY_MET);
    expect(activityMet('surf')).toBe(ACTIVITY_MET.surf);
  });

  it('has a strength MET', () => {
    expect(STRENGTH_MET).toBeGreaterThan(0);
  });
});

describe('formatKcal', () => {
  it('renders small totals verbatim', () => {
    expect(formatKcal(455)).toBe('455');
    expect(formatKcal(9999)).toBe('9999');
  });

  it('compacts totals from 10k up', () => {
    expect(formatKcal(123456)).toBe('123.5K');
    expect(formatKcal(10000)).toBe('10.0K');
  });
});
