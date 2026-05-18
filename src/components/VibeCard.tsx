// src/components/VibeCard.tsx
import React from 'react';
import {ImageBackground, StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {DEMOTIVATIONAL_QUOTES} from '../common/quotes';

interface Props {
  puppy: string;
}

const VibeCard: React.FC<Props> = ({puppy}) => {
  const quote = React.useMemo(
    () =>
      DEMOTIVATIONAL_QUOTES[
        Math.floor(Math.random() * DEMOTIVATIONAL_QUOTES.length)
      ],
    [],
  );

  if (!puppy) {
    return (
      <View style={[styles.card, styles.cardFallback]}>
        <AppText italic style={styles.quoteOnFlat}>
          {quote}
        </AppText>
      </View>
    );
  }

  return (
    <ImageBackground
      source={{uri: puppy}}
      style={styles.card}
      imageStyle={styles.image}
      resizeMode="cover">
      <View style={styles.scrim} />
      <View style={styles.content}>
        <AppText style={styles.label} bold>
          TODAY&apos;S VIBE
        </AppText>
        <AppText italic style={styles.quote}>
          {`“${quote}”`}
        </AppText>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  card: {
    height: 220,
    overflow: 'hidden',
    backgroundColor: '#111',
    justifyContent: 'flex-end',
  },
  cardFallback: {padding: 16, height: undefined, justifyContent: 'center'},
  image: {resizeMode: 'cover'},
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  content: {
    padding: 14,
    gap: 6,
  },
  label: {
    color: '#FFB060',
    fontSize: 10,
    letterSpacing: 2,
  },
  quote: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  quoteOnFlat: {fontSize: 14, color: '#444', textAlign: 'center'},
});

export default VibeCard;
