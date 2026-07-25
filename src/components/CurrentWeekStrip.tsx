// src/components/CurrentWeekStrip.tsx
//
// Home-screen "This Week" strip: the current ISO week (Mon–Sun) as seven large
// boxes, each showing the weekday initial, tinted by the plan trained that day
// (done shows a check, today gets an ink ring). Reads the same map as the
// heatmap below it; it is the heatmap's newest column, rotated and labeled.

import React from 'react';
import {StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {colors} from '../common/theme';
import {planColor} from '../common/planColor';
import {currentWeekCells} from './heatmapMath';
import type {HeatmapDatum} from '../common/databaseService';

interface Props {
  data: Map<string, HeatmapDatum>;
  weekProgress: {done: number; total: number} | null;
}

const CurrentWeekStrip: React.FC<Props> = ({data, weekProgress}) => {
  const today = React.useMemo(() => new Date(), []);
  const cells = React.useMemo(
    () => currentWeekCells(data, today),
    [data, today],
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText bold style={styles.label}>
          THIS WEEK
        </AppText>
        {!!weekProgress && weekProgress.total > 0 && (
          <AppText bold style={styles.counter}>
            {`${weekProgress.done}/${weekProgress.total}`}
          </AppText>
        )}
      </View>

      <View style={styles.row}>
        {cells.map(cell => {
          const c = cell.planId != null ? planColor(cell.planId) : null;
          return (
            <View
              key={cell.key}
              style={[
                styles.cell,
                c
                  ? {backgroundColor: c.bg, borderColor: c.fg}
                  : styles.cellEmpty,
                cell.isToday && styles.cellToday,
              ]}>
              {!!c && <View style={[styles.rail, {backgroundColor: c.fg}]} />}
              <AppText
                bold
                style={[styles.dayLabel, {color: c ? c.fg : colors.faint}]}>
                {cell.label}
              </AppText>
              <AppText style={[styles.mark, {color: c ? c.fg : 'transparent'}]}>
                {cell.trained ? '✓' : ' '}
              </AppText>
            </View>
          );
        })}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {fontSize: 11, color: colors.faint, letterSpacing: 1.4},
  counter: {
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  row: {flexDirection: 'row', gap: 4},
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellEmpty: {backgroundColor: colors.paper, borderColor: colors.rule},
  cellToday: {borderWidth: 1.5, borderColor: colors.ink},
  rail: {position: 'absolute', left: 0, top: 0, bottom: 0, width: 3},
  dayLabel: {fontSize: 12, letterSpacing: 1},
  mark: {fontSize: 12, lineHeight: 14, marginTop: 1},
});

export default CurrentWeekStrip;
