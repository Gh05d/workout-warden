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

  const trainedDates = week.sessions
    .map(s => s.trained_at)
    .filter((d): d is string => !!d);
  const firstDate = trainedDates[0] ?? null;
  const lastDate = trainedDates[trainedDates.length - 1] ?? null;
  const dateRange =
    firstDate && lastDate ? `${shortDate(firstDate)} – ${shortDate(lastDate)}` : '';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <AppText style={styles.label}>Week {week.id}</AppText>
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  label: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#eee',
    position: 'relative',
  },
  barFill: {height: '100%', backgroundColor: colors.primary},
  barEmpty: {height: '100%'},
  barLabel: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 13,
    color: '#222',
  },
  dateRange: {marginTop: 8, fontSize: 13, color: '#666'},
});

export default ProgressCard;
