// src/screens/Weeks.tsx
import React from 'react';
import {Button, FlatList, RefreshControl, StyleSheet, View} from 'react-native';

import AppText from '../components/AppText';
import Toast from '../components/Toast';
import LoadingModal from '../components/LoadingModal';
import ErrorComp from '../components/Error';
import Loading from '../components/Loading';
import WeekAccordion from '../components/WeekAccordion';

import {colors} from '../common/theme';
import {
  createWeek,
  fetchActivePlanId,
  fetchPlans,
  fetchWeeksByPlan,
  getDBConnection,
  setActivePlanId,
} from '../common/databaseService';
import type {BaseProps, Plan, Week} from '../common/types';

const Weeks: React.FC<BaseProps> = () => {
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [activePlanId, setActivePlanIdState] = React.useState<number | null>(null);
  const [weeks, setWeeks] = React.useState<Week[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [initError, setInitError] = React.useState<null | Error>(null);
  const [error, setError] = React.useState<null | Error>(null);
  const [updating, setUpdating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [success, setSuccess] = React.useState('');

  const refresh = React.useCallback(async (planId: number) => {
    const db = await getDBConnection();
    setWeeks(await fetchWeeksByPlan(db, planId));
  }, []);

  React.useEffect(() => {
    (async function init() {
      try {
        const db = await getDBConnection();
        const all = await fetchPlans(db);
        setPlans(all);
        const active = (await fetchActivePlanId(db)) ?? all[0]?.id ?? null;
        setActivePlanIdState(active);
        if (active != null) await refresh(active);
      } catch (err) {
        setInitError(err as Error);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  async function handleAddWeek() {
    if (activePlanId == null) return;
    setUpdating(true);
    try {
      const db = await getDBConnection();
      await createWeek(db, activePlanId);
      await refresh(activePlanId);
      setSuccess('Added new Week');
    } catch (err) {
      setError(err as Error);
    } finally {
      setUpdating(false);
    }
  }

  async function handleSelectPlan(planId: number) {
    setActivePlanIdState(planId);
    const db = await getDBConnection();
    await setActivePlanId(db, planId);
    await refresh(planId);
  }

  async function handleRefresh() {
    if (activePlanId == null) return;
    setRefreshing(true);
    await refresh(activePlanId);
    setRefreshing(false);
  }

  if (loading) return <Loading text="Lade Wochen" />;
  if (initError) return <ErrorComp error={initError} />;

  return (
    <View style={styles.container}>
      {plans.length > 1 && (
        <View style={styles.planTabs}>
          {plans.map(p => (
            <Button
              key={p.id}
              color={p.id === activePlanId ? colors.primary : '#aaa'}
              title={p.name}
              onPress={() => handleSelectPlan(p.id)}
            />
          ))}
        </View>
      )}

      {weeks.length === 0 ? (
        <View style={styles.empty}>
          <AppText>Noch keine Daten</AppText>
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

      <Button
        color={colors.primary}
        title="Add new Week"
        onPress={handleAddWeek}
        disabled={updating || activePlanId == null}
      />

      <LoadingModal loading={updating} />
      {!!success && <Toast message={success} onClose={() => setSuccess('')} />}
      {error && (
        <Toast type="error" message={error.message} onClose={() => setError(null)} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16, backgroundColor: '#fff'},
  planTabs: {flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8},
  empty: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  list: {flex: 1},
});

export default Weeks;
