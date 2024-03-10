import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Platform,
  StyleProp,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from 'react-native';

import AppText from './AppText';

interface Props extends TextInputProps {
  label?: string;
  defaultValue?: string;
  setValue?: (value: string) => void;
  style?: StyleProp<TextStyle>;
  containerStyles?: StyleProp<ViewStyle>;
  inverted?: boolean;
  icon?: string;
}

/**
 * @description Input field with optional label
 * @component
 */
const AppInput: React.FC<Props> = React.forwardRef<TextInput, Props>(
  (
    {
      label,
      inverted,
      value,
      style,
      containerStyles,
      setValue,
      accessibilityLabel,
      ...inputProps
    },
    ref,
  ) => {
    const inputStyle: {height?: number} = {height: 40};

    if (Platform.OS === 'ios' && inputProps.numberOfLines) {
      inputStyle.height = inputProps.numberOfLines * 20;
    }

    return (
      <View style={[styles.container, containerStyles]}>
        {!!label && (
          <AppText style={[inverted && styles.inverted]}>{label}</AppText>
        )}
        <TextInput
          style={[
            styles.input,
            style,
            inverted && styles.invertedInput,
            inputProps.editable === false && styles.disabled,
            inputStyle,
          ]}
          ref={ref}
          value={value}
          onChangeText={setValue}
          placeholderTextColor="#666"
          accessible={true}
          accessibilityLabel={accessibilityLabel || ''}
          {...inputProps}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {flexDirection: 'row', alignItems: 'center', gap: 8},
  input: {
    width: 60,
    borderColor: '#ccc',
    borderWidth: 1,
    color: '#333',
  },
  inverted: {color: 'white'},
  invertedInput: {backgroundColor: 'white'},
  disabled: {backgroundColor: '#eee'},
});

AppInput.displayName = 'AppInput';

export default AppInput;
