import React from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import Accordion from './Accordion';
import AppText from './AppText';

import {displayDate, formatTime} from '../common/functions';
import {deleteWeek, getDBConnection} from '../common/databaseService';
import {planColor} from '../common/planColor';
import {boxShadow, row} from '../common/styles';
import {colors} from '../common/theme';
import type {Week} from '../common/types';

interface Props {
  week: Week;
  setWeeks: React.Dispatch<React.SetStateAction<Week[]>>;
  setUpdating: React.Dispatch<React.SetStateAction<boolean>>;
  setError: (e: Error | null) => void;
}

const WeekAccordion: React.FC<Props> = ({
  week,
  setWeeks,
  setUpdating,
  setError,
}) => {
  const {id, plan_id, plan_name, created_at, sessions, finished} = week;
  const pill = planColor(plan_id);

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

  const header = (
    <View style={styles.headerRow}>
      <AppText bold style={styles.headerTitle}>
        {`Week ${id} ${dateLabel}`}
      </AppText>
      <View style={[styles.pill, {backgroundColor: pill.bg}]}>
        <AppText style={[styles.pillText, {color: pill.fg}]} bold>
          {plan_name}
        </AppText>
      </View>
    </View>
  );

  return (
    <Accordion
      style={[
        styles.accordionHeader,
        !!finished && {backgroundColor: colors.secondary},
      ]}
      iconColor="#FFFFFF"
      HeaderComponent={header}
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
            Alert.alert(
              'Delete Week',
              'Do you really want to delete this week',
              [{text: 'Cancel'}, {text: 'Confirm', onPress: handleDelete}],
            )
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
                    <AppText>
                      {formatTime(exercise.prescribed_seconds)} min
                    </AppText>
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
  accordionHeader: {backgroundColor: colors.ink},
  header: {backgroundColor: '#ccc', padding: 8},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
    gap: 8,
  },
  headerTitle: {color: '#fff', flexShrink: 1, letterSpacing: 0.5},
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  pillText: {fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5},
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
