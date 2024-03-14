import React, {useState, useEffect} from 'react';
import {
  View,
  Button,
  Vibration,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import KeepAwake from 'react-native-keep-awake';

import AppText from './AppText';
import AppInput from './AppInput';
import {colors} from '../common/variables';
import {row} from '../common/styles';

interface Props {
  duration: number;
  close: () => void;
}

const ONE_SECOND_IN_MS = 1000;

const PATTERN = [
  1 * ONE_SECOND_IN_MS,
  2 * ONE_SECOND_IN_MS,
  3 * ONE_SECOND_IN_MS,
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CountdownTimer: React.FC<Props> = ({duration, close}) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isActive, setIsActive] = useState(false);
  const [edit, setEdit] = useState(false);
  const [minutes, setMinutes] = React.useState(Math.floor(timeLeft / 60));
  const [seconds, setSeconds] = React.useState(Math.floor(timeLeft % 60));
  const [isBlinking, setIsBlinking] = useState(false);

  const blinkAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    KeepAwake.activate();

    () => {
      KeepAwake.deactivate();
    };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isActive && !edit) {
      interval = setInterval(() => {
        setSeconds(prevSeconds => {
          if (prevSeconds === 0) {
            if (minutes === 0) {
              clearInterval(interval);
              setIsBlinking(true);
              Vibration.vibrate(PATTERN, true);
              return 0;
            } else {
              setMinutes(prevMinutes => prevMinutes - 1);
              return 59;
            }
          } else {
            return prevSeconds - 1;
          }
        });
      }, 1000);
    }

    return () => {
      clearInterval(interval);
      Vibration.cancel();
    };
  }, [isActive, minutes, seconds, edit]);

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
    setIsActive(!isActive);
    Vibration.cancel();
  };

  function resetTimer() {
    setIsActive(false);
    setMinutes(Math.floor(timeLeft / 60));
    setSeconds(Math.floor(timeLeft % 60));
    Vibration.cancel();
    setIsBlinking(false);
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
              setValue={value => setMinutes(+value)}
              value={minutes.toString()}
              keyboardType="numeric"
            />
            <AppText>:</AppText>
            <AppInput
              setValue={value => setSeconds(+value)}
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
          onPress={() => setEdit(state => !state)}
        />

        <Button color={colors.primary} title="Reset" onPress={resetTimer} />
      </View>

      {timeLeft === 0 && (
        <View style={{width: '100%'}}>
          <Button
            color={colors.primary}
            title="Reset"
            onPress={() => setTimeLeft(duration)}
          />
        </View>
      )}
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
