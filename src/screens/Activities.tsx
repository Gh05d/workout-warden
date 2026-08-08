// src/screens/Activities.tsx
//
// Fifth bottom tab: the free-form activity log (surf, altinha). List of
// sessions grouped by ISO week with per-week totals. Add/edit arrives with
// ActivitySessionModal (separate task); this screen is read-only until then.

import React from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {SectionList, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from '../components/AppText';
import ErrorComp from '../components/Error';
import Loading from '../components/Loading';

import {colors} from '../common/theme';
import {activityColor} from '../common/planColor';
import {
  fetchActivitySessions,
  getDBConnection,
} from '../common/databaseService';
import {
  formatTotals,
  groupByIsoWeek,
  parseIsoDate,
} from '../components/activityStats';
import type {ActivitySession} from '../common/types';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dayLabel(performedAt: string): string {
  const d = parseIsoDate(performedAt);
  return `${DAY_NAMES[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

const Activities: React.FC = () => {
  const [sessions, setSessions] = React.useState<ActivitySession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [initError, setInitError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    const db = await getDBConnection();
    setSessions(await fetchActivitySessions(db));
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
          </View>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={s => String(s.id)}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.list}
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
          renderItem={({item}) => <SessionRowComp session={item} />}
          ItemSeparatorComponent={SectionSeparator}
        />
      )}
    </View>
  );
};

const SectionSeparator: React.FC = () => <View style={styles.separator} />;

const SessionRowComp: React.FC<{session: ActivitySession}> = ({session}) => {
  const c = activityColor(session.activity_id);
  return (
    <View style={styles.row}>
      <View style={[styles.rail, {backgroundColor: c.fg}]} />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <AppText bold style={[styles.rowActivity, {color: c.fg}]}>
            {session.activity_name.toUpperCase()}
          </AppText>
          <AppText style={styles.rowDate}>
            {dayLabel(session.performed_at)}
          </AppText>
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
        </View>
        {!!session.note && (
          <AppText style={styles.rowNote}>{session.note}</AppText>
        )}
      </View>
    </View>
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
  rowMeta: {flexDirection: 'row', gap: 12},
  rowMetaText: {fontSize: 11, color: colors.muted, letterSpacing: 1},
  rowNote: {fontSize: 13, color: colors.ink, lineHeight: 18},
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
});

export default Activities;
