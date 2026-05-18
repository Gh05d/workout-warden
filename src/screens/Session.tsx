// src/screens/Session.tsx
import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import Loading from '../components/Loading';
import ErrorComp from '../components/Error';
import Exercise from '../components/Exercise';
import LoadingModal from '../components/LoadingModal';
import TacticalButton from '../components/TacticalButton';
import Toast from '../components/Toast';
import AppText from '../components/AppText';

import {colors} from '../common/theme';
import {
  createWeek,
  fetchActivePlanId,
  fetchExerciseHistory,
  fetchWeekById,
  fetchWeeksByPlan,
  finishSession,
  getDBConnection,
} from '../common/databaseService';
import type {ExerciseHistory} from '../common/databaseService';
import type {BaseProps, ExerciseInstance, Session, Week} from '../common/types';

interface RouteParams {
  weekID?: number;
  day_index: number;
  title: string;
}

function groupByCircuit(exercises: ExerciseInstance[]): Array<{
  circuit_rounds: number | null;
  exercises: ExerciseInstance[];
}> {
  const out: Array<{
    circuit_rounds: number | null;
    exercises: ExerciseInstance[];
  }> = [];
  for (const ex of exercises) {
    const last = out[out.length - 1];
    if (
      ex.circuit_index != null &&
      last &&
      last.circuit_rounds === ex.circuit_rounds &&
      last.exercises[0].circuit_index === ex.circuit_index
    ) {
      last.exercises.push(ex);
    } else {
      out.push({
        circuit_rounds: ex.circuit_index != null ? ex.circuit_rounds : null,
        exercises: [ex],
      });
    }
  }
  return out;
}

const SessionScreen: React.FC<BaseProps> = ({navigation, route}) => {
  const {weekID, day_index} = route.params as RouteParams;

  const [currentWeek, setCurrentWeek] = React.useState<Week | null>(null);
  const [history, setHistory] = React.useState<Map<number, ExerciseHistory>>(
    new Map(),
  );
  const [finishedDelta, setFinishedDelta] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [finishError, setFinishError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      (async function load() {
        setLoading(true);
        try {
          const db = await getDBConnection();
          let week: Week | null = null;

          if (weekID) {
            week = await fetchWeekById(db, weekID);
          } else {
            const planId = await fetchActivePlanId(db);
            if (planId == null) throw new Error('No active plan');
            const all = await fetchWeeksByPlan(db, planId);
            if (all.length > 0) {
              week = all[0]; // ORDER BY created_at DESC ⇒ index 0 is newest
            } else {
              await createWeek(db, planId);
              const fresh = await fetchWeeksByPlan(db, planId);
              week = fresh[0];
            }
          }
          setCurrentWeek(week);
          setFinishedDelta(0);
          const session = week?.sessions.find(s => s.day_index === day_index);
          if (session && session.exercises.length > 0) {
            const exerciseIds = session.exercises.map(e => e.exercise_id);
            const hist = await fetchExerciseHistory(
              db,
              exerciseIds,
              session.id,
            );
            setHistory(hist);
          }
        } catch (err) {
          setError(err as Error);
        } finally {
          setLoading(false);
        }
      })();
    }, [weekID, day_index]),
  );

  const currentSession: Session | undefined = currentWeek?.sessions.find(
    s => s.day_index === day_index,
  );

  useFocusEffect(
    React.useCallback(() => {
      const parent = navigation.getParent();
      if (!parent || !currentWeek) return;
      const dates = currentWeek.sessions
        .map(s => s.trained_at)
        .filter((d): d is string => !!d);
      const range =
        dates.length === 0
          ? ''
          : ` (${dates[0].slice(0, 10)} – ${dates[dates.length - 1].slice(0, 10)})`;
      parent.setOptions({title: `Week ${currentWeek.id}${range}`});
    }, [navigation, currentWeek]),
  );

  async function handleFinish() {
    if (!currentSession) return;
    setUpdating(true);
    try {
      // Re-fetch from DB instead of trusting local state — Exercise.tsx mutates
      // session_exercises.finished directly via setSessionExerciseFinished, those
      // writes don't propagate up to currentWeek until the next useFocusEffect.
      const db = await getDBConnection();
      const freshWeek = await fetchWeekById(db, currentWeek!.id);
      const freshSession = freshWeek?.sessions.find(
        s => s.id === currentSession.id,
      );
      if (!freshSession) throw new Error('Session not found');
      const allDone = freshSession.exercises.every(e => e.finished);
      if (!allDone) throw new Error('There are still exercises open');
      await finishSession(db, currentSession.id);
      setCurrentWeek(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          sessions: prev.sessions.map(s =>
            s.id === currentSession.id
              ? {...s, finished: 1, trained_at: new Date().toISOString()}
              : s,
          ),
        };
      });
      setSuccess(true);
    } catch (err) {
      setFinishError((err as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <Loading text="Loading Training" />;
  if (error) return <ErrorComp error={error} />;
  if (!currentSession)
    return <ErrorComp error={new Error('Session not found')} />;

  const total = currentSession.exercises.length;
  const initialFinished = currentSession.exercises.filter(
    e => e.finished,
  ).length;
  const done = Math.max(0, Math.min(total, initialFinished + finishedDelta));
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{paddingBottom: 30, gap: 30}}>
      <View style={styles.progressPill}>
        <View style={[styles.progressFill, {width: `${progressPct}%`}]} />
        <View style={styles.progressContent}>
          <AppText bold style={styles.progressText}>
            {`${done} / ${total} DONE`}
          </AppText>
          <AppText style={styles.progressPct}>{`${progressPct}%`}</AppText>
        </View>
      </View>

      {groupByCircuit(currentSession.exercises).map((group, gi) => (
        <View key={gi} style={group.circuit_rounds ? styles.circuit : null}>
          {group.circuit_rounds && (
            <View style={styles.circuitBadge}>
              <AppText bold>× {group.circuit_rounds} rounds</AppText>
            </View>
          )}
          {group.exercises.map(ex => (
            <Exercise
              key={ex.id}
              exercise={ex}
              history={history.get(ex.exercise_id)}
              onFinishedChange={isDone =>
                setFinishedDelta(d => d + (isDone ? 1 : -1))
              }
            />
          ))}
        </View>
      ))}

      <TacticalButton
        variant={currentSession.finished ? 'green' : 'primary'}
        icon={currentSession.finished ? 'check-circle' : 'flag'}
        onPress={handleFinish}
        title={currentSession.finished ? 'Update Day' : 'Finish Day'}
        fullWidth
      />

      {updating && <LoadingModal loading={updating} />}
      {!!finishError && (
        <Toast
          type="error"
          message={finishError}
          onClose={() => setFinishError(null)}
        />
      )}
      {success && (
        <Toast
          message="Put your cheeso in my taco, bro"
          onClose={() => setSuccess(false)}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.cream, padding: 16},
  circuit: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: 8,
    gap: 8,
  },
  circuitBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  progressPill: {
    backgroundColor: '#111111',
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.primary,
  },
  progressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  progressText: {color: '#FFFFFF', fontSize: 12, letterSpacing: 1.4},
  progressPct: {
    color: '#FFFFFF',
    fontSize: 12,
    letterSpacing: 1.4,
    opacity: 0.85,
  },
});

export default SessionScreen;
