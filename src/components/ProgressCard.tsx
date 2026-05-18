// src/components/ProgressCard.tsx
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {colors} from '../common/theme';
import type {Week} from '../common/types';

interface Props {
  week: Week;
  onPress: () => void;
}

function shortDate(iso: string | null): string {
  if (!iso) return '?';
  const d = iso.slice(0, 10); // 'YYYY-MM-DD'
  const [, m, day] = d.split('-');
  return `${day}.${m}`;
}

const ProgressCard: React.FC<Props> = ({week, onPress}) => {
  const total = week.sessions.length;
  const done = week.sessions.filter(s => s.finished).length;
  const pct = total === 0 ? 0 : done / total;

  // Sort trained_at chronologically — sessions come ordered by day_index, but
  // the user might train day 3 before day 1.
  const trainedDates = week.sessions
    .map(s => s.trained_at)
    .filter((d): d is string => !!d)
    .sort();
  const firstDate = trainedDates[0] ?? null;
  // "Last" is only meaningful when the whole week is done; otherwise show "?".
  const lastDate =
    done === total ? trainedDates[trainedDates.length - 1] : null;
  const dateRange = firstDate
    ? `${shortDate(firstDate)} – ${shortDate(lastDate)}`
    : '';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <AppText style={styles.label} bold>
        WEEK {week.id}
      </AppText>
      <View style={styles.barWrapper}>
        <View style={[styles.barFill, {flex: pct}]} />
        <View style={[styles.barEmpty, {flex: 1 - pct}]} />
        <AppText bold style={styles.barLabel}>
          {done}/{total}
        </AppText>
      </View>
      {!!dateRange && <AppText style={styles.dateRange}>{dateRange}</AppText>}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 16,
  },
  label: {
    fontSize: 11,
    color: colors.faint,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    overflow: 'hidden',
    backgroundColor: '#EEEEEE',
    position: 'relative',
  },
  barFill: {height: '100%', backgroundColor: colors.primary},
  barEmpty: {height: '100%'},
  barLabel: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 12,
    color: '#222',
    letterSpacing: 1,
  },
  dateRange: {marginTop: 8, fontSize: 13, color: colors.muted},
});

export default ProgressCard;
