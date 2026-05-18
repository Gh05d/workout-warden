// src/screens/Weeks.tsx
import React from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {FlatList, RefreshControl, StyleSheet, View} from 'react-native';

import AppText from '../components/AppText';
import TacticalButton from '../components/TacticalButton';
import Toast from '../components/Toast';
import LoadingModal from '../components/LoadingModal';
import ErrorComp from '../components/Error';
import Loading from '../components/Loading';
import WeekAccordion from '../components/WeekAccordion';

import {colors} from '../common/theme';
import {
  createWeek,
  fetchActivePlanId,
  fetchAllWeeks,
  getDBConnection,
} from '../common/databaseService';
import type {BaseProps, Week} from '../common/types';

const Weeks: React.FC<BaseProps> = () => {
  const [activePlanId, setActivePlanIdState] = React.useState<number | null>(
    null,
  );
  const [weeks, setWeeks] = React.useState<Week[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [initError, setInitError] = React.useState<null | Error>(null);
  const [error, setError] = React.useState<null | Error>(null);
  const [updating, setUpdating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [success, setSuccess] = React.useState('');

  const refresh = React.useCallback(async () => {
    const db = await getDBConnection();
    setWeeks(await fetchAllWeeks(db));
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async function init() {
        setLoading(true);
        try {
          const db = await getDBConnection();
          setActivePlanIdState(await fetchActivePlanId(db));
          await refresh();
        } catch (err) {
          setInitError(err as Error);
        } finally {
          setLoading(false);
        }
      })();
    }, [refresh]),
  );

  async function handleAddWeek() {
    if (activePlanId == null) return;
    setUpdating(true);
    try {
      const db = await getDBConnection();
      await createWeek(db, activePlanId);
      await refresh();
      setSuccess('Added new Week');
    } catch (err) {
      setError(err as Error);
    } finally {
      setUpdating(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  if (loading) return <Loading text="Loading weeks" />;
  if (initError) return <ErrorComp error={initError} />;

  return (
    <View style={styles.container}>
      {weeks.length === 0 ? (
        <View style={styles.empty}>
          <AppText>No weeks yet</AppText>
        </View>
      ) : (
        <FlatList
          data={weeks}
          keyExtractor={w => String(w.id)}
          renderItem={({item}) => (
            <WeekAccordion
              week={item}
              setWeeks={setWeeks}
              setUpdating={setUpdating}
              setError={setError}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          style={styles.list}
        />
      )}

      <TacticalButton
        title="Add New Week"
        icon="add"
        onPress={handleAddWeek}
        disabled={updating || activePlanId == null}
        loading={updating}
        fullWidth
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
  container: {flex: 1, padding: 16, backgroundColor: colors.cream, gap: 12},
  empty: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  list: {flex: 1},
});

export default Weeks;
