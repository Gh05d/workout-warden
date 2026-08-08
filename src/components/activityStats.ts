// src/components/activityStats.ts
//
// Pure ISO-week grouping/aggregation for activity sessions. Lives next to
// heatmapMath (same extraction rationale: unit-testable without React Native).

import type {ActivitySession} from '../common/types';
import {isoDate, startOfWeek} from './heatmapMath';

/** 'YYYY-MM-DD' → Date at local midnight. `new Date('YYYY-MM-DD')` would parse
 * as UTC and shift the calendar day for west-of-UTC users — never use it. */
export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** ISO-8601 week number (the week containing the year's first Thursday). */
export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export interface ActivityTotals {
  activityId: number;
  activityName: string;
  count: number;
  minutes: number;
}

export interface WeekGroup {
  key: string;
  label: string;
  sessions: ActivitySession[];
  totals: ActivityTotals[];
}

/** Fold newest-first sessions into ISO-week groups (newest week first —
 * input order is preserved, fetchActivitySessions already sorts DESC). */
export function groupByIsoWeek(sessions: ActivitySession[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  for (const s of sessions) {
    const day = parseIsoDate(s.performed_at);
    const monday = startOfWeek(day);
    const key = isoDate(monday);
    let group = map.get(key);
    if (!group) {
      // The ISO week-numbering year can differ from monday's calendar year
      // around New Year; anchor the label's year on the week's Thursday.
      const thursday = new Date(monday);
      thursday.setDate(monday.getDate() + 3);
      group = {
        key,
        label: `W${isoWeekNumber(monday)} ${thursday.getFullYear()}`,
        sessions: [],
        totals: [],
      };
      map.set(key, group);
    }
    group.sessions.push(s);
    let t = group.totals.find(x => x.activityId === s.activity_id);
    if (!t) {
      t = {
        activityId: s.activity_id,
        activityName: s.activity_name,
        count: 0,
        minutes: 0,
      };
      group.totals.push(t);
      group.totals.sort((a, b) => a.activityId - b.activityId);
    }
    t.count += 1;
    t.minutes += s.duration_minutes ?? 0;
  }
  return Array.from(map.values());
}

/** 'SURF 3× / 5.0H · ALTINHA 1×' — hours omitted when nothing was timed. */
export function formatTotals(totals: ActivityTotals[]): string {
  return totals
    .map(t => {
      const hours = t.minutes > 0 ? ` / ${(t.minutes / 60).toFixed(1)}H` : '';
      return `${t.activityName.toUpperCase()} ${t.count}×${hours}`;
    })
    .join(' · ');
}
