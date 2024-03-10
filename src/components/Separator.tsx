import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface Props {
  style?: StyleProp<ViewStyle>;
  distance?: number;
}
/**
 * @description A simple line which crosses the whole screen to separate content
 *
 * @param {object} [style]
 * @component
 */
const Separator: React.FC<Props> = ({ style, distance = 0 }) => (
  <View style={[styles.border, { marginVertical: distance }, style]} />
);

const styles = StyleSheet.create({
  border: { borderTopWidth: StyleSheet.hairlineWidth },
});

export default Separator;
