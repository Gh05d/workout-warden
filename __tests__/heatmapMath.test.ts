import {
  currentWeekStreak,
  daysInLast,
  isoDate,
  startOfWeek,
} from '../src/components/heatmapMath';

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
