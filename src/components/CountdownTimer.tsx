import React, {useState, useEffect} from 'react';
import {View, Button, StyleSheet, Pressable, Animated} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import {useKeepAwake} from '@sayem314/react-native-keep-awake';

import AppText from './AppText';
import AppInput from './AppInput';
import {startAlarm, stopAlarm} from '../common/timerSound';
import {colors} from '../common/theme';
import {row} from '../common/styles';

interface Props {
  duration: number;
  close: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CountdownTimer: React.FC<Props> = ({duration, close}) => {
  // single source of truth for the countdown — minutes/seconds are derived,
  // so the tick interval survives every render instead of being torn down
  // and recreated per second (which made the timer drift slow).
  const [remaining, setRemaining] = useState(duration);
  const [isActive, setIsActive] = useState(false);
  const [edit, setEdit] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);

  const blinkAnim = React.useRef(new Animated.Value(1)).current;

  useKeepAwake();

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  useEffect(() => {
    if (!isActive || edit) return;
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsBlinking(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, edit]);

  // The alarm is driven by the expired/blinking state, not from inside the
  // tick updater (side effects in updaters break under double-invocation).
  // The cleanup stops vibration + sound on every exit path, including
  // unmounting the modal mid-alarm.
  useEffect(() => {
    if (!isBlinking) return;
    startAlarm();
    return () => stopAlarm();
  }, [isBlinking]);

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
    };
  }, [isBlinking, blinkAnim]);

  const toggleTimer = () => {
    setIsBlinking(false);
    if (!isActive && remaining === 0) return;
    setIsActive(!isActive);
  };

  function resetTimer() {
    setIsActive(false);
    setIsBlinking(false);
    setRemaining(duration);
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
                setRemaining(
                  Math.max(0, parseInt(value, 10) || 0) * 60 + seconds,
                )
              }
              value={minutes.toString()}
              keyboardType="numeric"
            />
            <AppText>:</AppText>
            <AppInput
              setValue={value =>
                setRemaining(
                  minutes * 60 +
                    Math.min(59, Math.max(0, parseInt(value, 10) || 0)),
                )
              }
              value={seconds.toString()}
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
          color={colors.primary}
          title={edit ? 'Done' : 'Edit Time'}
          onPress={() => {
            setIsBlinking(false);
            setEdit(state => !state);
          }}
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
