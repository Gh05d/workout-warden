// src/screens/Home.tsx
import React from 'react';
import {Button, ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  pick,
  types,
  errorCodes,
  isErrorWithCode,
} from '@react-native-documents/picker';

import AppText from '../components/AppText';
import ErrorComp from '../components/Error';
import Loading from '../components/Loading';
import NextSessionCard from '../components/NextSessionCard';
import PlanCard from '../components/PlanCard';
import PlanSwitcherModal from '../components/PlanSwitcherModal';
import ProgressCard from '../components/ProgressCard';
import Toast from '../components/Toast';
import VibeCard from '../components/VibeCard';

import {colors} from '../common/theme';
import {
  createWeek,
  exportDatabase,
  fetchHomeSummary,
  fetchPlans,
  getDBConnection,
  importDatabase,
  setActivePlanId,
} from '../common/databaseService';
import type {BaseProps, Plan, Session, Week} from '../common/types';
import type {HomeSummary as HomeSummaryShape} from '../common/databaseService';

const Home: React.FC<BaseProps> = ({route, navigation}) => {
  const {puppy} = route?.params as {puppy: string};

  const [summary, setSummary] = React.useState<HomeSummaryShape | null>(null);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [toastError, setToastError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const db = await getDBConnection();
    const [s, p] = await Promise.all([fetchHomeSummary(db), fetchPlans(db)]);
    setSummary(s);
    setPlans(p);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          await refresh();
        } catch (err) {
          setError(err as Error);
        } finally {
          setLoading(false);
        }
      })();
    }, [refresh]),
  );

  async function handleSelectPlan(planId: number) {
    try {
      const db = await getDBConnection();
      await setActivePlanId(db, planId);
      setModalVisible(false);
      await refresh();
    } catch (err) {
      setToastError((err as Error).message);
    }
  }

  async function handleCreateNextWeek() {
    if (!summary) return;
    try {
      const db = await getDBConnection();
      await createWeek(db, summary.activePlan.id);
      const fresh = await fetchHomeSummary(db);
      setSummary(fresh);
      // Auto-navigate to the first session of the new week
      if (fresh?.nextSession && fresh.currentWeek) {
        handleStartSession(fresh.nextSession, fresh.currentWeek);
      }
    } catch (err) {
      setToastError((err as Error).message);
    }
  }

  function handleStartSession(session: Session, week: Week) {
    const label = session.weekday_label
      ? `${session.session_name}: ${session.weekday_label}`
      : session.session_name;
    navigation.navigate('Sessions', {
      screen: label,
      params: {weekID: week.id, day_index: session.day_index, title: label},
    });
  }

  async function pickFile(): Promise<string | undefined> {
    try {
      const [res] = await pick({type: [types.allFiles]});
      return res.uri;
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      throw err;
    }
  }

  if (loading) return <Loading text="Loading" />;
  if (error) return <ErrorComp error={error} />;
  if (!summary) return <ErrorComp error={new Error('No active plan')} />;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <PlanCard
          plan={summary.activePlan}
          onPress={() => setModalVisible(true)}
        />

        <NextSessionCard
          currentWeek={summary.currentWeek}
          nextSession={summary.nextSession}
          onStartSession={handleStartSession}
          onCreateNextWeek={handleCreateNextWeek}
        />

        {summary.currentWeek && (
          <ProgressCard
            week={summary.currentWeek}
            onPress={() => navigation.navigate('Weeks')}
          />
        )}

        <VibeCard puppy={puppy} />
      </ScrollView>

      <View style={styles.dataSection}>
        <AppText style={styles.dataLabel}>Data management</AppText>
        <View style={styles.dataButtons}>
          <View style={{flex: 1}}>
            <Button
              color={colors.primary}
              title="Export"
              disabled={submitting}
              onPress={async () => {
                setSubmitting(true);
                try {
                  await exportDatabase();
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          </View>
          <View style={{flex: 1}}>
            <Button
              color={colors.primary}
              title="Import"
              disabled={submitting}
              onPress={async () => {
                setSubmitting(true);
                try {
                  const data = await pickFile();
                  if (data) {
                    await importDatabase(data);
                    await refresh();
                  }
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          </View>
        </View>
      </View>

      <PlanSwitcherModal
        visible={modalVisible}
        plans={plans}
        activePlanId={summary.activePlan.id}
        onSelect={handleSelectPlan}
        onClose={() => setModalVisible(false)}
      />

      {!!toastError && (
        <Toast
          type="error"
          message={toastError}
          onClose={() => setToastError(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#f5f5f7'},
  scroll: {flex: 1},
  content: {padding: 16, gap: 12, paddingBottom: 16},
  dataSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#f5f5f7',
  },
  dataLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  dataButtons: {flexDirection: 'row', gap: 12},
});

export default Home;
