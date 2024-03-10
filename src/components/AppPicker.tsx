import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  StyleProp,
  ViewStyle,
  TextStyle,
  KeyboardAvoidingView,
  Button,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import AppText from './AppText';
import {colors} from '../common/variables';

interface Props {
  startItem?: string;
  items: string[];
  onSelect: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  pickerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  selectedTextBold?: boolean;
  accessibilityLabel?: string;
}

/**
 * @description Basically the equivalent to a Dropdown in the web
 * @component
 */
const AppPicker: React.FC<Props> = props => {
  const {items, selectedTextBold, accessibilityLabel} = props;

  const [show, toggle] = React.useState(false);
  const [selected, select] = React.useState(props.startItem || items[0]);

  const close = () => toggle(false);

  function selectItem(item: string) {
    select(item);
    props.onSelect(item);
    close();
  }

  return (
    <React.Fragment>
      <Pressable
        accessible={true}
        accessibilityLabel={accessibilityLabel}
        onPress={() => toggle(state => !state)}
        style={[styles.componentRoot, props.pickerStyle]}>
        <AppText
          style={props.titleStyle}
          numberOfLines={1}
          bold={selectedTextBold}>
          {selected}
        </AppText>
        <MaterialIcons color={colors.primary} size={20} name="expand-more" />
      </Pressable>

      <Modal animationType="slide" visible={show} onRequestClose={close}>
        <KeyboardAvoidingView style={styles.modal}>
          <ScrollView>
            {items.map(item => (
              <Pressable
                accessible
                accessibilityLabel={item + ' auswählen'}
                key={item}
                onPress={() => selectItem(item)}>
                <AppText style={styles.item}>{item}</AppText>
              </Pressable>
            ))}
          </ScrollView>

          <Button
            accessibilityLabel="Abbrechen"
            title="Abbrechen"
            onPress={close}
          />
        </KeyboardAvoidingView>
      </Modal>
    </React.Fragment>
  );
};

const styles = StyleSheet.create({
  componentRoot: {
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  modal: {margin: 16, flex: 1},
  item: {marginVertical: 8},
});

export default AppPicker;
