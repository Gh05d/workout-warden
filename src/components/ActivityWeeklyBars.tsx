// src/components/ActivityWeeklyBars.tsx
//
// Last-8-weeks stacked hour bars for the Activities tab. Plain Views in the
// progress-bar idiom — deliberately not victory-native (see design spec).

import React from 'react';
import {StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {colors} from '../common/theme';
import {activityColor} from '../common/planColor';
import {weeklyBarData} from './activityStats';
import type {ActivitySession} from '../common/types';

interface Props {
  sessions: ActivitySession[];
}

const BAR_AREA_HEIGHT = 96;

const ActivityWeeklyBars: React.FC<Props> = ({sessions}) => {
  const today = React.useMemo(() => new Date(), []);
  const bars = React.useMemo(
    () => weeklyBarData(sessions, today),
    [sessions, today],
  );
  const max = Math.max(...bars.map(b => b.totalMinutes), 1);

  return (
    <View style={styles.card}>
      <AppText bold style={styles.label}>
        HOURS / WEEK
      </AppText>
      <View style={styles.barRow}>
        {bars.map(bar => (
          <View key={bar.key} style={styles.barCol}>
            <View style={styles.hourWrap}>
              {bar.timedMinutes > 0 && (
                <AppText style={styles.hourText}>
                  {(bar.timedMinutes / 60).toFixed(1)}
                </AppText>
              )}
            </View>
            <View style={styles.barArea}>
              {bar.segments.map(seg => (
                <View
                  key={seg.activityId}
                  style={{
                    height: Math.max(2, (seg.minutes / max) * BAR_AREA_HEIGHT),
                    backgroundColor: activityColor(seg.activityId).fg,
                  }}
                />
              ))}
            </View>
            <AppText style={styles.weekLabel}>{bar.label}</AppText>
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
  label: {fontSize: 11, color: colors.faint, letterSpacing: 1.4},
  barRow: {flexDirection: 'row', gap: 6, alignItems: 'flex-end'},
  barCol: {flex: 1, gap: 4, alignItems: 'stretch'},
  hourWrap: {height: 14, justifyContent: 'flex-end'},
  hourText: {
    fontSize: 9,
    color: colors.muted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  barArea: {
    height: BAR_AREA_HEIGHT,
    justifyContent: 'flex-end',
    gap: 1,
  },
  weekLabel: {
    fontSize: 8,
    color: colors.faint,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});

export default ActivityWeeklyBars;
