// src/components/TacticalButton.tsx
//
// The one button style for the whole app: square corners, ALL-CAPS body,
// optional leading icon. Variants only differ in background/foreground.
// Reach for this instead of <Button /> from react-native.

import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import {colors} from '../common/theme';

type Variant = 'primary' | 'dark' | 'green' | 'outline';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

const VARIANT_STYLES: Record<Variant, {bg: string; fg: string}> = {
  primary: {bg: colors.primary, fg: '#FFFFFF'},
  dark: {bg: colors.ink, fg: '#FFFFFF'},
  green: {bg: colors.secondary, fg: '#FFFFFF'},
  outline: {bg: 'transparent', fg: colors.primary},
};

const TacticalButton: React.FC<Props> = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  fullWidth,
  accessibilityLabel,
  testID,
}) => {
  const v = VARIANT_STYLES[variant];
  const showLoading = loading;
  const isOutline = variant === 'outline';
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{disabled: !!(disabled || loading)}}
      style={({pressed}) => [
        styles.btn,
        {backgroundColor: v.bg},
        isOutline && styles.outline,
        fullWidth && styles.fullWidth,
        pressed && !disabled && !loading && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}>
      {showLoading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? (
            <MaterialIcons name={icon as any} color={v.fg} size={18} />
          ) : null}
          <AppText bold style={[styles.label, {color: v.fg}]}>
            {title.toUpperCase()}
          </AppText>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  fullWidth: {alignSelf: 'stretch'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  label: {fontSize: 13, letterSpacing: 1.6},
  pressed: {opacity: 0.85},
  disabled: {opacity: 0.45},
});

export default TacticalButton;
