// src/components/ProfileModal.tsx
//
// Edit sheet for the body profile driving the ~kcal approximation. Same
// controlled bottom-sheet pattern as ActivitySessionModal: the parent owns
// visible/error, the sheet re-seeds its local state each time it opens.

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import AppText from './AppText';
import TacticalButton from './TacticalButton';
import {colors} from '../common/theme';
import type {UserProfile} from '../common/types';

interface Props {
  visible: boolean;
  initial: UserProfile | null;
  error?: string | null;
  onSave: (profile: UserProfile) => void;
  onClose: () => void;
  onClearError: () => void;
}

const SESSION_CHIPS = [45, 60, 75, 90];
const SEXES: {value: 'male' | 'female'; label: string}[] = [
  {value: 'male', label: 'MALE'},
  {value: 'female', label: 'FEMALE'},
];

const ProfileModal: React.FC<Props> = ({
  visible,
  initial,
  error,
  onSave,
  onClose,
  onClearError,
}) => {
  const [weight, setWeight] = React.useState('');
  const [height, setHeight] = React.useState('');
  const [birthYear, setBirthYear] = React.useState('');
  const [sex, setSex] = React.useState<'male' | 'female' | null>(null);
  const [sessionMinutes, setSessionMinutes] = React.useState('60');

  React.useEffect(() => {
    if (!visible) return;
    setWeight(initial ? String(initial.weightKg) : '');
    setHeight(initial ? String(initial.heightCm) : '');
    setBirthYear(initial ? String(initial.birthYear) : '');
    setSex(initial?.sex ?? null);
    setSessionMinutes(String(initial?.sessionMinutes ?? 60));
  }, [visible, initial]);

  const weightKg = parseFloat(weight.replace(',', '.'));
  const heightCm = parseInt(height, 10);
  const birthYearNum = parseInt(birthYear, 10);
  const sessionNum = parseInt(sessionMinutes, 10);
  const currentYear = new Date().getFullYear();

  const valid =
    Number.isFinite(weightKg) &&
    weightKg >= 20 &&
    weightKg <= 300 &&
    Number.isFinite(heightCm) &&
    heightCm >= 100 &&
    heightCm <= 250 &&
    Number.isFinite(birthYearNum) &&
    birthYearNum >= 1920 &&
    birthYearNum <= currentYear &&
    sex != null &&
    Number.isFinite(sessionNum) &&
    sessionNum > 0;

  function handleSave() {
    if (!valid || sex == null) return;
    onSave({
      weightKg,
      heightCm,
      birthYear: birthYearNum,
      sex,
      sessionMinutes: sessionNum,
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
              PROFILE
            </AppText>
            <AppText style={styles.subtitle}>
              Drives the ~kcal approximation (MET × BMR). Saving fills in
              estimates for past entries that have none.
            </AppText>

            <AppText style={styles.fieldLabel}>WEIGHT (KG)</AppText>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.ghost}
              accessibilityLabel="Weight in kilograms"
              style={styles.numField}
            />

            <AppText style={styles.fieldLabel}>HEIGHT (CM)</AppText>
            <TextInput
              value={height}
              onChangeText={setHeight}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={colors.ghost}
              accessibilityLabel="Height in centimeters"
              style={styles.numField}
            />

            <AppText style={styles.fieldLabel}>BIRTH YEAR</AppText>
            <TextInput
              value={birthYear}
              onChangeText={setBirthYear}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={colors.ghost}
              accessibilityLabel="Birth year"
              style={styles.numField}
            />

            <AppText style={styles.fieldLabel}>SEX</AppText>
            <View style={styles.pillRow}>
              {SEXES.map(s => {
                const selected = sex === s.value;
                return (
                  <Pressable
                    key={s.value}
                    onPress={() => setSex(s.value)}
                    accessibilityRole="button"
                    accessibilityState={{selected}}
                    style={[styles.chip, selected && styles.chipSelected]}>
                    <AppText
                      bold
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}>
                      {s.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <AppText style={styles.fieldLabel}>
              WORKOUT DURATION (MIN) — FLAT ESTIMATE PER PLAN SESSION
            </AppText>
            <View style={styles.pillRow}>
              {SESSION_CHIPS.map(m => {
                const selected = sessionMinutes === String(m);
                return (
                  <Pressable
                    key={m}
                    // Unlike ActivitySessionModal's DURATION_CHIPS, no
                    // toggle-off here: sessionMinutes must never be blank
                    // (validation requires it > 0).
                    onPress={() => setSessionMinutes(String(m))}
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
                value={sessionMinutes}
                onChangeText={setSessionMinutes}
                keyboardType="number-pad"
                placeholder="60"
                placeholderTextColor={colors.ghost}
                accessibilityLabel="Workout duration in minutes"
                style={styles.numField}
              />
            </View>

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
                disabled={!valid}
                fullWidth
              />
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
  title: {fontSize: 13, letterSpacing: 2, color: colors.ink},
  subtitle: {fontSize: 12, color: colors.muted, lineHeight: 17},
  fieldLabel: {
    fontSize: 10,
    color: colors.faint,
    letterSpacing: 1.4,
    marginTop: 8,
  },
  pillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
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
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 0,
    height: 40,
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
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

export default ProfileModal;
