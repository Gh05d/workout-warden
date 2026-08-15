// src/screens/Activities.tsx
//
// Fifth bottom tab: the free-form activity log (surf, altinha). List of
// sessions grouped by ISO week with per-week totals. Add/edit/delete go
// through ActivitySessionModal, opened from the FAB or by tapping a row.

import React from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Pressable, SectionList, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from '../components/AppText';
import ErrorComp from '../components/Error';
import Loading from '../components/Loading';
import TacticalButton from '../components/TacticalButton';
import ActivitySessionModal from '../components/ActivitySessionModal';
import ActivityWeeklyBars from '../components/ActivityWeeklyBars';

import {colors} from '../common/theme';
import {activityColor} from '../common/planColor';
import {ratingEmoji, splitNotes} from '../common/activityLog';
import {
  createActivitySession,
  deleteActivitySession,
  fetchActivities,
  fetchActivitySessions,
  fetchRecentSpots,
  getDBConnection,
  updateActivitySession,
} from '../common/databaseService';
import {
  formatTotals,
  groupByIsoWeek,
  parseIsoDate,
} from '../components/activityStats';
import type {
  Activity,
  ActivitySession,
  ActivitySessionDraft,
} from '../common/types';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dayLabel(performedAt: string): string {
  const d = parseIsoDate(performedAt);
  return `${DAY_NAMES[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

const Activities: React.FC = () => {
  const [sessions, setSessions] = React.useState<ActivitySession[]>([]);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [recentSpots, setRecentSpots] = React.useState<Map<number, string[]>>(
    new Map(),
  );
  const [loading, setLoading] = React.useState(true);
  const [initError, setInitError] = React.useState<Error | null>(null);

  const [editing, setEditing] = React.useState<ActivitySession | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    const db = await getDBConnection();
    setSessions(await fetchActivitySessions(db));
    setActivities(await fetchActivities(db));
    setRecentSpots(await fetchRecentSpots(db));
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          await refresh();
        } catch (err) {
          setInitError(err as Error);
        } finally {
          setLoading(false);
        }
      })();
    }, [refresh]),
  );

  async function handleSave(draft: ActivitySessionDraft) {
    setError(null);
    try {
      const db = await getDBConnection();
      if (editing) await updateActivitySession(db, editing.id, draft);
      else await createActivitySession(db, draft);
      setModalVisible(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err as Error);
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      const db = await getDBConnection();
      await deleteActivitySession(db, id);
      setModalVisible(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err as Error);
    }
  }

  function openCreate() {
    setEditing(null);
    setModalVisible(true);
  }

  function openEdit(session: ActivitySession) {
    setEditing(session);
    setModalVisible(true);
  }

  if (loading) return <Loading text="Loading activities" />;
  if (initError) return <ErrorComp error={initError} />;

  const groups = groupByIsoWeek(sessions);
  const sections = groups.map(g => ({
    title: g.label,
    subtitle: formatTotals(g.totals),
    data: g.sessions,
  }));

  return (
    <View style={styles.container}>
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <MaterialIcons name="surfing" size={32} color={colors.primary} />
            </View>
            <AppText bold style={styles.emptyTitle}>
              NO ACTIVITIES YET
            </AppText>
            <AppText style={styles.emptyBody}>
              Surf sessions and altinha games live here — logged free-form, no
              plan attached.
            </AppText>
            <TacticalButton
              title="Log Your First Session"
              icon="add"
              onPress={openCreate}
              fullWidth
            />
          </View>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={s => String(s.id)}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={{marginBottom: 12}}>
              <ActivityWeeklyBars sessions={sessions} />
            </View>
          }
          renderSectionHeader={({section}) => (
            <View style={styles.sectionHeader}>
              <AppText bold style={styles.sectionTitle}>
                {section.title}
              </AppText>
              <AppText style={styles.sectionSubtitle}>
                {section.subtitle}
              </AppText>
            </View>
          )}
          renderItem={({item}) => (
            <SessionRowComp session={item} onPress={() => openEdit(item)} />
          )}
          ItemSeparatorComponent={SectionSeparator}
        />
      )}

      {sections.length > 0 && (
        <Pressable
          onPress={openCreate}
          accessibilityLabel="Log activity"
          style={({pressed}) => [styles.fab, pressed && styles.fabPressed]}>
          <MaterialIcons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      <ActivitySessionModal
        visible={modalVisible}
        activities={activities}
        initial={editing}
        error={error?.message ?? null}
        recentSpotsByActivity={recentSpots}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => {
          setModalVisible(false);
          setEditing(null);
          setError(null);
        }}
        onClearError={() => setError(null)}
      />
    </View>
  );
};

const SectionSeparator: React.FC = () => <View style={styles.separator} />;

const SessionRowComp: React.FC<{
  session: ActivitySession;
  onPress: () => void;
}> = ({session, onPress}) => {
  const c = activityColor(session.activity_id);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({pressed}) => [styles.row, pressed && {opacity: 0.85}]}>
      <View style={[styles.rail, {backgroundColor: c.fg}]} />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <AppText bold style={[styles.rowActivity, {color: c.fg}]}>
            {session.activity_name.toUpperCase()}
          </AppText>
          <View style={styles.rowHeadRight}>
            {!!ratingEmoji(session.rating) && (
              <AppText style={styles.rowRating}>
                {ratingEmoji(session.rating)}
              </AppText>
            )}
            <AppText style={styles.rowDate}>
              {dayLabel(session.performed_at)}
            </AppText>
          </View>
        </View>
        <View style={styles.rowMeta}>
          <AppText style={styles.rowMetaText}>
            {session.duration_minutes !== null
              ? `${session.duration_minutes} MIN`
              : '—'}
          </AppText>
          {!!session.spot && (
            <AppText style={styles.rowMetaText}>
              {session.spot.toUpperCase()}
            </AppText>
          )}
          {session.kcal != null && (
            <AppText style={styles.rowMetaText}>
              {`~${session.kcal} KCAL`}
            </AppText>
          )}
        </View>
        {splitNotes(session.note).map((line, i) => (
          <View key={i} style={styles.rowNoteLine}>
            <AppText style={styles.rowNoteBullet}>–</AppText>
            <AppText style={styles.rowNote}>{line}</AppText>
          </View>
        ))}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.cream},
  list: {padding: 16, paddingBottom: 96},
  sectionHeader: {
    backgroundColor: colors.cream,
    paddingVertical: 8,
    gap: 2,
  },
  sectionTitle: {fontSize: 11, color: colors.faint, letterSpacing: 2},
  sectionSubtitle: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  separator: {height: 10},
  row: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  rail: {width: 3},
  rowBody: {flex: 1, padding: 12, gap: 4},
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowActivity: {fontSize: 12, letterSpacing: 1.4},
  rowDate: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  rowHeadRight: {flexDirection: 'row', alignItems: 'center', gap: 8},
  rowRating: {fontSize: 14, lineHeight: 18},
  rowMeta: {flexDirection: 'row', gap: 12},
  rowMetaText: {fontSize: 11, color: colors.muted, letterSpacing: 1},
  rowNoteLine: {flexDirection: 'row', gap: 6, alignItems: 'flex-start'},
  rowNoteBullet: {fontSize: 13, color: colors.muted, lineHeight: 18},
  rowNote: {flex: 1, fontSize: 13, color: colors.ink, lineHeight: 18},
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
    backgroundColor: colors.warnBg,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {fontSize: 14, letterSpacing: 2, color: colors.ink},
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
});

export default Activities;
