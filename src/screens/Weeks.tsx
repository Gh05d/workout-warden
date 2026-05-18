// src/screens/Weeks.tsx
import React from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from '../components/AppText';
import TacticalButton from '../components/TacticalButton';
import Toast from '../components/Toast';
import LoadingModal from '../components/LoadingModal';
import ErrorComp from '../components/Error';
import Loading from '../components/Loading';
import SessionScreen from './Session';
import WeekStrip from '../components/WeekStrip';

import {colors} from '../common/theme';
import {
  createWeek,
  deleteWeek,
  fetchActivePlanId,
  fetchAllWeeks,
  getDBConnection,
} from '../common/databaseService';
import type {BaseProps, Week} from '../common/types';

const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

interface Section {
  title: string;
  data: Week[];
}

/** Pick the month label for a week, preferring the first trained_at over
 * created_at so the section reflects when the user actually worked, not when
 * the row was inserted (which can be the same week for the legacy import). */
function monthKey(w: Week): string {
  const trained = w.sessions
    .map(s => s.trained_at)
    .filter((d): d is string => !!d)
    .sort();
  const iso = trained[0] ?? w.created_at;
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function groupByMonth(weeks: Week[]): Section[] {
  const map = new Map<string, Week[]>();
  for (const w of weeks) {
    const key = monthKey(w);
    const list = map.get(key);
    if (list) list.push(w);
    else map.set(key, [w]);
  }
  // Preserve insertion order — `weeks` already comes ordered newest-first.
  return Array.from(map, ([title, data]) => ({title, data}));
}

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
  const [detail, setDetail] = React.useState<{
    weekID: number;
    day_index: number;
    title: string;
  } | null>(null);

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
      setSuccess('Added new week');
    } catch (err) {
      setError(err as Error);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteWeek(id: number) {
    try {
      const db = await getDBConnection();
      await deleteWeek(db, id);
      setWeeks(state => state.filter(item => item.id !== id));
    } catch (err) {
      setError(err as Error);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  if (loading) return <Loading text="Loading weeks" />;
  if (initError) return <ErrorComp error={initError} />;

  const sections = groupByMonth(weeks);
  // The youngest open week is the "current" anchor — `weeks` is already sorted
  // created_at DESC so the first non-finished one wins.
  const currentWeekId = weeks.find(w => !w.finished)?.id ?? null;

  return (
    <View style={styles.container}>
      {sections.length === 0 ? (
        <EmptyState
          onAddWeek={handleAddWeek}
          disabled={activePlanId == null}
          submitting={updating}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={w => String(w.id)}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.list}
          renderSectionHeader={({section: {title}}) => (
            <View style={styles.sectionHeader}>
              <AppText bold style={styles.sectionTitle}>
                {title}
              </AppText>
            </View>
          )}
          renderItem={({item}) => (
            <WeekStrip
              week={item}
              isCurrent={item.id === currentWeekId}
              onDelete={handleDeleteWeek}
              onOpenSession={(weekID, day_index, title) =>
                setDetail({weekID, day_index, title})
              }
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          SectionSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {sections.length > 0 && (
        <Pressable
          onPress={handleAddWeek}
          disabled={updating || activePlanId == null}
          accessibilityLabel="Add new week"
          style={({pressed}) => [
            styles.fab,
            pressed && styles.fabPressed,
            (updating || activePlanId == null) && styles.fabDisabled,
          ]}>
          <MaterialIcons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      <Modal
        visible={detail != null}
        animationType="slide"
        onRequestClose={() => setDetail(null)}>
        {detail && (
          <SessionScreen
            weekID={detail.weekID}
            day_index={detail.day_index}
            onClose={() => {
              setDetail(null);
              // Refresh weeks so the strip reflects newly-finished sessions
              refresh();
            }}
          />
        )}
      </Modal>

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

interface EmptyStateProps {
  onAddWeek: () => void;
  disabled: boolean;
  submitting: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  onAddWeek,
  disabled,
  submitting,
}) => (
  <View style={styles.empty}>
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <MaterialIcons name="calendar-today" size={32} color={colors.primary} />
      </View>
      <AppText bold style={styles.emptyTitle}>
        NO WEEKS YET
      </AppText>
      <AppText style={styles.emptyBody}>
        A week bundles the sessions of your active plan. Start your first one to
        begin logging sets, reps and weight.
      </AppText>
      <TacticalButton
        title="Start Your First Week"
        icon="play-arrow"
        onPress={onAddWeek}
        disabled={disabled}
        loading={submitting}
        fullWidth
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.cream},
  list: {padding: 16, paddingBottom: 96},

  sectionHeader: {
    backgroundColor: colors.cream,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 11,
    color: colors.faint,
    letterSpacing: 2,
  },

  separator: {height: 10},

  // Empty state
  empty: {flex: 1, justifyContent: 'center', padding: 16},
  emptyCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 24,
    gap: 14,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    backgroundColor: '#FFF3E0',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {fontSize: 14, letterSpacing: 2, color: '#111'},
  emptyBody: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabPressed: {backgroundColor: colors.primaryDeep},
  fabDisabled: {opacity: 0.45},
});

export default Weeks;
