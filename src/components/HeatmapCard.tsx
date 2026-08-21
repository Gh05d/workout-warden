// src/components/HeatmapCard.tsx
//
// Home-screen Activity heatmap: GitHub-style grid showing trained days over
// the last 16 weeks plus a current-streak readout. Plan-agnostic — every
// plan's sessions feed into the same grid.

import React from 'react';
import {StyleSheet, View, useWindowDimensions} from 'react-native';
import Reanimated, {FadeIn} from 'react-native-reanimated';

import AppText from './AppText';
import {colors} from '../common/theme';
import {activityColor, diagonalBands, planColor} from '../common/planColor';
import type {HeatmapDatum} from '../common/databaseService';
import type {Activity, Plan} from '../common/types';
import {
  currentWeekStreak,
  daysInLast,
  dayPaintBands,
  dayTotalCount,
  isoDate,
  startOfWeek,
  WEEKDAY_LABELS,
  type ActivityDayEntry,
  type DaySources,
} from './heatmapMath';

interface Props {
  /** Map of YYYY-MM-DD (local date) → {count, dominant planId}, covering at
   * least the last 16 weeks. Days not in the map render as empty cells. */
  data: Map<string, HeatmapDatum>;
  /** All plans, used to name the color legend. */
  plans: Plan[];
  /** Map of YYYY-MM-DD → activity sessions that day, grouped by activity. */
  activityData: Map<string, ActivityDayEntry[]>;
  /** Activity catalogue, used to name the legend. */
  activities: Activity[];
}

const WEEKS_SHOWN = 16;
const ROWS = 7;
const GAP = 2;
// Card padding + screen padding: 16 (Home content) + 16 (card padding) on each side.
const HORIZONTAL_CHROME = (16 + 16) * 2;

// Heatmap-specific cell tints — kept local, not in theme.ts, since they're
// only used here.
const CELL_EMPTY = '#EDEAE4';
const AXIS_WIDTH = 20;
const AXIS_GAP = 6; // horizontal gap between the weekday axis and the grid

// A day is tinted by its color sources (dominant plan and/or activities):
// the pastel `bg` for a single entry, the saturated `fg` for two or more —
// multi-source days always have 2+ entries, so bands always render in fg
// strength. Two or more sources paint as hard-edged diagonal bands rather than
// one averaged color, so a gym-plus-surf day still reads as both.
//
// `backgroundColor` is set even when a gradient is returned: it is the visible
// result if `experimental_backgroundImage` ever no-ops, and it also fills any
// sub-pixel seam at the cell's edges.
function paintFor(sources: DaySources): {
  backgroundColor: string;
  experimental_backgroundImage?: string;
} {
  const bands = dayPaintBands(sources);
  if (bands.length === 0) return {backgroundColor: CELL_EMPTY};
  const variant = dayTotalCount(sources) >= 2 ? 'fg' : 'bg';
  const hexes = bands.map(b => b[variant]);
  const gradient = diagonalBands(hexes);
  return gradient
    ? {backgroundColor: hexes[0], experimental_backgroundImage: gradient}
    : {backgroundColor: hexes[0]};
}

