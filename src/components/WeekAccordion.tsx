import React from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import Accordion from './Accordion';
import AppText from './AppText';

import {displayDate} from '../common/functions';
import {deleteWorkoutProgram} from '../common/databaseService';
import {boxShadow, row} from '../common/styles';
import {colors} from '../common/variables';

interface Props extends Week {
  setWeeks: (state: Week[]) => Week[];
  setError: (error: Error) => void;
}

const WeekAccordion: React.FC<Props> = props => {
  async function deleteWeek(id: number) {
    try {
      await deleteWorkoutProgram(id);
      props.setWeeks((state: Week[]) => state.filter(item => item.id != id));
    } catch (err) {
      props.setError(err as Error);
    }
  }

  return (
    <Accordion
      style={props.finished && {backgroundColor: colors.secondary}}
      title={`Woche ${props.id} ${props.type} ${displayDate(
        props.start_date,
        props.end_date,
      )}`}
      closed={props.finished}
      controlIcon="expand-more">
      <View
        style={[
          styles.row,
          {
            marginBottom: 32,
            marginTop: 16,
            justifyContent: 'space-between',
          },
        ]}>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Delete Week',
              'Do you really want to delete this week',
              [
                {text: 'Cancel'},
                {text: 'Confirm', onPress: () => deleteWeek(props.id)},
              ],
            )
          }>
          <MaterialIcons
            style={styles.icon}
            name="delete"
            color={colors.primary}
            size={20}
          />
        </Pressable>

        <View style={{flexDirection: 'row', gap: 8}}>
          <AppText style={{color: props.finished ? colors.primary : '#ddd'}}>
            {props.finished ? 'Finished' : 'Open'}
          </AppText>
          <MaterialIcons
            style={styles.icon}
            name={props.finished ? 'done' : 'timeline'}
            color={props.finished ? colors.primary : '#ddd'}
            size={20}
          />
        </View>
      </View>
      {props.sessions.map(session => (
        <View key={session.id} style={[styles.day]}>
          <View
            style={[
              row,
              styles.header,
              session.finished && {backgroundColor: colors.secondary},
            ]}>
            <AppText style={{color: '#fff'}} bold>
              {session.day}
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
                    {exercise.name}:
                  </AppText>
                  {exercise.sled ? (
                    <AppText>
                      {`${Math.floor(exercise.time! / 60)}:${Math.floor(
                        exercise.time! % 60,
                      )} min`}
                    </AppText>
                  ) : (
                    <AppText>{exercise.sets[0].reps} Reps</AppText>
                  )}
                  {exercise.sets.map(set => (
                    <AppText key={set.id}>{set.weight} kg</AppText>
                  ))}
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
