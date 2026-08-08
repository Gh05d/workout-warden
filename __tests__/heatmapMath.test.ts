import {
  WEEKDAY_LABELS,
  completedScheduledWeekdays,
  currentWeekCells,
  currentWeekStreak,
  daysInLast,
  dayPaintPair,
  dayTotalCount,
  isoDate,
  startOfWeek,
  trainedAtLocalDay,
  weekdayIndexFromLabel,
  weekdaySetFromLabels,
} from '../src/components/heatmapMath';
import {activityColor, mixHexColors, planColor} from '../src/common/planColor';

// Helper: build a Set from YYYY-MM-DD strings.
const set = (...ds: string[]): Set<string> => new Set(ds);

describe('isoDate', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    // Construct with local-time components so timezone doesn't matter.
    const d = new Date(2026, 4, 18, 14, 30); // 2026-05-18 14:30 local
    expect(isoDate(d)).toBe('2026-05-18');
  });

  it('pads month and day to two digits', () => {
    const d = new Date(2026, 0, 3); // Jan 3
    expect(isoDate(d)).toBe('2026-01-03');
  });
});

describe('startOfWeek', () => {
  it('returns Monday when given any weekday', () => {
    // 2026-05-18 is a Monday — startOfWeek is itself.
    const monday = new Date(2026, 4, 18, 14, 30);
    expect(isoDate(startOfWeek(monday))).toBe('2026-05-18');

    // 2026-05-20 (Wednesday)
    expect(isoDate(startOfWeek(new Date(2026, 4, 20)))).toBe('2026-05-18');

    // 2026-05-24 (Sunday) — must roll back to Monday May 18, not forward.
    expect(isoDate(startOfWeek(new Date(2026, 4, 24)))).toBe('2026-05-18');
  });

  it('zeros the time component', () => {
    const d = startOfWeek(new Date(2026, 4, 22, 23, 59, 59));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

describe('currentWeekStreak', () => {
  // Wednesday so "current week" is unambiguous regardless of timezone quirks.
  const wednesday = new Date(2026, 4, 20); // 2026-05-20 Wed

  it('returns 0 when no training is logged', () => {
    expect(currentWeekStreak(set(), wednesday)).toBe(0);
  });

  it('counts the current week when it has a training day', () => {
    // 2026-05-18 is the Monday of the current week.
    expect(currentWeekStreak(set('2026-05-18'), wednesday)).toBe(1);
  });

  it('walks back consecutively across multiple weeks', () => {
    expect(
      currentWeekStreak(
        set('2026-05-19', '2026-05-12', '2026-05-05'),
        wednesday,
      ),
    ).toBe(3);
  });

  it('stops at the first gap', () => {
    // Has current week + 2 weeks ago, but missing 1 week ago → streak = 1.
    expect(currentWeekStreak(set('2026-05-19', '2026-05-05'), wednesday)).toBe(
      1,
    );
  });

  it('does not reset to 0 when the current week is empty but past weeks have training', () => {
    // Monday morning, nothing trained this week yet. Previous week was active.
    const mondayMorning = new Date(2026, 4, 18, 7, 0); // 2026-05-18 Mon 07:00
    expect(
      currentWeekStreak(
        set('2026-05-15', '2026-05-08', '2026-05-01'),
        mondayMorning,
      ),
    ).toBe(3);
  });

  it('returns 0 when neither current nor previous week has training', () => {
    const mondayMorning = new Date(2026, 4, 18, 7, 0);
    // Two-week gap before any training.
    expect(
      currentWeekStreak(set('2026-04-30', '2026-04-23'), mondayMorning),
    ).toBe(0);
  });

  it('counts the Sunday of a week as still that week', () => {
    // 2026-05-24 is a Sunday → still in week starting 2026-05-18.
    expect(currentWeekStreak(set('2026-05-24'), wednesday)).toBe(1);
  });

  it('handles a streak that crosses a month boundary', () => {
    // Mon 2026-04-27, Mon 2026-05-04, Mon 2026-05-11, Mon 2026-05-18.
    expect(
      currentWeekStreak(
        set('2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18'),
        wednesday,
      ),
    ).toBe(4);
  });
});

describe('daysInLast', () => {
  const today = new Date(2026, 4, 20); // 2026-05-20 Wed

  it('returns 0 for an empty set', () => {
    expect(daysInLast(30, set(), today)).toBe(0);
  });

  it('counts only days within the window', () => {
    // 30-day window from 2026-04-21..2026-05-20 inclusive.
    // 2026-04-20 is one day too early. 2026-05-20 (today) is in window.
    expect(
      daysInLast(
        30,
        set('2026-05-20', '2026-04-21', '2026-04-20', '2026-05-01'),
        today,
      ),
    ).toBe(3);
  });

  it('counts duplicates within the set as a single day (Set semantics)', () => {
    expect(daysInLast(30, set('2026-05-15', '2026-05-15'), today)).toBe(1);
  });

  it('respects the n parameter', () => {
    // n=7 → window 2026-05-14..2026-05-20.
    expect(
      daysInLast(7, set('2026-05-14', '2026-05-13', '2026-05-20'), today),
    ).toBe(2);
  });
});

describe('currentWeekCells', () => {
  // 2026-07-22 is a Wednesday; its ISO week runs Mon 2026-07-20 .. Sun 2026-07-26.
  const wednesday = new Date(2026, 6, 22);

  it('returns 7 cells labeled MO..SU', () => {
    const cells = currentWeekCells(new Map(), wednesday);
    expect(cells.map(c => c.label)).toEqual([...WEEKDAY_LABELS]);
    expect(cells).toHaveLength(7);
  });

  it('marks today and future days relative to today', () => {
    const cells = currentWeekCells(new Map(), wednesday);
    // MO,TU past; WE today; TH,FR,SA,SU future.
    expect(cells.map(c => c.isToday)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(cells.map(c => c.isFuture)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
  });

  it('resolves trained days and their plan from the data map', () => {
    const data = new Map([['2026-07-20', {planId: 3, count: 1}]]);
    const cells = currentWeekCells(data, wednesday);
    expect(cells[0].trained).toBe(true);
    expect(cells[0].planId).toBe(3);
    expect(cells[1].trained).toBe(false);
    expect(cells[1].planId).toBeNull();
  });

  it('leaves every day unscheduled when no schedule is given', () => {
    const cells = currentWeekCells(new Map(), wednesday);
    expect(cells.map(c => c.scheduled)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('flags scheduled weekdays from the given index set', () => {
    // Mon..Fri scheduled, weekend free — the Surf plans' shape.
    const cells = currentWeekCells(
      new Map(),
      wednesday,
      new Set([0, 1, 2, 3, 4]),
    );
    expect(cells.map(c => c.scheduled)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('reports a day as both trained and scheduled when it is both', () => {
    const data = new Map([['2026-07-20', {planId: 1, count: 1}]]);
    const cells = currentWeekCells(data, wednesday, new Set([0, 1]));
    expect(cells[0].trained).toBe(true);
    expect(cells[0].scheduled).toBe(true);
    // Tuesday is scheduled but not trained — the "quiet dot" case.
    expect(cells[1].trained).toBe(false);
    expect(cells[1].scheduled).toBe(true);
  });
});

describe('weekdayIndexFromLabel', () => {
  it('maps three-letter labels to Monday-first indices', () => {
    expect(weekdayIndexFromLabel('Mon')).toBe(0);
    expect(weekdayIndexFromLabel('Tue')).toBe(1);
    expect(weekdayIndexFromLabel('Wed')).toBe(2);
    expect(weekdayIndexFromLabel('Thu')).toBe(3);
    expect(weekdayIndexFromLabel('Fri')).toBe(4);
    expect(weekdayIndexFromLabel('Sat')).toBe(5);
    expect(weekdayIndexFromLabel('Sun')).toBe(6);
  });

  it('accepts full names, two-letter forms and mixed case', () => {
    expect(weekdayIndexFromLabel('Monday')).toBe(0);
    expect(weekdayIndexFromLabel('SUNDAY')).toBe(6);
    expect(weekdayIndexFromLabel('mo')).toBe(0);
    expect(weekdayIndexFromLabel('SU')).toBe(6);
    expect(weekdayIndexFromLabel('  thu  ')).toBe(3);
  });

  it('returns null for missing or unrecognised labels', () => {
    expect(weekdayIndexFromLabel(null)).toBeNull();
    expect(weekdayIndexFromLabel(undefined)).toBeNull();
    expect(weekdayIndexFromLabel('')).toBeNull();
    expect(weekdayIndexFromLabel('Day 1')).toBeNull();
  });
});

describe('trainedAtLocalDay', () => {
  it('treats bare SQLite datetimes as UTC, like DATE(..., "localtime")', () => {
    // datetime('now') stores 'YYYY-MM-DD HH:MM:SS' with no zone marker.
    expect(trainedAtLocalDay('2026-07-22 12:00:00')).toBe(
      isoDate(new Date('2026-07-22T12:00:00Z')),
    );
  });

  it('agrees with an explicit-zone ISO timestamp for the same instant', () => {
    expect(trainedAtLocalDay('2026-07-22 21:59:00')).toBe(
      trainedAtLocalDay('2026-07-22T21:59:00Z'),
    );
  });

  it('accepts minute-precision legacy datetimes', () => {
    // import-legacy fallback dates look like '2026-01-05 00:00'.
    expect(trainedAtLocalDay('2026-01-05 12:00')).toBe(
      isoDate(new Date('2026-01-05T12:00:00Z')),
    );
  });

  it('returns null for unparseable input', () => {
    expect(trainedAtLocalDay('not a date')).toBeNull();
  });
});

describe('completedScheduledWeekdays', () => {
  // 2026-07-22 is a Wednesday; its ISO week runs Mon 2026-07-20 .. Sun 2026-07-26.
  const today = new Date(2026, 6, 22, 15);
  // Midday-UTC timestamps keep the local calendar day equal to the UTC day for
  // any test-runner timezone within ±11 h, like the local constructions above.
  const at = (day: string) => `${day} 12:00:00`;

  const planDays = [
    {day_index: 1, weekday_label: 'Mon'},
    {day_index: 2, weekday_label: 'Tue'},
    {day_index: 3, weekday_label: 'Wed'},
    {day_index: 4, weekday_label: 'Thu'},
    {day_index: 5, weekday_label: 'Fri'},
  ];

  const session = (
    day_index: number,
    trained_at: string | null,
    finished: 0 | 1 = 1,
    weekday_label: string | null = null,
  ) => ({day_index, weekday_label, trained_at, finished});

  it('credits a finished session to its scheduled weekday, not the day it was trained', () => {
    // Tuesday's plan finished on Wednesday → Tuesday gets the mark.
    const s = completedScheduledWeekdays(
      [session(2, at('2026-07-22'))],
      planDays,
      today,
    );
    expect([...s]).toEqual([1]);
  });

  it('credits a session trained ahead of schedule to its future weekday', () => {
    // Friday's plan already done on Wednesday.
    const s = completedScheduledWeekdays(
      [session(5, at('2026-07-22'))],
      planDays,
      today,
    );
    expect([...s]).toEqual([4]);
  });

  it('collects every finished session of the week', () => {
    const s = completedScheduledWeekdays(
      [
        session(1, at('2026-07-20')),
        session(2, at('2026-07-22')),
        session(5, at('2026-07-22')),
      ],
      planDays,
      today,
    );
    expect([...s].sort()).toEqual([0, 1, 4]);
  });

  it('ignores unfinished sessions and sessions without a trained_at', () => {
    const s = completedScheduledWeekdays(
      [session(1, at('2026-07-20'), 0), session(2, null)],
      planDays,
      today,
    );
    expect(s.size).toBe(0);
  });

  it('ignores sessions trained outside the current ISO week', () => {
    // The week row is not calendar-anchored: a session finished last week must
    // not light up a fresh calendar week's strip.
    const s = completedScheduledWeekdays(
      [session(1, at('2026-07-15')), session(2, at('2026-07-29'))],
      planDays,
      today,
    );
    expect(s.size).toBe(0);
  });

  it("falls back to the session's own label when the plan no longer has its day", () => {
    const s = completedScheduledWeekdays(
      [session(9, at('2026-07-21'), 1, 'Sat')],
      planDays,
      today,
    );
    expect([...s]).toEqual([5]);
  });

  it('drops sessions whose day resolves to no weekday label', () => {
    // The Strength plan's plan_days carry no labels at all.
    const s = completedScheduledWeekdays(
      [session(1, at('2026-07-20'))],
      [{day_index: 1, weekday_label: null}],
      today,
    );
    expect(s.size).toBe(0);
  });
});

describe('weekdaySetFromLabels', () => {
  it('collects recognised labels and drops the rest', () => {
    const s = weekdaySetFromLabels(['Mon', 'Wed', null, 'garbage', 'Fri']);
    expect([...s].sort()).toEqual([0, 2, 4]);
  });

  it('returns an empty set for a plan without weekday labels', () => {
    // The Strength plan's plan_days carry no weekday_label at all.
    expect(weekdaySetFromLabels([null, null, null, null]).size).toBe(0);
  });

  it('de-duplicates repeated weekdays', () => {
    expect([...weekdaySetFromLabels(['Mon', 'Monday', 'MO'])]).toEqual([0]);
  });
});

describe('dayPaintPair', () => {
  it('returns null for an empty day', () => {
    expect(dayPaintPair({})).toBeNull();
    expect(dayPaintPair({activities: []})).toBeNull();
  });

  it('returns the plan pair for a plan-only day', () => {
    expect(dayPaintPair({plan: {planId: 1, count: 1}})).toEqual(planColor(1));
  });

  it('returns the activity pair for a single-activity day', () => {
    expect(dayPaintPair({activities: [{activityId: 2, count: 3}]})).toEqual(
      activityColor(2),
    );
  });

  it('blends plan + activity fgs and bgs on a mixed day', () => {
    const pair = dayPaintPair({
      plan: {planId: 1, count: 1},
      activities: [{activityId: 1, count: 1}],
    });
    expect(pair).toEqual({
      bg: mixHexColors([planColor(1).bg, activityColor(1).bg]),
      fg: mixHexColors([planColor(1).fg, activityColor(1).fg]),
    });
  });

  it('blends two different activities without a plan', () => {
    const pair = dayPaintPair({
      activities: [
        {activityId: 1, count: 1},
        {activityId: 2, count: 1},
      ],
    });
    expect(pair).toEqual({
      bg: mixHexColors([activityColor(1).bg, activityColor(2).bg]),
      fg: mixHexColors([activityColor(1).fg, activityColor(2).fg]),
    });
  });
});

describe('dayTotalCount', () => {
  it('sums plan and activity counts', () => {
    expect(dayTotalCount({})).toBe(0);
    expect(
      dayTotalCount({
        plan: {planId: 1, count: 2},
        activities: [
          {activityId: 1, count: 1},
          {activityId: 2, count: 3},
        ],
      }),
    ).toBe(6);
  });
});
