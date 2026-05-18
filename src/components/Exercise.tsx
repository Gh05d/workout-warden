// src/components/Exercise.tsx
import React from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import Accordion from './Accordion';
import AppText from './AppText';
import CountdownTimer from './CountdownTimer';
import InlineTimer from './InlineTimer';
import Youtube from './Youtube';
import Toast from './Toast';

import {colors} from '../common/theme';
import {formatTime} from '../common/functions';
import {
  getDBConnection,
  setSessionExerciseFinished,
  updateSet,
} from '../common/databaseService';
import type {ExerciseHistory} from '../common/databaseService';
import type {ExerciseInstance, SetLog} from '../common/types';

interface Props {
  exercise: ExerciseInstance;
  history?: ExerciseHistory;
  onFinishedChange?: (finished: boolean) => void;
}

// "3 × 5 / SIDE", "MAX 10 / SIDE", "00:45", "45s / SIDE"
function formatPrescription(ex: ExerciseInstance): string {
  const sets = ex.prescribed_sets > 1 ? `${ex.prescribed_sets} × ` : '';
  const side = ex.per_side ? ' / SIDE' : '';
  if (ex.prescribed_seconds != null) {
    const s = ex.prescribed_seconds;
    const body = s >= 60 ? formatTime(s) : `${s}s`;
    return `${sets}${body}${side}`.toUpperCase();
  }
  if (ex.prescribed_reps != null) {
    const reps = ex.as_maximum
      ? `MAX ${ex.prescribed_reps}`
      : `${ex.prescribed_reps}`;
    return `${sets}${reps}${side}`.toUpperCase();
  }
  return '';
}

interface SetRowProps {
  set: SetLog;
  index: number;
  prev?: {reps: number | null; weight: number | null};
  isPR: boolean;
  onChange: (field: 'reps' | 'weight', value: string) => void;
}

