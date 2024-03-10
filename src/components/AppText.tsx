import React from 'react';
import {Platform, StyleProp, Text, TextProps, TextStyle} from 'react-native';

interface Props extends TextProps {
  style?: StyleProp<TextStyle>;
  bold?: boolean;
  italic?: boolean;
  /** All the props a Text component normally accepts */
  textProps?: StyleProp<TextStyle>;
  children: React.ReactNode;
  testID?: string;
}

/**
 * @description Basic Text component whose font can be chosen
 * @component
 */
const AppText: React.FC<Props> = ({
  children,
  style,
  bold,
  italic,
  testID,
  ...textProps
}) => {
  const fontSize = (Platform as any).isPad
    ? 20
    : style && typeof style === 'object' && 'fontSize' in style
    ? style.fontSize
    : Platform.OS == 'ios'
    ? 16
    : 14;

  const lineHeight = fontSize * 1.25;

  const textStyles: StyleProp<TextStyle> = {
    fontSize,
    lineHeight,
    color: '#333',
    fontWeight: bold ? 'bold' : 'normal',
    fontStyle: italic ? 'italic' : 'normal',
    fontFamily: 'Roboto-Medium',
  };

  return (
    <Text testID={testID} selectable {...textProps} style={[textStyles, style]}>
      {children}
    </Text>
  );
};

export default AppText;
