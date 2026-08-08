import type {ActivitySession} from '../src/common/types';
import {
  formatTotals,
  groupByIsoWeek,
  isoWeekNumber,
  parseIsoDate,
  weeklyBarData,
  UNTIMED_PLINTH_MINUTES,
} from '../src/components/activityStats';

function sess(over: Partial<ActivitySession>): ActivitySession {
  return {
    id: 1,
    activity_id: 1,
    activity_slug: 'surf',
    activity_name: 'Surf',
    performed_at: '2026-08-05',
    duration_minutes: null,
    spot: null,
    note: null,
    created_at: '2026-08-05 12:00:00',
    ...over,
  };
}

describe('parseIsoDate / isoWeekNumber', () => {
  it('parses as local midnight', () => {
    const d = parseIsoDate('2026-08-05');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 5]);
    expect(d.getHours()).toBe(0);
  });

  it('computes ISO week numbers across year edges', () => {
    expect(isoWeekNumber(parseIsoDate('2026-08-05'))).toBe(32);
    expect(isoWeekNumber(parseIsoDate('2026-01-01'))).toBe(1);
    expect(isoWeekNumber(parseIsoDate('2027-01-01'))).toBe(53); // Fri → ISO week 53 of 2026
  });
});

describe('groupByIsoWeek', () => {
  it('groups sessions into ISO weeks, newest week first', () => {
    const groups = groupByIsoWeek([
      sess({id: 3, performed_at: '2026-08-05', duration_minutes: 90}),
      sess({
        id: 2,
        performed_at: '2026-08-03',
        activity_id: 2,
        activity_name: 'Altinha',
        activity_slug: 'altinha',
        duration_minutes: 120,
      }),
      sess({id: 1, performed_at: '2026-07-28', duration_minutes: 60}),
    ]);
    expect(groups.map(g => g.key)).toEqual(['2026-08-03', '2026-07-27']);
    expect(groups[0].label).toBe('W32 2026');
    expect(groups[0].sessions.map(s => s.id)).toEqual([3, 2]);
    expect(groups[0].totals).toEqual([
      {activityId: 1, activityName: 'Surf', count: 1, minutes: 90},
      {activityId: 2, activityName: 'Altinha', count: 1, minutes: 120},
    ]);
  });

  it('counts untimed sessions without minutes', () => {
    const [g] = groupByIsoWeek([
      sess({id: 1, duration_minutes: 60}),
      sess({id: 2, duration_minutes: null}),
    ]);
    expect(g.totals).toEqual([
      {activityId: 1, activityName: 'Surf', count: 2, minutes: 60},
    ]);
  });
});

describe('formatTotals', () => {
  it('formats counts and hours, omitting hours at 0 minutes', () => {
    expect(
      formatTotals([
        {activityId: 1, activityName: 'Surf', count: 3, minutes: 300},
        {activityId: 2, activityName: 'Altinha', count: 1, minutes: 0},
      ]),
    ).toBe('SURF 3× / 5.0H · ALTINHA 1×');
  });
});

describe('weeklyBarData', () => {
  const today = parseIsoDate('2026-08-05'); // Wednesday, ISO week 32

  it('returns one bar per week incl. empty gap weeks, oldest first', () => {
    const bars = weeklyBarData(
      [
        sess({id: 1, performed_at: '2026-08-04', duration_minutes: 90}),
        sess({id: 2, performed_at: '2026-07-20', duration_minutes: 60}),
      ],
      today,
      4,
    );
    expect(bars.map(b => b.label)).toEqual(['W29', 'W30', 'W31', 'W32']);
    expect(bars[0].totalMinutes).toBe(0); // W29 empty
    expect(bars[1].totalMinutes).toBe(60); // 2026-07-20 is the Monday of W30
    expect(bars[2].totalMinutes).toBe(0);
    expect(bars[3].totalMinutes).toBe(90);
  });

  it('stacks per activity and adds the plinth for untimed sessions', () => {
    const bars = weeklyBarData(
      [
        sess({id: 1, performed_at: '2026-08-04', duration_minutes: 90}),
        sess({
          id: 2,
          performed_at: '2026-08-05',
          activity_id: 2,
          activity_name: 'Altinha',
          activity_slug: 'altinha',
          duration_minutes: null,
        }),
      ],
      today,
      1,
    );
    expect(bars).toHaveLength(1);
    expect(bars[0].segments).toEqual([
      {activityId: 1, minutes: 90},
      {activityId: 2, minutes: UNTIMED_PLINTH_MINUTES},
    ]);
    expect(bars[0].totalMinutes).toBe(90 + UNTIMED_PLINTH_MINUTES);
  });

  it('ignores sessions older than the window', () => {
    const bars = weeklyBarData(
      [sess({id: 1, performed_at: '2026-01-05', duration_minutes: 60})],
      today,
      2,
    );
    expect(bars.every(b => b.totalMinutes === 0)).toBe(true);
  });
});
