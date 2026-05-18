import React from 'react';
import {StyleSheet, Pressable, Animated, Dimensions, View} from 'react-native';

import AppText from './AppText';
import {colors} from '../common/theme';

interface ToastProps {
  message: string;
  type?: 'error';
  onClose?: () => void;
  testId?: string | 'errorMsg';
}

const animationConfig = {toValue: 1, duration: 300, useNativeDriver: true};

const Toast: React.FC<ToastProps> = ({message, type, onClose}) => {
  const [isVisible, setIsVisible] = React.useState(true);

  const fadeAnimation = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isVisible) Animated.timing(fadeAnimation, animationConfig).start();

    const timeout = setTimeout(closeToast, 3000);

    return () => clearTimeout(timeout);
  }, [isVisible]);

  function closeToast() {
    Animated.timing(fadeAnimation, {...animationConfig, toValue: 0}).start(
      () => {
        setIsVisible(false);
        onClose?.();
      },
    );
  }

  const railColor = type === 'error' ? '#E53935' : colors.secondary;

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              {
                translateX: fadeAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [Dimensions.get('window').width * 0.9, 0],
                }),
              },
            ],
            opacity: fadeAnimation,
          },
        ]}>
        <Pressable onPress={closeToast} style={styles.row}>
          <View style={[styles.rail, {backgroundColor: railColor}]} />
          <AppText style={styles.message} bold>
            {message}
          </AppText>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 80,
    right: 10,
    left: 10,
    zIndex: 10,
  },
  container: {
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  row: {flexDirection: 'row', alignItems: 'stretch'},
  rail: {width: 4},
  message: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0.6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexShrink: 1,
  },
});

export default Toast;
