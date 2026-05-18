// src/components/PlanCard.tsx
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import {colors} from '../common/theme';
import {planColor} from '../common/planColor';
import type {Plan} from '../common/types';

interface Props {
  plan: Plan;
  onPress: () => void;
}

const PlanCard: React.FC<Props> = ({plan, onPress}) => {
  const c = planColor(plan.id);
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.rail, {backgroundColor: c.fg}]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={[styles.pill, {backgroundColor: c.bg}]}>
            <AppText style={[styles.pillText, {color: c.fg}]} bold>
              ACTIVE PLAN
            </AppText>
          </View>
          <MaterialIcons name="swap-horiz" size={22} color={colors.primary} />
        </View>
        <AppText bold style={[styles.planName, {color: c.fg}]}>
          {plan.name}
        </AppText>
        {!!plan.description && (
          <AppText style={styles.description} numberOfLines={2}>
            {plan.description}
          </AppText>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  rail: {width: 4},
  body: {flex: 1, padding: 16},
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pill: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10},
  pillText: {fontSize: 10, letterSpacing: 1.4},
  planName: {fontSize: 22, marginBottom: 4},
  description: {fontSize: 13, color: '#666'},
});

export default PlanCard;
