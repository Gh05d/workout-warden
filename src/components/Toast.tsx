import React from 'react';
import {
  StyleSheet,
  Pressable,
  Animated,
  NativeModules,
  Dimensions,
  View,
} from 'react-native';

import AppText from './AppText';
import {colors} from '../common/variables';

interface ToastProps {
  message: string;
  type?: 'error';
  onClose?: () => void;
  testId?: string | 'errorMsg';
}

const {UIManager} = NativeModules;

UIManager.setLayoutAnimationEnabledExperimental &&
  UIManager.setLayoutAnimationEnabledExperimental(true);

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
            backgroundColor: type == 'error' ? 'red' : colors.secondary,
          },
        ]}>
        <Pressable onPress={closeToast}>
          <AppText style={styles.message}>{message}</AppText>
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
    zIndex: 10,
  },
  container: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  message: {color: 'white'},
});

export default Toast;
