// src/common/calories.ts
//
// Pure calorie approximation: BMR-corrected MET formula. No RN imports so it
// runs unmocked under Jest (same rationale as activityStats/heatmapMath).
//
// kcal = MET × (BMR / 24) × hours — i.e. one hour at MET 1 equals one hour of
// resting metabolism. BMR via revised Harris-Benedict (Roza & Shizgal 1984).
// The result is an approximation by design; rendered values carry a ~ prefix.

import type {UserProfile} from './types';

/** MET per activity slug. Deliberately TS constants, not a seed/DB field:
 * kcal is computed in JS at write time, so a seed column would be migration
 * machinery with no consumer. calories.test.ts keeps this map in sync with
 * the ACTIVITIES seed. */
export const ACTIVITY_MET: Record<string, number> = {
  surf: 4.0,
  altinha: 5.0,
};

export const DEFAULT_ACTIVITY_MET = 4.0;

/** Resistance training including rests between sets. */
export const STRENGTH_MET = 4.0;

export function activityMet(slug: string): number {
  return ACTIVITY_MET[slug] ?? DEFAULT_ACTIVITY_MET;
}

export function bmrKcalPerDay(
  profile: UserProfile,
  currentYear: number,
): number {
  const age = currentYear - profile.birthYear;
  return profile.sex === 'male'
    ? 88.362 +
        13.397 * profile.weightKg +
        4.799 * profile.heightCm -
        5.677 * age
    : 447.593 +
        9.247 * profile.weightKg +
        3.098 * profile.heightCm -
        4.33 * age;
}

/** Rounded kcal for `minutes` at `met`, or null when profile/duration is
 * missing — NULL means "unknown", never 0. */
export function estimateKcal(
  met: number,
  minutes: number | null,
  profile: UserProfile | null,
  currentYear: number,
): number | null {
  if (profile == null || minutes == null || minutes <= 0) return null;
  return Math.round(
    ((met * bmrKcalPerDay(profile, currentYear)) / 24) * (minutes / 60),
  );
}

/** '455' or '123.5K' — compact display for large totals. */
export function formatKcal(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}
