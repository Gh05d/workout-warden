// src/components/PlanSwitcherModal.tsx
import React from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import {colors} from '../common/theme';
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
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                if (!isActive) onSelect(p.id);
                else onClose();
              }}
              style={[styles.row, isActive && styles.rowActive]}>
              <View style={{flex: 1}}>
                <AppText bold style={styles.rowName}>
                  {p.name}
                </AppText>
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
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
  },
  rowActive: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  rowName: {fontSize: 16, color: '#222'},
  rowDescription: {fontSize: 13, color: '#666', marginTop: 2},
  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default PlanSwitcherModal;
