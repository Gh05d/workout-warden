// src/components/InlineTimer.tsx
//
// In-card countdown view over the global timerController. State machine
// (owned by the controller, not this component):
//   idle    → ▶ START (+ EDIT, EXPAND)
//   running → ⏸ PAUSE (+ EXPAND)
//   paused  → ↻ RESET ▶ RESUME (+ EXPAND)
//   expired → ↻ RESET (digits blink; alarm rings until RESET/STOP)
//
// Only the card that started the timer (ownerKey) renders live state —
// other cards keep showing their own idle prescription. Edit mode is
// local: it changes the duration the NEXT start uses, nothing global.

import React from 'react';
import {Animated, Pressable, StyleSheet, TextInput, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import {useKeepAwake} from '@sayem314/react-native-keep-awake';

import AppText from './AppText';
import * as timerController from '../common/timerController';
import {useTimer} from '../hooks/useTimer';
import {colors} from '../common/theme';

interface Props {
  duration: number;
  ownerKey: string;
  label?: string;
  onExpand?: () => void;
}

function format(t: number): {mm: string; ss: string} {
  const safe = Math.max(0, Math.floor(t));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return {mm: String(m).padStart(2, '0'), ss: String(s).padStart(2, '0')};
}

const InlineTimer: React.FC<Props> = ({
  duration,
  ownerKey,
  label,
  onExpand,
}) => {
  // duration the next START uses — the prescription until edited
  const [target, setTarget] = React.useState(duration);
  const timer = useTimer(ownerKey);
  const {status} = timer;
  const timeLeft = timer.remaining ?? target;
  const effectiveTarget = timer.target ?? target;

  const [editing, setEditing] = React.useState(false);
  const [editMin, setEditMin] = React.useState('0');
  const [editSec, setEditSec] = React.useState('0');

  const blink = React.useRef(new Animated.Value(1)).current;
  useKeepAwake();

  // -- blink while expired --
  React.useEffect(() => {
    if (status !== 'expired') {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 0.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, blink]);

  // re-sync if the prescription itself changes (e.g. re-mount with a new set)
  React.useEffect(() => {
    setTarget(duration);
  }, [duration]);

  // -- actions --
  function startOrResume() {
    if (status === 'paused') {
      timerController.resume();
      return;
    }
    if (target === 0) return;
    timerController.start(target, ownerKey, label);
  }
  function pause() {
    timerController.pause();
  }
  function reset() {
    timerController.reset();
  }
  function enterEdit() {
    if (status !== 'idle') return;
    const {mm, ss} = format(target);
    setEditMin(String(parseInt(mm, 10)));
    setEditSec(String(parseInt(ss, 10)));
    setEditing(true);
  }
  function saveEdit() {
    const m = Math.max(0, parseInt(editMin, 10) || 0);
    const s = Math.max(0, Math.min(59, parseInt(editSec, 10) || 0));
    setTarget(m * 60 + s);
    setEditing(false);
  }
  function cancelEdit() {
    setEditing(false);
  }

  const {mm, ss} = format(timeLeft);
  const progress = effectiveTarget === 0 ? 0 : 1 - timeLeft / effectiveTarget;
  const showProgress = status === 'running' || status === 'paused';

  if (editing) {
    return (
      <View style={styles.card}>
        <View style={styles.editRow}>
          <View style={styles.editFieldGroup}>
            <TextInput
              style={styles.editInput}
              keyboardType="numeric"
              value={editMin}
              onChangeText={setEditMin}
              maxLength={2}
              selectTextOnFocus
            />
            <AppText style={styles.editUnit}>MIN</AppText>
          </View>
          <AppText style={styles.editColon}>:</AppText>
          <View style={styles.editFieldGroup}>
            <TextInput
              style={styles.editInput}
              keyboardType="numeric"
              value={editSec}
              onChangeText={setEditSec}
              maxLength={2}
              selectTextOnFocus
            />
            <AppText style={styles.editUnit}>SEC</AppText>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={cancelEdit}
            style={[styles.actionBtn, styles.actionGhost]}
            accessibilityLabel="Cancel edit">
            <MaterialIcons name="close" size={18} color={colors.muted} />
            <AppText bold style={styles.actionGhostText}>
              CANCEL
            </AppText>
          </Pressable>
          <Pressable
            onPress={saveEdit}
            style={[styles.actionBtn, styles.actionPrimary]}
            accessibilityLabel="Save duration">
            <MaterialIcons name="check" size={18} color="#FFFFFF" />
            <AppText bold style={styles.actionPrimaryText}>
              SAVE
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isExpired = status === 'expired';
  const isIdle = status === 'idle';

  return (
    <View style={styles.card}>
      <Pressable onPress={enterEdit} disabled={!isIdle}>
        <Animated.View style={[styles.timeWrap, isExpired && {opacity: blink}]}>
          <AppText
            bold
            style={[styles.digits, isExpired && styles.digitsExpired]}>
            {mm}
          </AppText>
          <AppText bold style={[styles.digits, styles.colon]}>
            :
          </AppText>
          <AppText
            bold
            style={[styles.digits, isExpired && styles.digitsExpired]}>
            {ss}
          </AppText>
        </Animated.View>
      </Pressable>

      {showProgress && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {width: `${progress * 100}%`}]} />
        </View>
      )}

      <View style={styles.actionsRow}>
        {/* Left slot: edit (idle) or reset (paused/expired) */}
        {isIdle && (
          <Pressable
            onPress={enterEdit}
            style={[styles.actionBtn, styles.actionGhost]}
            accessibilityLabel="Edit duration">
            <MaterialIcons name="edit" size={18} color={colors.muted} />
            <AppText bold style={styles.actionGhostText}>
              EDIT
            </AppText>
          </Pressable>
        )}
        {(isPaused || isExpired) && (
          <Pressable
            onPress={reset}
            style={[styles.actionBtn, styles.actionGhost]}
            accessibilityLabel="Reset timer">
            <MaterialIcons name="refresh" size={18} color={colors.muted} />
            <AppText bold style={styles.actionGhostText}>
              RESET
            </AppText>
          </Pressable>
        )}
        {isRunning && (
          <View
            style={[
              styles.actionBtn,
              styles.actionGhost,
              styles.actionInvisible,
            ]}
          />
        )}

        {/* Primary action — start / pause / resume / reset */}
        {(isIdle || isPaused) && (
          <Pressable
            onPress={startOrResume}
            style={[
              styles.actionBtn,
              styles.actionPrimary,
              styles.actionPrimaryFlex,
            ]}
            accessibilityLabel={isPaused ? 'Resume timer' : 'Start timer'}>
            <MaterialIcons name="play-arrow" size={20} color="#FFFFFF" />
            <AppText bold style={styles.actionPrimaryText}>
              {isPaused ? 'RESUME' : 'START'}
            </AppText>
          </Pressable>
        )}
        {isRunning && (
          <Pressable
            onPress={pause}
            style={[
              styles.actionBtn,
              styles.actionPrimary,
              styles.actionPrimaryFlex,
            ]}
            accessibilityLabel="Pause timer">
            <MaterialIcons name="pause" size={20} color="#FFFFFF" />
            <AppText bold style={styles.actionPrimaryText}>
              PAUSE
            </AppText>
          </Pressable>
        )}
        {isExpired && (
          <Pressable
            onPress={reset}
            style={[
              styles.actionBtn,
              styles.actionPrimary,
              styles.actionPrimaryFlex,
            ]}
            accessibilityLabel="Reset timer">
            <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
            <AppText bold style={styles.actionPrimaryText}>
              RESET
            </AppText>
          </Pressable>
        )}

        {!!onExpand && (
          <Pressable
            onPress={onExpand}
            style={[styles.actionBtn, styles.actionIcon]}
            hitSlop={8}
            accessibilityLabel="Open fullscreen timer">
            <MaterialIcons name="fullscreen" size={22} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 14,
  },

  // -- Time display --
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  digits: {
    color: '#FFFFFF',
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
    minWidth: 70,
    textAlign: 'center',
  },
  colon: {minWidth: 18, color: colors.primary},
  digitsExpired: {color: '#FF5252'},

  // -- Progress bar --
  progressTrack: {
    height: 3,
    backgroundColor: '#222222',
    overflow: 'hidden',
  },
  progressFill: {height: '100%', backgroundColor: colors.primary},

  // -- Action row --
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  actionGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  actionGhostText: {
    color: '#CCCCCC',
    fontSize: 11,
    letterSpacing: 1.4,
  },
  actionPrimary: {backgroundColor: colors.primary},
  actionPrimaryFlex: {flex: 1},
  actionPrimaryText: {color: '#FFFFFF', fontSize: 12, letterSpacing: 1.6},
  actionIcon: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3A3A3A',
    paddingHorizontal: 10,
  },
  actionInvisible: {opacity: 0},

  // -- Edit mode --
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  editFieldGroup: {alignItems: 'center', gap: 4},
  editInput: {
    width: 80,
    height: 60,
    backgroundColor: '#FFFFFF',
    color: '#111111',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontVariant: ['tabular-nums'],
  },
  editUnit: {color: '#888888', fontSize: 10, letterSpacing: 1.6},
  editColon: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
});

export default InlineTimer;
