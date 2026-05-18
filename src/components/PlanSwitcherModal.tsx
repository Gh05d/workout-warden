// src/components/PlanSwitcherModal.tsx
import React from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import {colors} from '../common/theme';
import {planColor} from '../common/planColor';
import type {Plan} from '../common/types';

interface Props {
  visible: boolean;
  plans: Plan[];
  activePlanId: number;
  onSelect: (planId: number) => void;
  onClose: () => void;
}

const PlanSwitcherModal: React.FC<Props> = ({
  visible,
  plans,
  activePlanId,
  onSelect,
  onClose,
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={onClose}>
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText bold style={styles.title}>
          Switch Plan
        </AppText>
        <Pressable onPress={onClose} hitSlop={12}>
          <MaterialIcons name="close" size={24} color="#666" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {plans.map(p => {
          const isActive = p.id === activePlanId;
          const c = planColor(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                if (!isActive) onSelect(p.id);
                else onClose();
              }}
              style={[styles.row, isActive && styles.rowActive]}>
              <View style={[styles.rail, {backgroundColor: c.fg}]} />
              <View style={styles.rowBody}>
                <View style={[styles.pill, {backgroundColor: c.bg}]}>
                  <AppText style={[styles.pillText, {color: c.fg}]} bold>
                    {p.name.toUpperCase()}
                  </AppText>
                </View>
                {!!p.description && (
                  <AppText style={styles.rowDescription}>
                    {p.description}
                  </AppText>
                )}
              </View>
              {isActive && (
                <MaterialIcons
                  name="check-circle"
                  size={24}
                  color={colors.primary}
                />
              )}
            </Pressable>
          );
        })}

        {plans.length === 1 && (
          <AppText italic style={styles.hint}>
            Only one plan installed. Edit src/seeds/plans/ to add more.
          </AppText>
        )}
      </ScrollView>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  title: {fontSize: 18},
  list: {padding: 16, gap: 8},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  rowActive: {
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  rail: {width: 4, alignSelf: 'stretch'},
  rowBody: {flex: 1, padding: 14, gap: 6},
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillText: {fontSize: 11, letterSpacing: 1.4},
  rowDescription: {fontSize: 13, color: '#666'},
  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default PlanSwitcherModal;
