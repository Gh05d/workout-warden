// src/components/CurrentWeekStrip.tsx
//
// Home-screen "This Week" strip: the current ISO week (Mon–Sun) as seven large
// boxes, each showing the weekday initial, tinted by the plan trained that day
// (done shows a check, today gets an ink ring). Days the active plan schedules
// but that hold no log yet get a quiet dot; unscheduled days recede as rest
// days. A run track under the boxes spans the plan's training days only — rest
// days are excluded so the track reads as full once every training day is
// logged — and joins consecutive trained days into one continuous bar. Reads the
// same map as the heatmap below it; it is the heatmap's newest column, rotated
// and labeled.

import React from 'react';
import {StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {colors} from '../common/theme';
import {planColor} from '../common/planColor';
import {currentWeekCells} from './heatmapMath';
import type {WeekDayCell} from './heatmapMath';
import type {HeatmapDatum} from '../common/databaseService';

interface Props {
  data: Map<string, HeatmapDatum>;
  weekProgress: {done: number; total: number} | null;
  /** Monday-first weekday indices the active plan trains on. Empty when the
   * plan carries no weekday labels — then no day is marked as scheduled. */
  scheduledWeekdays: ReadonlySet<number>;
  /** Tints the scheduled-day dot with the active plan's identity colour. */
  activePlanId: number | null;
}

// Must match `styles.row`'s gap: the run track's connectors span exactly the
// gaps between the day boxes, which is what makes a run look continuous.
const CELL_GAP = 4;

/** Whether a day belongs on the run track at all. Rest days are left out
 * entirely, so the track spans only the plan's training window and reads as
 * full once every training day is logged — a track spanning all seven days
 * could never fill for a Mon–Fri plan. Off-plan sessions still count. */
function inTrack(cell: WeekDayCell): boolean {
  return cell.scheduled || cell.trained;
}

function trackFill(planId: number | null): string {
  return planId != null ? planColor(planId).fg : colors.faint;
}

const CurrentWeekStrip: React.FC<Props> = ({
  data,
  weekProgress,
  scheduledWeekdays,
  activePlanId,
}) => {
  const today = React.useMemo(() => new Date(), []);
  const cells = React.useMemo(
    () => currentWeekCells(data, today, scheduledWeekdays),
    [data, today, scheduledWeekdays],
  );

  const dotColor =
    activePlanId != null ? planColor(activePlanId).fg : colors.faint;
  const trackVisible = cells.some(inTrack);

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

      <View style={styles.weekBlock}>
        <View style={styles.row}>
          {cells.map(cell => {
            const c = cell.planId != null ? planColor(cell.planId) : null;
            // Three tiers of emphasis: trained (plan colour) > scheduled but
            // unlogged (muted) > rest day (recedes).
            const labelColor = c
              ? c.fg
              : cell.scheduled
                ? colors.muted
                : colors.ghost;
            const mark = cell.trained ? '✓' : cell.scheduled ? '•' : ' ';
            const markColor = c
              ? c.fg
              : cell.scheduled
                ? dotColor
                : 'transparent';
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
                <AppText bold style={[styles.dayLabel, {color: labelColor}]}>
                  {cell.label}
                </AppText>
                <AppText style={[styles.mark, {color: markColor}]}>
                  {mark}
                </AppText>
              </View>
            );
          })}
        </View>

        {trackVisible && (
          <View style={styles.track}>
            {cells.map((cell, i) => {
              const prev = i > 0 ? cells[i - 1] : null;
              const prevInTrack = !!prev && inTrack(prev);
              const prevTrained = !!prev && prev.trained;
              const prevPlanId = prev ? prev.planId : null;
              // Filled = trained (plan colour). Unfilled-but-present = a
              // training day still owed (rule grey). A connector bridges its
              // two neighbours at the weaker of their two states, taking the
              // left day's plan colour when both are trained.
              const segment = cell.trained
                ? trackFill(cell.planId)
                : inTrack(cell)
                  ? colors.rule
                  : 'transparent';
              const connector =
                prevTrained && cell.trained
                  ? trackFill(prevPlanId)
                  : prevInTrack && inTrack(cell)
                    ? colors.rule
                    : 'transparent';
              return (
                <React.Fragment key={cell.key}>
                  {i > 0 && (
                    <View
                      style={[
                        styles.trackConnector,
                        {backgroundColor: connector},
                      ]}
                    />
                  )}
                  <View
                    style={[styles.trackSegment, {backgroundColor: segment}]}
                  />
                </React.Fragment>
              );
            })}
          </View>
        )}
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
  // Keeps the run track tucked right under the boxes it annotates, instead of
  // a full card-gap away.
  weekBlock: {gap: 6},
  row: {flexDirection: 'row', gap: CELL_GAP},
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
  // No gap here: the fixed-width connectors ARE the gaps, so segments align
  // with the day boxes above them.
  track: {flexDirection: 'row', height: 3},
  trackSegment: {flex: 1, backgroundColor: 'transparent'},
  trackConnector: {width: CELL_GAP, backgroundColor: 'transparent'},
});

export default CurrentWeekStrip;
