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
} from 'react-native';
import CheckBox, {CheckBoxProps} from '@react-native-community/checkbox';

import AppText from './AppText';

interface Props extends CheckBoxProps {
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
    ...checkBoxProps
  } = props;

  return (
    <View style={[containerStyle, styles.checkboxContainer]}>
      <CheckBox
        accessibilityLabel={accessibilityLabel || text}
        tintColors={{true: color, false: color}}
        onCheckColor={color}
        onTintColor={color}
        boxType="square"
        {...checkBoxProps}
      />

      <Pressable
        style={[pressableStyle]}
        disabled={props.disabled}
        android_ripple={android_ripple}
        onPress={() =>
          props.onValueChange((state: boolean) => (state = !state))
        }>
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
    fontSize: Platform.OS == 'ios' ? 15 : 13,
    marginLeft: Platform.OS == 'ios' ? 16 : 0,
  },
});

export default AppCheckBox;
