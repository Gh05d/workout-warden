import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';

import AppText from './AppText';

interface Props {
  error?: Error | null;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode | string;
  fullPage?: boolean;
}

/**
 * @description Renders a simple error message when an error object is given
 * @component
 */
const Error: React.FC<Props> = ({error, children, style, fullPage}) => {
  if (!error) return null;
  console.info('🤕🤖 ~ Error: ', error);

  return (
    <View style={styles.container}>
      <AppText style={[styles.error, {padding: fullPage ? 16 : 0}, style]}>
        {children || error.message}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {backgroundColor: '#fff', flex: 1, padding: 16},
  error: {color: 'rgb(190, 26, 39)'},
});

export default Error;
