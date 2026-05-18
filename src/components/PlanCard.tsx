// src/components/PlanCard.tsx
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import {colors} from '../common/theme';
import type {Plan} from '../common/types';

interface Props {
  plan: Plan;
  onPress: () => void;
}

const PlanCard: React.FC<Props> = ({plan, onPress}) => (
  <Pressable onPress={onPress} style={styles.card}>
    <View style={styles.headerRow}>
      <AppText style={styles.label}>Active Plan</AppText>
      <MaterialIcons name="swap-horiz" size={22} color={colors.primary} />
    </View>
    <AppText bold style={styles.planName}>
      {plan.name}
    </AppText>
    {!!plan.description && (
      <AppText style={styles.description} numberOfLines={2}>
        {plan.description}
      </AppText>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planName: {
    fontSize: 22,
    color: colors.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#666',
  },
});

export default PlanCard;
