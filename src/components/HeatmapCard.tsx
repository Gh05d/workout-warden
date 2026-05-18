// src/components/HeatmapCard.tsx
//
// Home-screen Activity heatmap: GitHub-style grid showing trained days over
// the last 16 weeks plus a current-streak readout. Plan-agnostic — every
// plan's sessions feed into the same grid.

import React from 'react';
import {StyleSheet, View, useWindowDimensions} from 'react-native';

import AppText from './AppText';
import {colors} from '../common/theme';
import {
  currentWeekStreak,
  daysInLast,
  isoDate,
  startOfWeek,
} from './heatmapMath';

interface Props {
  /** Map of YYYY-MM-DD (local date) → session count, covering at least the
   * last 16 weeks. Days not in the map render as empty cells. */
  data: Map<string, number>;
}

const WEEKS_SHOWN = 16;
const ROWS = 7;
const GAP = 2;
// Card padding + screen padding: 16 (Home content) + 16 (card padding) on each side.
const HORIZONTAL_CHROME = (16 + 16) * 2;

// Heatmap-specific cell tints — kept local, not in theme.ts, since they're
// only used here.
const CELL_EMPTY = '#EDEAE4';
const CELL_LIGHT = '#FFB870'; // primary at ~70%
const CELL_FULL = colors.primary;

function fillFor(count: number | undefined): string {
  if (!count) return CELL_EMPTY;
  if (count === 1) return CELL_LIGHT;
  return CELL_FULL;
}

const HeatmapCard: React.FC<Props> = ({data}) => {
  const {width} = useWindowDimensions();
  const today = React.useMemo(() => new Date(), []);
  const trainedSet = React.useMemo(() => new Set(data.keys()), [data]);

  const cellSize = Math.max(
    8,
    Math.floor(
      (width - HORIZONTAL_CHROME - GAP * (WEEKS_SHOWN - 1)) / WEEKS_SHOWN,
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
  const isEmpty = data.size === 0;

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

      <View style={styles.grid}>
        {grid.map((row, rowIdx) => (
          <View key={rowIdx} style={[styles.row, {gap: GAP}]}>
            {row.map(date => {
              const key = isoDate(date);
              const count = data.get(key);
              const isToday = key === todayKey;
              const isFuture = date > today;
              return (
                <View
                  key={key}
                  style={[
                    {
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: isFuture
                        ? 'transparent'
                        : fillFor(count),
                    },
                    isToday && styles.todayCell,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
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
});

export default HeatmapCard;
