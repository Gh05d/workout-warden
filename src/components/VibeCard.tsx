// src/components/VibeCard.tsx
import React from 'react';
import {ImageBackground, StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {DEMOTIVATIONAL_QUOTES} from '../common/quotes';

const PUPPY_TIMEOUT_MS = 5000;

const VibeCard: React.FC = () => {
  const [puppy, setPuppy] = React.useState('');

  const quote = React.useMemo(
    () =>
      DEMOTIVATIONAL_QUOTES[
        Math.floor(Math.random() * DEMOTIVATIONAL_QUOTES.length)
      ],
    [],
  );

  // Purely decorative, fetched here — where the result renders — so a late
  // resolution still shows the image. The state used to live in App and travel
  // through Routes' initialParams, which an already-mounted Home never re-reads:
  // any fetch that lost the race against the splash screen never showed at all.
  // Bounded by its own timeout because fetch has none; a failure or abort just
  // keeps the flat card.
  React.useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PUPPY_TIMEOUT_MS);

    fetch('https://dog.ceo/api/breeds/image/random', {
      signal: controller.signal,
    })
      .then(response => response.json())
      .then(data => {
        if (data?.status === 'success') setPuppy(data.message);
      })
      .catch(() => {
        /* offline, slow or aborted — the card simply stays flat */
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!puppy) {
    return (
      <View style={styles.card}>
        <View style={styles.content}>
          <AppText style={styles.label} bold>
            TODAY&apos;S VIBE
          </AppText>
          <AppText italic style={styles.quote}>
            {`“${quote}”`}
          </AppText>
        </View>
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
});

export default VibeCard;
