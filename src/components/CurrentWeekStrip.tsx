// src/components/CurrentWeekStrip.tsx
//
// Home-screen "This Week" strip: the current ISO week (Mon–Sun) as seven large
// boxes, each showing the weekday initial (today gets an ink ring). Scheduled
// days are a checklist: the ✓ marks that weekday's *session* being done — on
// whatever calendar day it was trained — so Tuesday's plan finished on
// Wednesday still checks off Tuesday. Scheduled days whose session is still
// open get a quiet dot. Unscheduled days keep the calendar view (tinted by the
// plan trained that day) so extra sessions stay visible, and otherwise recede
// as rest days. Under the boxes sits a progress bar over the checklist.

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
  /** Monday-first weekday indices the active plan trains on. Empty when the
   * plan carries no weekday labels — then no day is marked as scheduled. */
  scheduledWeekdays: ReadonlySet<number>;
  /** Monday-first weekday indices whose scheduled session is done this week
   * (see heatmapMath.completedScheduledWeekdays). Drives the ✓ on scheduled
   * days and the progress bar. */
  completedWeekdays: ReadonlySet<number>;
  /** Identity colour for the scheduled-day dots and the progress fill. */
  activePlanId: number | null;
}

const CELL_GAP = 4;

const CurrentWeekStrip: React.FC<Props> = ({
  data,
  weekProgress,
  scheduledWeekdays,
  completedWeekdays,
  activePlanId,
}) => {
  const today = React.useMemo(() => new Date(), []);
  const cells = React.useMemo(
    () => currentWeekCells(data, today, scheduledWeekdays),
    [data, today, scheduledWeekdays],
  );

  const accent =
    activePlanId != null ? planColor(activePlanId).fg : colors.faint;

  // Progress counts the plan's training days only: rest days are not work owed,
  // so they must not hold the bar below 100% once the week's sessions are done.
  // A session logged on a rest day shows as a ✓ in its box but is not counted
  // here — it would otherwise push the bar past full. Done = the scheduled
  // session is finished, not "trained that calendar day": otherwise a plan
  // trained off-schedule (Tuesday's session on Wednesday) could never fill the
  // bar while the header counter reads all sessions finished.
  const scheduledDays = cells.filter(cell => cell.scheduled);
  const scheduledDone = cells.filter(
    (cell, i) => cell.scheduled && completedWeekdays.has(i),
  ).length;
  const pct =
    scheduledDays.length > 0 ? scheduledDone / scheduledDays.length : 0;

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
          {cells.map((cell, i) => {
            // Scheduled cells are a checklist (✓ = that weekday's session is
            // finished, in the active plan's colour); unscheduled cells keep
            // the calendar view (✓ = trained that day, in that plan's colour).
            const done = cell.scheduled
              ? completedWeekdays.has(i)
              : cell.trained;
            const paintId = cell.scheduled
              ? done
                ? activePlanId
                : null
              : cell.planId;
            const c = paintId != null ? planColor(paintId) : null;
            // Three tiers of emphasis: done (plan colour) > scheduled but
            // open (muted) > rest day (recedes).
            const labelColor = c
              ? c.fg
              : cell.scheduled
                ? colors.muted
                : colors.ghost;
            const mark = done ? '✓' : cell.scheduled ? '•' : ' ';
            const markColor = c
              ? c.fg
              : cell.scheduled
                ? accent
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

        {scheduledDays.length > 0 && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {width: `${pct * 100}%`, backgroundColor: accent},
              ]}
            />
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
  // Keeps the progress bar tucked right under the boxes it annotates, instead
  // of a full card-gap away.
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
  progressTrack: {height: 3, backgroundColor: colors.rule, overflow: 'hidden'},
  progressFill: {height: '100%'},
});

export default CurrentWeekStrip;
