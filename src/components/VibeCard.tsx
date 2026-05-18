// src/components/VibeCard.tsx
import React from 'react';
import {Image, StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {DEMOTIVATIONAL_QUOTES} from '../common/quotes';

interface Props {
  puppy: string;
}

const VibeCard: React.FC<Props> = ({puppy}) => {
  // Random quote picked once per mount — stable while the screen is up
  const quote = React.useMemo(
    () =>
      DEMOTIVATIONAL_QUOTES[
        Math.floor(Math.random() * DEMOTIVATIONAL_QUOTES.length)
      ],
    [],
  );

  return (
    <View style={styles.card}>
      {!!puppy && <Image source={{uri: puppy}} style={styles.image} />}
      <AppText italic style={styles.quote}>
        {quote}
      </AppText>
    </View>
  );
};

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
    gap: 12,
  },
  image: {width: '100%', height: 200, borderRadius: 8},
  quote: {fontSize: 14, color: '#444', textAlign: 'center'},
});

export default VibeCard;