const SetRow: React.FC<SetRowProps> = ({set, index, prev, isPR, onChange}) => {
  const filled = set.reps != null || set.weight != null;
  const repsPlaceholder = prev?.reps != null ? String(prev.reps) : '–';
  const weightPlaceholder = prev?.weight != null ? String(prev.weight) : '–';
  return (
    <View style={[styles.setRow, filled && styles.setRowFilled]}>
      <AppText style={styles.setIndex} bold>{`SET ${index}`}</AppText>
      <View style={styles.fieldGroup}>
        <TextInput
          keyboardType="numeric"
          style={styles.numField}
          value={set.reps?.toString() ?? ''}
          onChangeText={v => onChange('reps', v)}
          placeholder={repsPlaceholder}
          placeholderTextColor="#bbb"
        />
        <AppText style={styles.unit}>REPS</AppText>
      </View>
      <AppText style={styles.times}>×</AppText>
      <View style={styles.fieldGroup}>
        <TextInput
          keyboardType="numeric"
          style={styles.numField}
          value={set.weight?.toString() ?? ''}
          onChangeText={v => onChange('weight', v)}
          placeholder={weightPlaceholder}
          placeholderTextColor="#bbb"
        />
        <AppText style={styles.unit}>KG</AppText>
        {isPR && (
          <View style={styles.prBadge}>
            <MaterialIcons name="star" size={12} color="#FFFFFF" />
            <AppText style={styles.prText} bold>
              PR
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
};

const Exercise: React.FC<Props> = ({exercise, history, onFinishedChange}) => {
  const [finished, setFinished] = React.useState(!!exercise.finished);
  const [showModal, setShowModal] = React.useState(false);
  const [showYoutube, setShowYoutube] = React.useState(false);
  const [sets, setSets] = React.useState<SetLog[]>(exercise.sets);
  const [error, setError] = React.useState<Error | null>(null);

  function close() {
    setShowModal(false);
    setShowYoutube(false);
  }

  function openVideo() {
    setShowYoutube(true);
    setShowModal(true);
  }

  function openTimer() {
    setShowYoutube(false);
    setShowModal(true);
  }

  async function handleSetChange(
    setId: number,
    field: 'weight' | 'reps',
    value: string,
  ) {
    const num = value === '' ? null : Number(value);
    setSets(prev => prev.map(s => (s.id === setId ? {...s, [field]: num} : s)));
    try {
      const db = await getDBConnection();
      await updateSet(db, setId, {[field]: num});
    } catch (err) {
      setError(err as Error);
    }
  }

  async function toggleFinished() {
    const next = !finished;
    setFinished(next);
    onFinishedChange?.(next);
    try {
      const db = await getDBConnection();
      await setSessionExerciseFinished(db, exercise.id, next);
    } catch (err) {
      setError(err as Error);
    }
  }

  const isTimed = exercise.prescribed_seconds != null;
  const prescription = formatPrescription(exercise);
  const accent = finished ? colors.secondary : colors.primary;

  const headerNode = (
    <View style={styles.header}>
      <View style={[styles.rail, {backgroundColor: accent}]} />
      <View style={styles.headerText}>
        <AppText bold style={styles.exerciseName}>
          {exercise.exercise_name.toUpperCase()}
        </AppText>
        {!!prescription && (
          <AppText style={styles.prescription}>{prescription}</AppText>
        )}
      </View>
      {!!exercise.hint && (
        <Pressable
          onPress={() => Alert.alert('Hint', exercise.hint ?? '')}
          hitSlop={10}
          accessibilityLabel="Show exercise hint"
          style={styles.headerIcon}>
          <MaterialIcons name="info-outline" size={20} color="#FFC080" />
        </Pressable>
      )}
      {!!exercise.video && (
        <Pressable
          onPress={openVideo}
          hitSlop={10}
          accessibilityLabel="Open exercise explanation video"
          style={styles.headerIcon}>
          <MaterialIcons name="play-circle-outline" size={22} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );

  return (
    <Accordion
      style={styles.accordionHeader}
      iconColor="#FFFFFF"
      HeaderComponent={headerNode}
      closed={finished}
      controlIcon="expand-more">
      <View style={styles.body}>
        {isTimed ? (
          <InlineTimer
            duration={exercise.prescribed_seconds ?? 0}
            onExpand={openTimer}
          />
        ) : (
          <View style={styles.setsList}>
            {sets.map((set, i) => {
              const isPR =
                set.weight != null &&
                (history?.maxWeight == null || set.weight > history.maxWeight);
              return (
                <SetRow
                  key={set.id}
                  set={set}
                  index={i + 1}
                  prev={history?.prevSetsByIndex.get(set.set_index)}
                  isPR={isPR}
                  onChange={(field, value) =>
                    handleSetChange(set.id, field, value)
                  }
                />
              );
            })}
          </View>
        )}

        <Pressable
          onPress={toggleFinished}
          style={[styles.completeBtn, finished && styles.completeBtnDone]}
          accessibilityLabel={
            finished ? 'Mark exercise incomplete' : 'Mark exercise complete'
          }>
          <MaterialIcons
            name={finished ? 'check-circle' : 'radio-button-unchecked'}
            size={20}
            color="#FFFFFF"
          />
          <AppText bold style={styles.completeBtnText}>
            {finished ? 'COMPLETED' : 'MARK COMPLETE'}
          </AppText>
        </Pressable>
      </View>

      <Modal visible={showModal} onRequestClose={close} animationType="slide">
        {showYoutube ? (
          <Youtube
            close={close}
            video={exercise.video ?? ''}
            exerciseName={exercise.exercise_name}
            prescription={prescription}
            hint={exercise.hint}
            description={exercise.exercise_description}
          />
        ) : (
          <CountdownTimer
            close={close}
            duration={exercise.prescribed_seconds ?? 0}
          />
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
  // -- Accordion / header --
  accordionHeader: {
    backgroundColor: '#111111',
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingRight: 12,
  },
  header: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 56,
  },
  rail: {width: 4, alignSelf: 'stretch'},
  headerText: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 2,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 0.8,
  },
  prescription: {
    color: '#FFB060',
    fontSize: 11,
    letterSpacing: 1.4,
  },
  headerIcon: {paddingHorizontal: 4, alignSelf: 'center'},

  // -- Body --
  body: {paddingVertical: 16, gap: 14},

  // -- Set rows --
  setsList: {gap: 8},
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
    gap: 10,
  },
  setRowFilled: {backgroundColor: '#FFFFFF', borderColor: '#CFCFCF'},
  setIndex: {
    color: '#888',
    fontSize: 11,
    letterSpacing: 1.4,
    width: 48,
  },
  fieldGroup: {flexDirection: 'row', alignItems: 'center', gap: 4},
  numField: {
    width: 64,
    height: 46,
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#CFCFCF',
    backgroundColor: '#FFFFFF',
    color: '#111',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: '#666',
    fontSize: 10,
    letterSpacing: 1.2,
    minWidth: 28,
  },
  times: {color: '#888', fontSize: 16},

  // PR badge inside the weight field group
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  prText: {color: '#FFFFFF', fontSize: 9, letterSpacing: 1},

  // -- Mark complete footer --
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    paddingVertical: 14,
    gap: 8,
  },
  completeBtnDone: {backgroundColor: colors.secondary},
  completeBtnText: {color: '#FFFFFF', fontSize: 13, letterSpacing: 1.6},
});

export default Exercise;
