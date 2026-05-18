// src/components/WeekStrip.tsx
//
// Compact week strip — replaces WeekAccordion. Expanded body now shows the
// session list (tap → jump straight into Session screen), NOT the wall of
// exercises and sets that WeekAccordion used to dump.

import React from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import Reanimated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import AppText from './AppText';
import {colors} from '../common/theme';
import {planColor} from '../common/planColor';
import type {Session, Week} from '../common/types';

interface Props {
  week: Week;
  isCurrent: boolean;
  onDelete: (id: number) => void;
  onOpenSession: (weekID: number, day_index: number, title: string) => void;
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}`;
}

function sessionRouteLabel(s: Session): string {
  return s.weekday_label
    ? `${s.session_name}: ${s.weekday_label}`
    : s.session_name;
}

const WeekStrip: React.FC<Props> = ({
  week,
  isCurrent,
  onDelete,
  onOpenSession,
}) => {
  const [open, setOpen] = React.useState(false);
  const c = planColor(week.plan_id);

  const total = week.sessions.length;
  const done = week.sessions.filter(s => s.finished).length;
  const pct = total === 0 ? 0 : done / total;

  const trainedDates = week.sessions
    .map(s => s.trained_at)
    .filter((d): d is string => !!d)
    .sort();
  const dateRange =
    trainedDates.length > 0
      ? `${shortDate(trainedDates[0])} – ${shortDate(trainedDates[trainedDates.length - 1])}`
      : `created ${shortDate(week.created_at)}`;

  function handleSessionTap(s: Session) {
    // Defer to the parent — Weeks shows the session in a Modal. We can't use
    // the Sessions top-tab navigator here because its screens are generated
    // from the ACTIVE plan; this week might belong to a different plan.
    onOpenSession(week.id, s.day_index, sessionRouteLabel(s));
  }

  function confirmDelete() {
    Alert.alert(
      'Delete Week',
      `Delete Week ${week.id}? Logged sets will be lost.`,
      [
        {text: 'Cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(week.id),
        },
      ],
    );
  }

  return (
    <Reanimated.View
      layout={LinearTransition.duration(220)}
      style={[styles.card, !!week.finished && styles.cardDone]}>
      <Pressable onPress={() => setOpen(o => !o)} style={styles.headerRow}>
        <View style={[styles.rail, {backgroundColor: c.fg}]} />
        <View style={styles.body}>
          <View style={styles.topLine}>
            <AppText bold style={styles.weekNo}>
              {`WEEK ${week.id}`}
            </AppText>
            <View style={[styles.pill, {backgroundColor: c.bg}]}>
              <AppText bold style={[styles.pillText, {color: c.fg}]}>
                {week.plan_name.toUpperCase()}
              </AppText>
            </View>
            <View style={styles.spacer} />
            {isCurrent && (
              <View style={styles.currentTag}>
                <AppText bold style={styles.currentTagText}>
                  CURRENT
                </AppText>
              </View>
            )}
          </View>

          <View style={styles.midLine}>
            <AppText style={styles.dateRange}>{dateRange}</AppText>
            <AppText style={styles.progressText} bold>
              {`${done}/${total}`}
            </AppText>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${pct * 100}%`,
                  backgroundColor: week.finished ? colors.secondary : c.fg,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.chevron}>
          <MaterialIcons
            name={open ? 'expand-less' : 'expand-more'}
            size={22}
            color={colors.faint}
          />
        </View>
      </Pressable>

      {open && (
        <Reanimated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={styles.expanded}>
          {week.sessions.length === 0 ? (
            <AppText italic style={styles.emptyText}>
              No sessions in this week.
            </AppText>
          ) : (
            week.sessions.map(s => (
              <Pressable
                key={s.id}
                onPress={() => handleSessionTap(s)}
                style={[
                  styles.sessionRow,
                  !!s.finished && styles.sessionRowDone,
                ]}>
                <MaterialIcons
                  name={s.finished ? 'check-circle' : 'radio-button-unchecked'}
                  size={20}
                  color={s.finished ? colors.secondary : colors.faint}
                />
                <View style={styles.sessionTextWrap}>
                  <AppText bold style={styles.sessionName}>
                    {s.session_name}
                  </AppText>
                  {!!s.weekday_label && (
                    <AppText style={styles.sessionDay}>
                      {s.weekday_label}
                    </AppText>
                  )}
                </View>
                {!!s.trained_at && (
                  <AppText style={styles.sessionDate}>
                    {shortDate(s.trained_at)}
                  </AppText>
                )}
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={colors.faint}
                />
              </Pressable>
            ))
          )}

          <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
            <MaterialIcons
              name="delete-outline"
              size={16}
              color={colors.muted}
            />
            <AppText bold style={styles.deleteText}>
              DELETE WEEK
            </AppText>
          </Pressable>
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
    overflow: 'hidden',
  },
  cardDone: {backgroundColor: '#F6FAF6', borderColor: '#D8E5D8'},

  headerRow: {flexDirection: 'row', alignItems: 'stretch'},
  rail: {width: 4},
  body: {flex: 1, paddingVertical: 12, paddingHorizontal: 12, gap: 6},
  chevron: {width: 36, justifyContent: 'center', alignItems: 'center'},

  topLine: {flexDirection: 'row', alignItems: 'center', gap: 8},
  weekNo: {fontSize: 13, color: '#111', letterSpacing: 1.4},
  pill: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10},
  pillText: {fontSize: 10, letterSpacing: 1.4},
  spacer: {flex: 1},

  currentTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  currentTagText: {color: '#FFFFFF', fontSize: 9, letterSpacing: 1.4},

  midLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  dateRange: {fontSize: 12, color: colors.muted},
  progressText: {fontSize: 12, color: colors.muted, letterSpacing: 0.8},

  progressTrack: {
    height: 3,
    backgroundColor: '#EEEEEE',
    overflow: 'hidden',
  },
  progressFill: {height: '100%'},

  expanded: {
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    padding: 8,
    gap: 4,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 10,
  },
  sessionRowDone: {opacity: 0.7},
  sessionTextWrap: {flex: 1},
  sessionName: {fontSize: 14, color: '#111'},
  sessionDay: {fontSize: 11, color: colors.faint, letterSpacing: 0.5},
  sessionDate: {
    fontSize: 12,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },

  emptyText: {color: colors.muted, padding: 12},

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  deleteText: {fontSize: 10, color: colors.muted, letterSpacing: 1.4},
});

export default WeekStrip;
