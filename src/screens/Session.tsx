import React from 'react';
import {Button, ScrollView, StyleSheet, View} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useFocusEffect} from '@react-navigation/native';

import Loading from '../components/Loading';
import ErrorComp from '../components/Error';
import Exercise from '../components/Exercise';
import LoadingModal from '../components/LoadingModal';
import Toast from '../components/Toast';

import {colors} from '../common/variables';
import {displayDate} from '../common/functions';
import {
  fetchWeekByID,
  fetchWeeks,
  getDBConnection,
  getNewWorkoutProgramType,
  insertWorkoutProgram,
} from '../common/databaseService';

interface RouteParams {
  weekID: number;
  day: number;
  title: string;
}

const Session: React.FC<BaseProps> = ({navigation, route}) => {
  const {weekID, day} = route.params as RouteParams;

  const [currentWeekID, setCurrentWeekID] = React.useState<number>(0);
  const [trainingWeek, setTrainingWeek] = React.useState<Week | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [error, setError] = React.useState<null | Error>(null);
  const [finishError, setFinishError] = React.useState<null | string>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    (async function check() {
      try {
        const db = await getDBConnection();
        const week = await fetchWeekByID(db, currentWeekID);

        if (!week?.finished) {
          for (const trainingDay of week.sessions) {
            if (!trainingDay?.finished) return;
          }

          const query = `UPDATE workout_programs SET finished = 1 WHERE id = ?;`;
          await db.executeSql(query, [week.id]);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [success]);

  useFocusEffect(
    React.useCallback(() => {
      (async function init() {
        setLoading(true);
        try {
          const db = await getDBConnection();

          if (weekID) {
            const week = await fetchWeekByID(db, weekID);

            setTrainingWeek(week);
            setCurrentWeekID(weekID);
          } else {
            const weeks = await fetchWeeks(db);

            if (weeks?.length) {
              const latestWeek = weeks.pop();

              setTrainingWeek(latestWeek);
              setCurrentWeekID(latestWeek.id);
            } else {
              // No weeks found, insert new workout program
              const type = await getNewWorkoutProgramType(db);
              await insertWorkoutProgram(db, type);
              const [initialWeek] = await fetchWeeks(db);
              setTrainingWeek(initialWeek);
              setCurrentWeekID(initialWeek.id);
            }
          }
        } catch (err) {
          setError(err as Error);
        } finally {
          setLoading(false);
        }
      })();
    }, [weekID]),
  );

  useFocusEffect(
    React.useCallback(() => {
      const parentNavigation = navigation.getParent();
      if (parentNavigation && trainingWeek?.start_date) {
        parentNavigation.setOptions({
          title:
            trainingWeek.start_date && trainingWeek.end_date
              ? `Week ${currentWeekID}: ${displayDate(
                  trainingWeek.start_date,
                  trainingWeek.end_date,
                )}`
              : 'Loading...',
        });
      }
    }, [
      navigation,
      currentWeekID,
      trainingWeek?.start_date,
      trainingWeek?.end_date,
    ]),
  );

  async function handleFinish() {
    try {
      await setUpdating(true);
      const db = await getDBConnection();
      const week = await fetchWeekByID(db, currentWeekID);

      week?.sessions[day]?.exercises?.forEach((exercise: Exercise) => {
        if (!exercise?.finished) throw Error('There are still exercises open');
      });

      const sessionID = trainingWeek?.sessions[day]?.id;
      const query = `UPDATE training_days SET finished = 1 WHERE id = ?;`;
      await db.executeSql(query, [sessionID]);

      setTrainingWeek(state => {
        const sessionsCopy = [...state!.sessions];
        sessionsCopy[day] = {...sessionsCopy[day], finished: 1};

        return {...state, sessions: sessionsCopy};
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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{paddingBottom: 30, gap: 30}}>
      {trainingWeek?.sessions[day].exercises?.map(exercise => (
        <View style={{alignItems: 'center'}} key={exercise.id}>
          <Exercise {...exercise} />
          {!!exercise.next && (
            <View style={{marginHorizontal: 10, marginTop: 20}}>
              <MaterialIcons name="repeat" size={30} color={colors.primary} />
            </View>
          )}
        </View>
      ))}

      <Button
        color={colors.primary}
        onPress={handleFinish}
        title={
          trainingWeek?.sessions[day]?.finished ? 'Update day' : 'Finish day'
        }
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
  root: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    padding: 16,
  },
});

export default Session;
