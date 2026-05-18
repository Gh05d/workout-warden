import React from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import Accordion from './Accordion';
import AppText from './AppText';

import {displayDate, formatTime} from '../common/functions';
import {deleteWeek, getDBConnection} from '../common/databaseService';
import {boxShadow, row} from '../common/styles';
import {colors} from '../common/theme';
import type {Week} from '../common/types';

interface Props {
  week: Week;
  setWeeks: React.Dispatch<React.SetStateAction<Week[]>>;
  setUpdating: React.Dispatch<React.SetStateAction<boolean>>;
  setError: (e: Error | null) => void;
}

const WeekAccordion: React.FC<Props> = ({week, setWeeks, setUpdating, setError}) => {
  const {id, created_at, sessions, finished} = week;

  // Derive a date range from the trained_at timestamps on the sessions. If
  // none were trained yet, fall back to created_at as the start so the header
  // still shows when the week was created.
  const trainedAts = sessions
    .map(s => s.trained_at)
    .filter((d): d is string => !!d);
  const hasTrained = trainedAts.length > 0;
  const sorted = [...trainedAts].sort();
  const firstTrained = sorted[0];
  const lastTrained = sorted[sorted.length - 1];

  const dateLabel = hasTrained
    ? displayDate(firstTrained, lastTrained)
    : `created ${displayDate(created_at, created_at)} – no sessions trained yet`;

  async function handleDelete() {
    try {
      setUpdating(true);
      const db = await getDBConnection();
      await deleteWeek(db, id);
      setWeeks(state => state.filter(item => item.id != id));
    } catch (err) {
      setError(err as Error);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Accordion
      style={!!finished && {backgroundColor: colors.secondary}}
      title={`Woche ${id} ${dateLabel}`}
      closed={!!finished}
      controlIcon="expand-more">
      <View
        style={[
          styles.row,
          {marginBottom: 32, marginTop: 16, justifyContent: 'flex-end'},
        ]}>
        <AppText style={{color: finished ? colors.primary : '#ddd'}}>
          {finished ? 'Finished' : 'Open'}
        </AppText>

        <MaterialIcons
          style={styles.icon}
          name={finished ? 'done' : 'timeline'}
          color={finished ? colors.primary : '#ddd'}
          size={20}
        />

        <Pressable
          onPress={() =>
            Alert.alert('Delete Week', 'Do you really want to delete this week', [
              {text: 'Cancel'},
              {text: 'Confirm', onPress: handleDelete},
            ])
          }>
          <MaterialIcons
            style={styles.icon}
            name="delete"
            color={colors.primary}
            size={20}
          />
        </Pressable>
      </View>

      {sessions.map(session => (
        <View key={session.id} style={[styles.day]}>
          <View
            style={[
              row,
              styles.header,
              !!session.finished && {backgroundColor: colors.secondary},
            ]}>
            <AppText style={{color: '#fff'}} bold>
              {session.session_name}
            </AppText>

            <MaterialIcons
              style={styles.icon}
              name={session.finished ? 'done' : 'timeline'}
              color={session.finished ? colors.primary : '#aaa'}
              size={20}
            />
          </View>

          <View style={{paddingVertical: 8, paddingHorizontal: 4}}>
            {session.exercises?.map(exercise => (
              <View key={exercise.id} style={[row]}>
                <View
                  style={[
                    row,
                    {
                      justifyContent: 'flex-start',
                      flexWrap: 'wrap',
                      flexShrink: 1,
                      gap: 4,
                      marginBottom: 12,
                    },
                  ]}>
                  <AppText italic key={exercise.id}>
                    {exercise.exercise_name}:
                  </AppText>
                  {exercise.prescribed_seconds != null ? (
                    <AppText>{formatTime(exercise.prescribed_seconds)} min</AppText>
                  ) : exercise.sets[0]?.reps != null ? (
                    <AppText>{exercise.sets[0].reps} Reps</AppText>
                  ) : exercise.prescribed_reps != null ? (
                    <AppText>{exercise.prescribed_reps} Reps</AppText>
                  ) : null}
                  {exercise.sets.map(set =>
                    set.weight != null ? (
                      <AppText key={set.id}>{set.weight} kg</AppText>
                    ) : null,
                  )}
                </View>

                <View style={{flexGrow: 1, marginBottom: 12}}>
                  <MaterialIcons
                    style={styles.icon}
                    name="done"
                    color={exercise.finished ? colors.secondary : '#ccc'}
                    size={20}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Accordion>
  );
};

const styles = StyleSheet.create({
  header: {backgroundColor: '#ccc', padding: 8},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  day: {
    marginBottom: 16,
    backgroundColor: '#fff',
    gap: 8,
    ...boxShadow,
  },
  icon: {marginLeft: 'auto'},
});

export default WeekAccordion;
