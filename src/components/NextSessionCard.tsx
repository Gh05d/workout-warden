// src/components/NextSessionCard.tsx
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import {colors} from '../common/theme';
import type {Session, Week} from '../common/types';

interface Props {
  currentWeek: Week | null;
  nextSession: Session | null;
  onStartSession: (session: Session, week: Week) => void;
  onCreateNextWeek: () => void;
}

function sessionLabel(s: Session): string {
  return s.weekday_label ? `${s.session_name}: ${s.weekday_label}` : s.session_name;
}

const NextSessionCard: React.FC<Props> = ({
  currentWeek,
  nextSession,
  onStartSession,
  onCreateNextWeek,
}) => {
  // Case 1 + 2: no week OR week finished → prompt to create next week
  if (!currentWeek || currentWeek.finished) {
    const weekNumber = (currentWeek?.id ?? 0) + 1;
    return (
      <Pressable style={styles.card} onPress={onCreateNextWeek}>
        <AppText style={styles.label}>Next up</AppText>
        <AppText bold style={styles.title}>
          {currentWeek ? `Week ${currentWeek.id} done!` : 'Ready to start?'}
        </AppText>
        <View style={styles.actionRow}>
          <AppText style={styles.meta}>
            {currentWeek
              ? `Tap to start Week ${weekNumber}`
              : 'Tap to start Week 1'}
          </AppText>
          <MaterialIcons name="add-circle" size={28} color={colors.primary} />
        </View>
      </Pressable>
    );
  }

  // Case 3: have an unfinished session
  if (!nextSession) {
    // Shouldn't happen if week.finished is consistent with sessions, but render safely
    return (
      <View style={styles.card}>
        <AppText style={styles.label}>Next up</AppText>
        <AppText italic>No next session found</AppText>
      </View>
    );
  }

  const total = currentWeek.sessions.length;
  const dayIndex = nextSession.day_index;
  return (
    <Pressable
      style={styles.card}
      onPress={() => onStartSession(nextSession, currentWeek)}>
      <AppText style={styles.label}>Next up</AppText>
      <AppText bold style={styles.title}>
        {sessionLabel(nextSession)}
      </AppText>
      <View style={styles.actionRow}>
        <AppText style={styles.meta}>
          Week {currentWeek.id} • day {dayIndex}/{total}
        </AppText>
        <View style={styles.startButton}>
          <AppText bold style={styles.startText}>
            Start
          </AppText>
          <MaterialIcons name="play-arrow" size={18} color="#fff" />
        </View>
      </View>
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
    marginBottom: 4,
  },
  title: {fontSize: 20, color: '#222', marginBottom: 8},
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {fontSize: 13, color: '#666'},
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  startText: {color: '#fff', fontSize: 13},
});

export default NextSessionCard;
