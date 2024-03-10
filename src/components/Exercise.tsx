import React from 'react';
import {Button, Modal, Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import Accordion from './Accordion';
import {colors} from '../common/variables';
import AppInput from './AppInput';
import AppCheckBox from './AppCheckBox';
import AppText from './AppText';
import CountdownTimer from './CountdownTimer';
import {row} from '../common/styles';
import {formatTime} from '../common/functions';
import Youtube from './Youtube';
import {getDBConnection} from '../common/databaseService';
import Toast from './Toast';

const Exercise: React.FC<Exercise> = exercise => {
  const [finished, setFinished] = React.useState(!!exercise.finished);
  const [show, toggle] = React.useState(false);
  const [youtube, setYoutube] = React.useState(false);
  const [sets, setSets] = React.useState(exercise.sled ? [] : exercise.sets);
  const [error, setError] = React.useState<null | Error>(null);

  function close() {
    toggle(false);
    setYoutube(false);
  }

  function setValue(value: string, type: string, id: number) {
    setSets(state => {
      const copy = [...state];
      const index = copy.findIndex(item => item.id == id);
      copy[index][type] = +value;

      update({...exercise, sets: copy});

      return copy;
    });
  }

  async function update(data: Exercise) {
    try {
      const db = await getDBConnection();

      for (const set of data.sets) {
        const query = `
          UPDATE sets SET weight = ?, reps = ?
          WHERE id = ? AND training_day_exercise_id = ?;
        `;
        await db.executeSql(query, [
          set.weight,
          set.reps,
          set.id,
          set.training_day_exercise_id,
        ]);
      }
    } catch (err) {
      setError(err as Error);
    }
  }

  async function handleCheckBox(value: boolean) {
    try {
      setFinished(state => !state);
      const db = await getDBConnection();

      const query = `
      UPDATE training_day_exercises SET finished = ?
      WHERE id = ?;
    `;
      await db.executeSql(query, [
        value ? 1 : 0,
        exercise.training_day_exercise_id,
      ]);
    } catch (err) {
      setError(err as Error);
    }
  }

  return (
    <Accordion
      style={finished && {backgroundColor: colors.secondary}}
      title={exercise.name}
      closed={finished}
      controlIcon="expand-more">
      <Pressable
        onPress={() => {
          setYoutube(true);
          toggle(true);
        }}
        style={[row, {justifyContent: 'flex-start', marginBottom: 16}]}>
        <MaterialIcons name="subscriptions" size={30} color={colors.primary} />
        <AppText bold>Exercise Explanation</AppText>
      </Pressable>

      <View style={styles.trainingWrapper}>
        <View>
          {exercise.sled ? (
            <View style={{...row}}>
              <AppText>{formatTime(exercise.time!)} Minutes</AppText>
              <Button
                color={colors.primary}
                title="Show Timer"
                onPress={() => toggle(true)}
              />
            </View>
          ) : (
            sets?.map(set => (
              <View key={set.id} style={styles.data}>
                <AppInput
                  keyboardType="numeric"
                  setValue={value => setValue(value, 'reps', set.id)}
                  value={set.reps?.toString()}
                  label="Reps"
                />
                <AppInput
                  keyboardType="numeric"
                  setValue={value => setValue(value, 'weight', set.id)}
                  value={set.weight?.toString()}
                  label="Weight"
                />
              </View>
            ))
          )}
        </View>

        <AppCheckBox
          value={finished}
          onValueChange={value => handleCheckBox(value)}
          color={colors.primary}
        />
      </View>

      <Modal visible={show} onRequestClose={close} animationType="slide">
        {youtube ? (
          <Youtube close={close} video={exercise.video} />
        ) : (
          <CountdownTimer close={close} duration={exercise.time!} />
        )}
      </Modal>

      {error && (
        <Toast
          message={error.message}
          type="error"
          onClose={() => setError(null)}
        />
      )}
    </Accordion>
  );
};

const styles = StyleSheet.create({
  trainingWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  data: {...row, justifyContent: 'center'},
});

export default Exercise;
