import React from 'react';
import {
  StyleSheet,
  Pressable,
  View,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import Reanimated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import {colors} from '../common/theme';
import AppText from './AppText';

interface Props {
  title?: string;
  subtitle?: string;
  iconSize?: number;
  iconColor?: string;
  closed?: boolean;
  icon?: string;
  controlIcon?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  HeaderComponent?: React.ReactNode;
}

const screenPadding = 16;

/**
 * @description An accordion with configurable header and icons
 * @component
 */
const Accordion: React.FC<Props> = props => {
  const {
    title,
    subtitle,
    iconSize = 30,
    controlIcon = `caret-${props.closed ? 'down' : 'up'}`,
    style,
  } = props;
  const [open, toggle] = React.useState(true);
  const animatedController = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    toggleAccordion(!props.closed);
  }, [props.closed]);

  const arrowAngle = animatedController.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const toggleAccordion = (value?: boolean) => {
    Animated.timing(animatedController, {
      useNativeDriver: true,
      duration: 300,
      toValue: open ? 0 : 1,
    }).start();

    if (value) toggle(value);
    else toggle(state => !state);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => toggleAccordion()}
        style={[
          styles.header,
          {
            backgroundColor: '#aaa',
            paddingHorizontal: screenPadding,
            paddingVertical: screenPadding / 2,
          },
          style,
        ]}>
        {props.HeaderComponent || (
          <View style={styles.innerHeader}>
            <AppText bold style={styles.headingText}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText italic style={styles.subtitleText}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        )}

        <Animated.View style={{transform: [{rotateZ: arrowAngle}]}}>
          <MaterialIcons
            color={props.iconColor || colors.primary}
            size={iconSize}
            name={controlIcon}
          />
        </Animated.View>
      </Pressable>

      <Reanimated.View
        layout={LinearTransition.duration(280)}
        style={styles.bodyContainer}>
        {open && (
          <Reanimated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(140)}
            style={styles.textContainer}>
            {props.children}
          </Reanimated.View>
        )}
      </Reanimated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {overflow: 'hidden'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  innerHeader: {flexDirection: 'row', alignItems: 'center', width: '90%'},
  bodyBackground: {overflow: 'hidden'},
  bodyContainer: {
    paddingHorizontal: 16,
    backgroundColor: '#eee',
  },
  headingText: {marginLeft: 8, color: '#fff'},
  subtitleText: {marginLeft: 8, color: '#fff', opacity: 0.7, fontSize: 12},
  empty: {margin: 8},
  textContainer: {marginTop: 8, paddingBottom: 12},
});

export default Accordion;
