import React, {Dispatch, SetStateAction} from 'react';
import {
  View,
  Pressable,
  StyleProp,
  TextStyle,
  ViewStyle,
  StyleSheet,
  Platform,
  PressableAndroidRippleConfig,
  Switch,
} from 'react-native';

import AppText from './AppText';

interface Props {
  disabled?: boolean;
  value: boolean;
  onValueChange: Dispatch<SetStateAction<boolean>>;
  color: string;
  text?: string;
  containerStyle?: StyleProp<TextStyle>;
  pressableStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  android_ripple?: PressableAndroidRippleConfig;
  testID?: string;
  accessibilityLabel?: string;
}

const AppCheckBox: React.FC<Props> = props => {
  const {
    text,
    color,
    containerStyle,
    pressableStyle,
    textStyle,
    android_ripple,
    accessibilityLabel,
    value,
    onValueChange,
    disabled,
  } = props;

  return (
    <View style={[containerStyle, styles.checkboxContainer]}>
      <Switch
        accessibilityLabel={accessibilityLabel || text}
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? color : '#f4f3f4'}
        trackColor={{false: '#767577', true: color}}
        disabled={disabled}
      />

      <Pressable
        style={[pressableStyle]}
        disabled={disabled}
        android_ripple={android_ripple}
        onPress={() => onValueChange(!value)}>
        {text && (
          <AppText style={[textStyle, styles.checkboxText]}>{text}</AppText>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  checkboxText: {
    fontSize: Platform.OS === 'ios' ? 15 : 13,
    marginLeft: Platform.OS === 'ios' ? 16 : 0,
  },
});

export default AppCheckBox;
