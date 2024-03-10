import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import AppText from './AppText';
import {colors} from '../common/variables';

interface Props {
  /** The text to be displayed. Defaults to Loading */
  text?: string;
  /** Component does not cover full page */
  inline?: boolean;
  /** Either "large" or "small", defaults to "large" */
  size?: 'small' | 'large';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * A loading component which displays text next to a spinner
 *
 * @param {Props} props
 * @component
 */
const Loading: React.FC<Props> = ({
  text = 'Lade Seite',
  inline,
  style,
  textStyle,
  testID,
  size = 'large',
  ...rest
}) => {
  return (
    <View
      style={
        inline ? [styles.basic, style] : [styles.basic, styles.fullPage, style]
      }
      testID={testID}>
      <AppText style={[{color: '#bbb'}, textStyle]}>{text}...</AppText>
      <ActivityIndicator color={colors.primary} size={size} {...rest} />
    </View>
  );
};

const styles = StyleSheet.create({
  basic: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullPage: {flex: 1, justifyContent: 'center'},
});

export default Loading;
