// src/components/CountdownTimer.tsx
//
// Fullscreen view over the SAME global timer as the InlineTimer card it
// was expanded from (same ownerKey) — closing the modal does not stop
// the timer. Edit mode is local: it changes the duration the next start
// uses.

import React, {useState, useEffect} from 'react';
import {View, Button, StyleSheet, Pressable, Animated} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import {useKeepAwake} from '@sayem314/react-native-keep-awake';

import AppText from './AppText';
import AppInput from './AppInput';
import * as timerController from '../common/timerController';
import {useTimer} from '../hooks/useTimer';
import {colors} from '../common/theme';
import {row} from '../common/styles';

interface Props {
  duration: number;
  ownerKey: string;
  label?: string;
  close: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CountdownTimer: React.FC<Props> = ({
  duration,
  ownerKey,
  label,
  close,
}) => {
  // duration the next START uses — the prescription until edited
  const [target, setTarget] = useState(duration);
  const [edit, setEdit] = useState(false);
  const timer = useTimer(ownerKey);

  const isActive = timer.status === 'running';
  const isBlinking = timer.status === 'expired';
  const remaining = timer.remaining ?? target;

  const blinkAnim = React.useRef(new Animated.Value(1)).current;

  useKeepAwake();

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  useEffect(() => {
    let isMounted = true;

    const blinkingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    if (isMounted && isBlinking) blinkingAnimation?.start();

    return () => {
      isMounted = false;
      blinkingAnimation.stop();
      blinkAnim.setValue(1);
    };
  }, [isBlinking, blinkAnim]);

  const toggleTimer = () => {
    if (edit) return;
    if (timer.status === 'running') {
      timerController.pause();
      return;
    }
    if (timer.status === 'paused') {
      timerController.resume();
      return;
    }
    if (timer.status === 'expired') {
      timerController.reset();
      return;
    }
    if (target === 0) return;
    timerController.start(target, ownerKey, label);
  };

  function resetTimer() {
    timerController.reset();
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.close} onPress={close}>
        <MaterialIcons name={'cancel'} color={colors.primary} size={30} />
      </Pressable>

      <AnimatedPressable
        onPress={toggleTimer}
        style={[styles.circle, {opacity: blinkAnim}]}>
        {edit ? (
          <View style={styles.edit}>
            <AppInput
              setValue={value =>
                setTarget(
                  Math.max(0, parseInt(value, 10) || 0) * 60 + (target % 60),
                )
              }
              value={Math.floor(target / 60).toString()}
              keyboardType="numeric"
            />
            <AppText>:</AppText>
            <AppInput
              setValue={value =>
                setTarget(
                  Math.floor(target / 60) * 60 +
                    Math.min(59, Math.max(0, parseInt(value, 10) || 0)),
                )
              }
              value={(target % 60).toString()}
              keyboardType="numeric"
            />
          </View>
        ) : (
          <AppText bold style={styles.timeText}>
            {`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`}
          </AppText>
        )}
      </AnimatedPressable>

      <View style={{width: '100%', gap: 16}}>
        <Button
          disabled={edit}
          color={colors.primary}
          title={isActive ? 'Pause' : 'Start'}
          onPress={toggleTimer}
        />

        <Button
          disabled={timer.status !== 'idle'}
          color={colors.primary}
          title={edit ? 'Done' : 'Edit Time'}
          onPress={() => setEdit(state => !state)}
        />

        <Button color={colors.primary} title="Reset" onPress={resetTimer} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 48,
    padding: 16,
    position: 'relative',
  },
  close: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  edit: row,
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: {width: 5, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
  },
  timeText: {
    fontSize: 30,
    color: 'white',
  },
});

export default CountdownTimer;
