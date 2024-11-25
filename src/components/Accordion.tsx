import React from 'react';
import {
  StyleSheet,
  Pressable,
  View,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleProp,
  ViewStyle,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import {colors} from '../common/variables';
import AppText from './AppText';

interface Props {
  title?: string;
  iconSize?: number;
  iconColor?: string;
  closed?: '1' | '0';
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

  const toggleAnimation = {
    duration: 300,
    update: {
      duration: 300,
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      duration: 200,
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
  };

  const toggleAccordion = (value?: boolean) => {
    Animated.timing(animatedController, {
      useNativeDriver: true,
      duration: 300,
      toValue: open ? 0 : 1,
    }).start();

    LayoutAnimation.configureNext(toggleAnimation);

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

      <View style={styles.bodyContainer}>
        {open &&
          (<View style={styles.textContainer}>{props.children}</View> || (
            <AppText style={styles.empty}>Noch keine Einträge</AppText>
          ))}
      </View>
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
  empty: {margin: 8},
  textContainer: {marginTop: 8, paddingBottom: 12},
});

export default Accordion;
