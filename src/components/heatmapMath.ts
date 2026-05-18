// src/components/heatmapMath.ts
//
// Pure date / streak helpers extracted from HeatmapCard so they can be unit-
// tested without pulling in React Native. All dates are LOCAL time — the
// caller must produce `today` from the device's local Date.

/** YYYY-MM-DD in local time, matching SQLite's `DATE(..., 'localtime')` output. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns the Monday on-or-before `d` at 00:00 local. Monday is the start of
 * the ISO week. JS Sunday = 0, so we map Sunday → 7 first. */
export function startOfWeek(d: Date): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  const dow = result.getDay() || 7; // Sun(0) -> 7
  result.setDate(result.getDate() - (dow - 1));
  return result;
}

/** Returns `true` if any of the 7 dates in the week starting at `mondayStart`
 * appear in `trained`. */
function weekHasTraining(mondayStart: Date, trained: Set<string>): boolean {
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayStart);
    d.setDate(mondayStart.getDate() + i);
    if (trained.has(isoDate(d))) return true;
  }
  return false;
}

/** Number of consecutive ISO weeks (Mon..Sun) ending at the current week that
 * had at least one trained day. Special-case: if the current week is still
 * empty (e.g. it's Monday morning and the user hasn't trained yet), we don't
 * reset the streak to 0 — instead we start the walk at the *previous* week,
 * so a long-standing streak stays visible until the user's typical training
 * day arrives. */
export function currentWeekStreak(trained: Set<string>, today: Date): number {
  let cursor = startOfWeek(today);
  if (!weekHasTraining(cursor, trained)) {
    // current week empty — try previous week as the streak's "current" cell
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 7);
    if (!weekHasTraining(cursor, trained)) return 0;
  }
  let streak = 0;
  while (weekHasTraining(cursor, trained)) {
    streak++;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

/** Count of distinct days in the inclusive window `(today - (n-1)) .. today`
 * that are present in `trained`. */
export function daysInLast(
  n: number,
  trained: Set<string>,
  today: Date,
): number {
  let count = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (trained.has(isoDate(d))) count++;
  }
  return count;
}
