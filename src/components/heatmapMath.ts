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

/** Weekday initials, Monday-first — index 0 aligns with `startOfWeek` (Monday)
 * and with `HeatmapCard`'s grid rows. */
export const WEEKDAY_LABELS: readonly string[] = [
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
  'SU',
];

// Two-letter prefixes are unique across the seven English weekday names, so a
// single table resolves 'Mon', 'Monday', 'MO' and 'monday' alike. Index 0 is
// Monday, matching WEEKDAY_LABELS and startOfWeek.
const WEEKDAY_PREFIXES = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

/** Monday-first index (0..6) for a plan_days/session `weekday_label`, or null
 * when the label is missing or unrecognised. Plans are free to omit weekday
 * labels entirely (the Strength plan does), so null is an expected result, not
 * an error. */
export function weekdayIndexFromLabel(
  label: string | null | undefined,
): number | null {
  if (!label) return null;
  const key = label.trim().toLowerCase().slice(0, 2);
  const idx = WEEKDAY_PREFIXES.indexOf(key);
  return idx === -1 ? null : idx;
}

/** The set of Monday-first weekday indices a plan schedules training on, from
 * its `plan_days.weekday_label` values. Unrecognised/absent labels are dropped,
 * so a plan without labels yields an empty set (= "schedule unknown"). */
export function weekdaySetFromLabels(
  labels: ReadonlyArray<string | null | undefined>,
): Set<number> {
  const days = new Set<number>();
  for (const label of labels) {
    const idx = weekdayIndexFromLabel(label);
    if (idx != null) days.add(idx);
  }
  return days;
}

export interface WeekDayCell {
  key: string; // isoDate of the day
  label: string; // WEEKDAY_LABELS[i]
  isToday: boolean;
  isFuture: boolean;
  trained: boolean;
  planId: number | null; // dominant plan trained that day, else null
  scheduled: boolean; // the active plan schedules training on this weekday
}

/** The seven cells (Mon..Sun) of the ISO week containing `today`, resolved
 * against the heatmap `data` map. Structurally typed on the map value so it
 * stays decoupled from databaseService's HeatmapDatum.
 *
 * `scheduledWeekdays` (Monday-first indices, see `weekdaySetFromLabels`) marks
 * which weekdays the active plan trains on; omit it — or pass an empty set —
 * when the plan carries no weekday labels, and every day reports
 * `scheduled: false`. */
export function currentWeekCells(
  data: Map<string, {planId: number}>,
  today: Date,
  scheduledWeekdays?: ReadonlySet<number>,
): WeekDayCell[] {
  const monday = startOfWeek(today);
  const todayKey = isoDate(today);
  const cells: WeekDayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = isoDate(d);
    const datum = data.get(key);
    cells.push({
      key,
      label: WEEKDAY_LABELS[i],
      isToday: key === todayKey,
      isFuture: d > today,
      trained: !!datum,
      planId: datum ? datum.planId : null,
      scheduled: scheduledWeekdays ? scheduledWeekdays.has(i) : false,
    });
  }
  return cells;
}
