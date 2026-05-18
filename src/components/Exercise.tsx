// src/components/Exercise.tsx
import React from 'react';
import {Button, Modal, Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import Accordion from './Accordion';
import AppInput from './AppInput';
import AppCheckBox from './AppCheckBox';
import AppText from './AppText';
import CountdownTimer from './CountdownTimer';
import Youtube from './Youtube';
import Toast from './Toast';

import {colors} from '../common/theme';
import {row} from '../common/styles';
import {formatTime} from '../common/functions';
import {
  getDBConnection,
  setSessionExerciseFinished,
  updateSet,
} from '../common/databaseService';
import type {ExerciseInstance, SetLog} from '../common/types';

interface Props {
  exercise: ExerciseInstance;
}

function formatPrescription(ex: ExerciseInstance): string {
  if (ex.prescribed_seconds != null) {
    const base = formatTime(ex.prescribed_seconds);
    const side = ex.per_side ? ' Per Side' : '';
    return ex.prescribed_seconds >= 60 ? `${base}${side}` : `${ex.prescribed_seconds} Secs${side}`;
  }
  if (ex.prescribed_reps != null) {
    const prefix = ex.as_maximum ? 'up to ' : '';
    const side = ex.per_side ? ' Per Side' : '';
    return `${prefix}${ex.prescribed_reps} Reps${side}`;
  }
  return '';
}

const Exercise: React.FC<Props> = ({exercise}) => {
  const [finished, setFinished] = React.useState(!!exercise.finished);
  const [showModal, setShowModal] = React.useState(false);
  const [showYoutube, setShowYoutube] = React.useState(false);
  const [sets, setSets] = React.useState<SetLog[]>(exercise.sets);
  const [error, setError] = React.useState<Error | null>(null);

  function close() {
    setShowModal(false);
    setShowYoutube(false);
  }

  async function handleSetChange(setId: number, field: 'weight' | 'reps', value: string) {
    const num = value === '' ? null : Number(value);
    setSets(prev => prev.map(s => (s.id === setId ? {...s, [field]: num} : s)));
    try {
      const db = await getDBConnection();
      await updateSet(db, setId, {[field]: num});
    } catch (err) {
      setError(err as Error);
    }
  }

  async function handleCheckBox(value: boolean) {
    setFinished(value);
    try {
      const db = await getDBConnection();
      await setSessionExerciseFinished(db, exercise.id, value);
    } catch (err) {
      setError(err as Error);
    }
  }

  const isTimed = exercise.prescribed_seconds != null;
  const prescription = formatPrescription(exercise);

  return (
    <Accordion
      style={finished && {backgroundColor: colors.secondary}}
      title={exercise.exercise_name}
      subtitle={prescription}
      closed={finished}
      controlIcon="expand-more">
      <Pressable
        onPress={() => {
          setShowYoutube(true);
          setShowModal(true);
        }}
        style={[row, {justifyContent: 'flex-start', marginBottom: 16}]}>
        <MaterialIcons name="subscriptions" size={30} color={colors.primary} />
        <AppText bold>Exercise Explanation</AppText>
      </Pressable>

      {!!exercise.hint && <AppText italic>{exercise.hint}</AppText>}

      <View style={styles.trainingWrapper}>
        <View>
          {isTimed ? (
            <View style={{...row}}>
              <AppText>{prescription}</AppText>
              <Button color={colors.primary} title="Show Timer" onPress={() => setShowModal(true)} />
            </View>
          ) : (
            sets.map(set => (
              <View key={set.id} style={styles.data}>
                <AppInput
                  keyboardType="numeric"
                  setValue={v => handleSetChange(set.id, 'reps', v)}
                  value={set.reps?.toString() ?? ''}
                  label="Reps"
                />
                <AppInput
                  keyboardType="numeric"
                  setValue={v => handleSetChange(set.id, 'weight', v)}
                  value={set.weight?.toString() ?? ''}
                  label="Weight"
                />
              </View>
            ))
          )}
        </View>

        <AppCheckBox value={finished} onValueChange={handleCheckBox} color={colors.primary} />
      </View>

      <Modal visible={showModal} onRequestClose={close} animationType="slide">
        {showYoutube ? (
          <Youtube close={close} video={exercise.video ?? ''} />
        ) : (
          <CountdownTimer close={close} duration={exercise.prescribed_seconds ?? 0} />
        )}
      </Modal>

      {error && <Toast message={error.message} type="error" onClose={() => setError(null)} />}
    </Accordion>
  );
};

const styles = StyleSheet.create({
  trainingWrapper: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  data: {...row, justifyContent: 'center'},
});

export default Exercise;