const HeatmapCard: React.FC<Props> = ({
  data,
  plans,
  activityData,
  activities,
}) => {
  const {width} = useWindowDimensions();
  const today = React.useMemo(() => new Date(), []);
  const trainedSet = React.useMemo(
    () => new Set([...data.keys(), ...activityData.keys()]),
    [data, activityData],
  );

  const legendPlans = React.useMemo(() => {
    const ids = new Set<number>();
    for (const v of data.values()) ids.add(v.planId);
    return plans.filter(p => ids.has(p.id));
  }, [data, plans]);

  const legendActivities = React.useMemo(() => {
    const ids = new Set<number>();
    for (const list of activityData.values())
      for (const e of list) ids.add(e.activityId);
    return activities.filter(a => ids.has(a.id));
  }, [activityData, activities]);

  const cellSize = Math.max(
    8,
    Math.floor(
      (width -
        HORIZONTAL_CHROME -
        AXIS_WIDTH -
        AXIS_GAP -
        GAP * (WEEKS_SHOWN - 1)) /
        WEEKS_SHOWN,
    ),
  );

  // Build the grid: rows[dayOfWeek][weekIndex] = Date
  const grid = React.useMemo(() => {
    const todayWeekStart = startOfWeek(today);
    const rows: Date[][] = Array.from({length: ROWS}, () => []);
    for (let w = WEEKS_SHOWN - 1; w >= 0; w--) {
      const weekStart = new Date(todayWeekStart);
      weekStart.setDate(todayWeekStart.getDate() - 7 * w);
      for (let d = 0; d < ROWS; d++) {
        const cellDate = new Date(weekStart);
        cellDate.setDate(weekStart.getDate() + d);
        rows[d].push(cellDate);
      }
    }
    return rows;
  }, [today]);

  const todayKey = isoDate(today);
  const isEmpty = data.size === 0 && activityData.size === 0;

  const streak = isEmpty ? 0 : currentWeekStreak(trainedSet, today);
  const last30 = isEmpty ? 0 : daysInLast(30, trainedSet, today);

  return (
    <View style={styles.card}>
      <AppText bold style={styles.label}>
        ACTIVITY
      </AppText>

      {isEmpty ? (
        <AppText italic style={styles.emptyHint}>
          No training logged yet — your heatmap will grow as you go.
        </AppText>
      ) : (
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <AppText style={styles.statLabel}>CURRENT STREAK</AppText>
            <AppText bold style={styles.statValue}>
              {`${streak} ${streak === 1 ? 'week' : 'weeks'}`}
            </AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <AppText style={styles.statLabel}>LAST 30 DAYS</AppText>
            <AppText bold style={styles.statValue}>
              {`${last30} / 30`}
            </AppText>
          </View>
        </View>
      )}

      <View style={styles.gridWrap}>
        <View style={[styles.axis, {gap: GAP}]}>
          {WEEKDAY_LABELS.map(lbl => (
            <View
              key={lbl}
              style={{height: cellSize, justifyContent: 'center'}}>
              <AppText style={styles.axisLabel}>{lbl}</AppText>
            </View>
          ))}
        </View>
        <View style={styles.grid}>
          {grid.map((row, rowIdx) => (
            <View key={rowIdx} style={[styles.row, {gap: GAP}]}>
              {row.map((date, weekIdx) => {
                const key = isoDate(date);
                const sources: DaySources = {
                  plan: data.get(key),
                  activities: activityData.get(key),
                };
                const isToday = key === todayKey;
                const isFuture = date > today;
                // Stagger left-to-right (oldest → today) with a small per-day
                // offset so the grid "fills up" toward the current week.
                // ~25ms per column + ~3ms per row → ~395ms total stagger over
                // 16 weeks × 7 days. Cell fade itself is 280ms.
                const delay = weekIdx * 25 + rowIdx * 3;
                return (
                  <Reanimated.View
                    key={key}
                    entering={FadeIn.delay(delay).duration(280)}
                    style={[
                      {
                        width: cellSize,
                        height: cellSize,
                      },
                      isFuture
                        ? {backgroundColor: 'transparent'}
                        : paintFor(sources),
                      isToday && styles.todayCell,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {(legendPlans.length > 0 || legendActivities.length > 0) && (
        <View style={styles.legend}>
          {legendPlans.map(p => (
            <View key={p.id} style={styles.legendItem}>
              <View
                style={[
                  styles.legendSwatch,
                  {backgroundColor: planColor(p.id).fg},
                ]}
              />
              <AppText style={styles.legendText}>
                {p.name.toUpperCase()}
              </AppText>
            </View>
          ))}
          {legendActivities.map(a => (
            <View key={`act-${a.id}`} style={styles.legendItem}>
              <View
                style={[
                  styles.legendSwatch,
                  {backgroundColor: activityColor(a.id).fg},
                ]}
              />
              <AppText style={styles.legendText}>
                {a.name.toUpperCase()}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 11,
    color: colors.faint,
    letterSpacing: 1.4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statBlock: {flex: 1, gap: 4},
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.rule,
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1.4,
  },
  statValue: {
    fontSize: 22,
    color: colors.ink,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  emptyHint: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 4,
  },
  grid: {gap: GAP},
  row: {flexDirection: 'row'},
  todayCell: {
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  gridWrap: {flexDirection: 'row', gap: AXIS_GAP},
  axis: {width: AXIS_WIDTH},
  axisLabel: {
    fontSize: 8,
    color: colors.faint,
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  legend: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4},
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  legendSwatch: {width: 12, height: 12},
  legendText: {fontSize: 10, color: colors.muted, letterSpacing: 1.4},
});

export default HeatmapCard;
