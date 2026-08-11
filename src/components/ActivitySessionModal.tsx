// src/components/ActivitySessionModal.tsx
//
// Create/edit sheet for one activity session. Deliberately dependency-free:
// date = day stepper (backdating is the use case, not arbitrary jumps),
// duration = quick chips + numeric field.

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import TacticalButton from './TacticalButton';
import {colors} from '../common/theme';
import {activityColor} from '../common/planColor';
import {joinNotes, splitNotes, RATING_EMOJIS} from '../common/activityLog';
import {isoDate} from './heatmapMath';
import {parseIsoDate} from './activityStats';
import type {
  Activity,
  ActivitySession,
  ActivitySessionDraft,
} from '../common/types';

interface Props {
  visible: boolean;
  activities: Activity[];
  initial: ActivitySession | null;
  error?: string | null;
  /** Recently used spots per activity (fetchRecentSpots) — one-tap chips. */
  recentSpotsByActivity: Map<number, string[]>;
  onSave: (draft: ActivitySessionDraft) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
  onClearError: () => void;
}

const DURATION_CHIPS = [30, 60, 90, 120];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function stepDay(dateStr: string, delta: number): string {
  const d = parseIsoDate(dateStr);
  d.setDate(d.getDate() + delta);
  return isoDate(d);
}

