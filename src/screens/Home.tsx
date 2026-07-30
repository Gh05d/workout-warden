// src/screens/Home.tsx
import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  pick,
  types,
  errorCodes,
  isErrorWithCode,
} from '@react-native-documents/picker';

import AppText from '../components/AppText';
import CurrentWeekStrip from '../components/CurrentWeekStrip';
import HeatmapCard from '../components/HeatmapCard';
import Loading from '../components/Loading';
import NextSessionCard from '../components/NextSessionCard';
import PlanCard from '../components/PlanCard';
import PlanSwitcherModal from '../components/PlanSwitcherModal';
import ProgressCard from '../components/ProgressCard';
import TacticalButton from '../components/TacticalButton';
import Toast from '../components/Toast';
import VibeCard from '../components/VibeCard';

import {
  completedScheduledWeekdays,
  isoDate,
  startOfWeek,
  weekdaySetFromLabels,
} from '../components/heatmapMath';

import {colors} from '../common/theme';
import {
  createWeek,
  exportDatabase,
  fetchHeatmapData,
  fetchHomeSummary,
  fetchPlanDays,
  fetchPlans,
  getDBConnection,
  importDatabase,
  initDB,
  setActivePlanId,
} from '../common/databaseService';
import type {BaseProps, Plan, PlanDay, Session, Week} from '../common/types';
import type {
  HomeSummary as HomeSummaryShape,
  HeatmapDatum,
} from '../common/databaseService';

const Home: React.FC<BaseProps> = ({navigation}) => {
  const [summary, setSummary] = React.useState<HomeSummaryShape | null>(null);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [heatmap, setHeatmap] = React.useState<Map<string, HeatmapDatum>>(
    new Map(),
  );
  // The active plan's weekly schedule. Drives the strip's training-vs-rest-day
  // marks and — critically — the Sessions route name (see sessionRouteLabel).
  const [planDays, setPlanDays] = React.useState<PlanDay[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [toastError, setToastError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const db = await getDBConnection();
    // Compute the heatmap window start: 15 full weeks before this Monday, so
    // the grid (16 columns × 7 days) always lines up with full ISO weeks.
    const heatmapFrom = new Date(startOfWeek(new Date()));
    heatmapFrom.setDate(heatmapFrom.getDate() - 15 * 7);
    const fromKey = isoDate(heatmapFrom);

    let [s, p, h] = await Promise.all([
      fetchHomeSummary(db),
      fetchPlans(db),
      fetchHeatmapData(db, fromKey),
    ]);
    // Self-heal: an imported DB may be missing the active_plan_id setting
    // and/or the Surf/Strength seed plans. Re-run initDB once to repair.
    if (s == null) {
      await initDB();
      const db2 = await getDBConnection();
      [s, p, h] = await Promise.all([
        fetchHomeSummary(db2),
        fetchPlans(db2),
        fetchHeatmapData(db2, fromKey),
      ]);
    }
    // plan_days is the *recurring* weekly schedule, which maps onto any calendar
    // week — unlike `weeks` rows, which are not calendar-anchored. A plan may
    // omit weekday labels, in which case no day is marked as scheduled.
    const days = s ? await fetchPlanDays(db, s.activePlan.id) : [];

    setSummary(s);
    setPlans(p);
    setHeatmap(h);
    setPlanDays(days);
  }, []);

  const scheduledWeekdays = React.useMemo(
    () => weekdaySetFromLabels(planDays.map(d => d.weekday_label)),
    [planDays],
  );

  // The strip's checklist: which scheduled weekdays have their session done.
  // Derived from the current week row's finished sessions, mapped to the
  // weekday the plan schedules them on — not the calendar day they were
  // trained — so it agrees with the sessions-finished counter next to it.
  const completedWeekdays = React.useMemo(
    () =>
      completedScheduledWeekdays(
        summary?.currentWeek?.sessions ?? [],
        planDays,
        new Date(),
      ),
    [summary, planDays],
  );

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

  /** Route name of a session's screen in the Sessions top-tab navigator.
   *
   * Must be derived from plan_days, because that's what Routes.tsx names the
   * SubTab.Screens from. A session row carries its own copy of session_name /
   * weekday_label, taken when the week was created — if the plan gained or
   * changed a weekday label since (a SEED_REVISION bump rewrites plan_days),
   * the copy is stale and would name a screen that no longer exists, which
   * navigate() silently no-ops. Falls back to the copy when the day is gone
   * from the plan entirely. */
  function sessionRouteLabel(session: Session): string {
    const day = planDays.find(d => d.day_index === session.day_index);
    if (day) {
      return day.weekday_label
        ? `${day.session_template_name}: ${day.weekday_label}`
        : day.session_template_name;
    }
    return session.weekday_label
      ? `${session.session_name}: ${session.weekday_label}`
      : session.session_name;
  }

  function handleStartSession(session: Session, week: Week) {
    const label = sessionRouteLabel(session);
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

  const errorMessage = error
    ? `Couldn't load Home: ${error.message}`
    : !summary
      ? "No active plan found. The database might be missing its 'active_plan_id' setting — try re-importing your data below, or close and re-open the app to re-seed."
      : null;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {errorMessage && (
          <View style={styles.errorBanner}>
            <AppText bold style={styles.errorBannerTitle}>
              Something went wrong
            </AppText>
            <AppText style={styles.errorBannerBody}>{errorMessage}</AppText>
          </View>
        )}

        {summary && (
          <>
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

            <CurrentWeekStrip
              data={heatmap}
              scheduledWeekdays={scheduledWeekdays}
              completedWeekdays={completedWeekdays}
              activePlanId={summary.activePlan.id}
              weekProgress={
                summary.currentWeek
                  ? {
                      done: summary.currentWeek.sessions.filter(s => s.finished)
                        .length,
                      total: summary.currentWeek.sessions.length,
                    }
                  : null
              }
            />

            <HeatmapCard data={heatmap} plans={plans} />
          </>
        )}

        <VibeCard />
      </ScrollView>

      <View style={styles.dataSection}>
        <AppText style={styles.dataLabel} bold>
          DATA MANAGEMENT
        </AppText>
        <View style={styles.dataButtons}>
          <View style={{flex: 1}}>
            <TacticalButton
              title="Export"
              icon="file-upload"
              variant="dark"
              disabled={submitting}
              loading={submitting}
              fullWidth
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
            <TacticalButton
              title="Import"
              icon="file-download"
              variant="primary"
              disabled={submitting}
              fullWidth
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
        activePlanId={summary?.activePlan.id ?? -1}
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
  root: {flex: 1, backgroundColor: colors.cream},
  scroll: {flex: 1},
  content: {padding: 16, gap: 12, paddingBottom: 16},
  errorBanner: {
    backgroundColor: colors.warnBg,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.warn,
  },
  errorBannerTitle: {fontSize: 15, color: '#bf360c', marginBottom: 4},
  errorBannerBody: {fontSize: 13, color: '#5d4037', lineHeight: 18},
  dataSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    backgroundColor: colors.cream,
    gap: 8,
  },
  dataLabel: {
    fontSize: 11,
    color: colors.faint,
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  dataButtons: {flexDirection: 'row', gap: 8},
});

export default Home;
