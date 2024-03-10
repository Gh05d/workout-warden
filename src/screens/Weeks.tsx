import React from 'react';
import {StyleSheet, View, FlatList, Button, RefreshControl} from 'react-native';

import {colors} from '../common/variables';
import AppText from '../components/AppText';
import {
  deleteWorkoutProgram,
  fetchWeeks,
  getDBConnection,
  getNewWorkoutProgramType,
  insertWorkoutProgram,
} from '../common/databaseService';
import Toast from '../components/Toast';
import LoadingModal from '../components/LoadingModal';
import Error from '../components/Error';
import Loading from '../components/Loading';
import {boxShadow, row} from '../common/styles';
import WeekAccordion from '../components/WeekAccordion';

const Weeks: React.FC<BaseProps> = ({navigation}) => {
  const [weeks, setWeeks] = React.useState<Week[]>([]);
  const [error, setError] = React.useState<null | Error>(null);
  const [initError, setInitError] = React.useState<null | Error>(null);
  const [loading, setLoading] = React.useState(true);
  const [success, setSuccess] = React.useState('');
  const [updating, setUpdating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    init();
  }, []);

  async function init() {
    try {
      const db = await getDBConnection();
      const res = await fetchWeeks(db);

      if (res?.length) setWeeks(res);
    } catch (err) {
      setInitError(err as Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    await setRefreshing(true);
    await init();
    await setRefreshing(false);
  }

  const renderItem = React.useCallback(
    ({item}: {item: Week}) => (
      <WeekAccordion {...item} setWeeks={setWeeks} setError={setError} />
    ),
    [],
  );

  async function createWeek() {
    try {
      await setUpdating(true);

      const db = await getDBConnection();
      const type = await getNewWorkoutProgramType(db);
      await insertWorkoutProgram(db, type);

      const res = await fetchWeeks(db);
      setWeeks(res);
      setSuccess('Added new Week');
    } catch (err) {
      setError(err as Error);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <Loading text="Lade Wochen" />;
  if (initError) return <Error error={initError} />;

  return (
    <View style={styles.container}>
      {weeks.length ? (
        <FlatList
          data={weeks}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.start_date}-${index}`}
          style={styles.root}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : (
        <View style={styles.root}>
          <AppText>Noch keine Daten</AppText>
        </View>
      )}

      <Button
        color={colors.primary}
        title="Add new Week"
        onPress={createWeek}
        disabled={updating}
      />

      <LoadingModal loading={updating} />
      {!!success && <Toast message={success} onClose={() => setSuccess('')} />}
      {error && (
        <Toast
          type="error"
          message={error.message}
          onClose={() => setError(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  root: {flex: 1},
});

export default Weeks;