function dateLabel(dateStr: string): string {
  const d = parseIsoDate(dateStr);
  return `${DAY_NAMES[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

const ActivitySessionModal: React.FC<Props> = ({
  visible,
  activities,
  initial,
  error,
  recentSpotsByActivity,
  onSave,
  onDelete,
  onClose,
  onClearError,
}) => {
  const [activityId, setActivityId] = React.useState<number>(0);
  const [performedAt, setPerformedAt] = React.useState<string>('');
  const [duration, setDuration] = React.useState<string>('');
  const [spot, setSpot] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string[]>(['']);
  const [rating, setRating] = React.useState<number | null>(null);

  // Re-seed the form whenever the sheet opens (or switches session).
  React.useEffect(() => {
    if (!visible) return;
    setActivityId(initial?.activity_id ?? activities[0]?.id ?? 0);
    setPerformedAt(initial?.performed_at ?? isoDate(new Date()));
    setDuration(
      initial?.duration_minutes != null ? String(initial.duration_minutes) : '',
    );
    setSpot(initial?.spot ?? '');
    const seeded = splitNotes(initial?.note ?? null);
    setNotes(seeded.length > 0 ? seeded : ['']);
    setRating(initial?.rating ?? null);
  }, [visible, initial, activities]);

  const todayKey = isoDate(new Date());
  const parsedDuration = parseInt(duration, 10);
  const durationMinutes =
    Number.isFinite(parsedDuration) && parsedDuration > 0
      ? parsedDuration
      : null;

  const spotChips = recentSpotsByActivity.get(activityId) ?? [];

  function setNoteAt(index: number, text: string) {
    setNotes(prev => prev.map((n, i) => (i === index ? text : n)));
  }

  function removeNoteAt(index: number) {
    setNotes(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [''];
    });
  }

  function handleSave() {
    onSave({
      activityId,
      performedAt,
      durationMinutes,
      spot: spot.trim() || null,
      note: joinNotes(notes),
      rating,
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.body}>
            <AppText bold style={styles.title}>
              {initial ? 'EDIT ACTIVITY' : 'LOG ACTIVITY'}
            </AppText>

            <AppText style={styles.fieldLabel}>ACTIVITY</AppText>
            <View style={styles.pillRow}>
              {activities.map(a => {
                const selected = a.id === activityId;
                const c = activityColor(a.id);
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setActivityId(a.id)}
                    accessibilityRole="button"
                    accessibilityState={{selected}}
                    style={[
                      styles.pill,
                      {borderColor: c.fg},
                      selected && {backgroundColor: c.fg},
                    ]}>
                    <AppText
                      bold
                      style={[
                        styles.pillText,
                        {color: selected ? '#FFFFFF' : c.fg},
                      ]}>
                      {a.name.toUpperCase()}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <AppText style={styles.fieldLabel}>DATE</AppText>
            <View style={styles.dateRow}>
              <Pressable
                onPress={() => setPerformedAt(stepDay(performedAt, -1))}
                accessibilityLabel="Previous day"
                style={styles.dateStep}>
                <MaterialIcons
                  name="chevron-left"
                  size={24}
                  color={colors.ink}
                />
              </Pressable>
              <AppText bold style={styles.dateLabel}>
                {performedAt ? dateLabel(performedAt) : ''}
              </AppText>
              <Pressable
                onPress={() => setPerformedAt(stepDay(performedAt, 1))}
                disabled={performedAt >= todayKey}
                accessibilityLabel="Next day"
                style={[
                  styles.dateStep,
                  performedAt >= todayKey && styles.dateStepDisabled,
                ]}>
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color={colors.ink}
                />
              </Pressable>
            </View>

            <AppText style={styles.fieldLabel}>RATING</AppText>
            <View style={styles.pillRow}>
              {RATING_EMOJIS.map((emoji, i) => {
                const value = i + 1;
                const selected = rating === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setRating(selected ? null : value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Rating ${value} of 5`}
                    accessibilityState={{selected}}
                    style={[
                      styles.ratingChip,
                      selected && styles.ratingChipSelected,
                    ]}>
                    <AppText
                      style={[
                        styles.ratingEmoji,
                        !selected && styles.ratingEmojiDimmed,
                      ]}>
                      {emoji}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <AppText style={styles.fieldLabel}>DURATION (MIN)</AppText>
            <View style={styles.pillRow}>
              {DURATION_CHIPS.map(m => {
                const selected = duration === String(m);
                return (
                  <Pressable
                    key={m}
                    onPress={() => setDuration(selected ? '' : String(m))}
                    accessibilityRole="button"
                    accessibilityState={{selected}}
                    style={[styles.chip, selected && styles.chipSelected]}>
                    <AppText
                      bold
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}>
                      {String(m)}
                    </AppText>
                  </Pressable>
                );
              })}
              <TextInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={colors.ghost}
                accessibilityLabel="Duration in minutes"
                style={styles.numField}
              />
            </View>

            <AppText style={styles.fieldLabel}>SPOT</AppText>
            <TextInput
              value={spot}
              onChangeText={setSpot}
              placeholder="e.g. Uluwatu / Praia do Forte"
              placeholderTextColor={colors.ghost}
              accessibilityLabel="Spot"
              style={styles.textField}
            />

            {spotChips.length > 0 && (
              <View style={styles.pillRow}>
                {spotChips.map(s => {
                  const selected = spot.trim() === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setSpot(selected ? '' : s)}
                      accessibilityRole="button"
                      accessibilityState={{selected}}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <AppText
                        bold
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}>
                        {s.toUpperCase()}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <AppText style={styles.fieldLabel}>NOTES</AppText>
            {notes.map((n, i) => (
              <View key={i} style={styles.noteRow}>
                <TextInput
                  value={n}
                  onChangeText={text => setNoteAt(i, text)}
                  placeholder="Conditions, people, how it went…"
                  placeholderTextColor={colors.ghost}
                  autoFocus={
                    i === notes.length - 1 && n === '' && notes.length > 1
                  }
                  accessibilityLabel={`Note ${i + 1}`}
                  style={[styles.textField, styles.noteInput]}
                />
                <Pressable
                  onPress={() => removeNoteAt(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove note ${i + 1}`}
                  style={styles.noteRemove}>
                  <MaterialIcons name="remove" size={20} color={colors.ink} />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => setNotes(prev => [...prev, ''])}
              accessibilityRole="button"
              accessibilityLabel="Add note"
              style={styles.noteAdd}>
              <MaterialIcons name="add" size={18} color={colors.primary} />
              <AppText bold style={styles.noteAddText}>
                ADD NOTE
              </AppText>
            </Pressable>

            {!!error && (
              <Pressable
                onPress={onClearError}
                accessibilityRole="button"
                accessibilityLabel="Dismiss error"
                style={styles.errorBanner}>
                <AppText bold style={styles.errorBannerText}>
                  {error}
                </AppText>
              </Pressable>
            )}

            <View style={styles.footer}>
              <TacticalButton
                title="Save"
                onPress={handleSave}
                disabled={activityId === 0}
                fullWidth
              />
              {!!initial && (
                <TacticalButton
                  title="Delete"
                  variant="dark"
                  icon="delete-outline"
                  onPress={() => onDelete(initial.id)}
                  fullWidth
                />
              )}
              <TacticalButton
                title="Cancel"
                variant="outline"
                onPress={onClose}
                fullWidth
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderColor: colors.rule,
    maxHeight: '90%',
  },
  body: {padding: 16, gap: 8},
  title: {fontSize: 13, letterSpacing: 2, color: colors.ink, marginBottom: 4},
  fieldLabel: {
    fontSize: 10,
    color: colors.faint,
    letterSpacing: 1.4,
    marginTop: 8,
  },
  pillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  pill: {
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  pillText: {fontSize: 12, letterSpacing: 1.4},
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  dateStep: {padding: 12},
  dateStepDisabled: {opacity: 0.3},
  dateLabel: {
    fontSize: 14,
    letterSpacing: 1.4,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.paper,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipSelected: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipText: {fontSize: 12, color: colors.muted, letterSpacing: 1},
  chipTextSelected: {color: '#FFFFFF'},
  numField: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.paper,
    color: colors.ink,
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  textField: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.paper,
    color: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  ratingChip: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.paper,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ratingChipSelected: {borderColor: colors.primary, borderWidth: 1.5},
  ratingEmoji: {fontSize: 22, lineHeight: 28},
  ratingEmojiDimmed: {opacity: 0.35},
  noteRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  noteInput: {flex: 1},
  noteRemove: {
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.paper,
    padding: 9,
  },
  noteAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  noteAddText: {fontSize: 11, color: colors.primary, letterSpacing: 1.4},
  errorBanner: {
    backgroundColor: colors.warnBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warn,
    padding: 10,
    marginTop: 16,
  },
  errorBannerText: {fontSize: 12, color: colors.warn, letterSpacing: 0.4},
  footer: {gap: 8, marginTop: 16},
});

export default ActivitySessionModal;
