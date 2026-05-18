// src/components/Youtube.tsx
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import YoutubePlayer from 'react-native-youtube-iframe';

import AppText from './AppText';
import {colors} from '../common/theme';

interface Props {
  video: string;
  close: () => void;
  exerciseName?: string;
  prescription?: string;
  hint?: string | null;
  description?: string | null;
}

/** Extract the YouTube video ID from any of the URL forms we store. */
function extractVideoId(input: string): string {
  if (!input) return '';
  const watch = input.match(/[?&]v=([^&]+)/);
  if (watch) return watch[1];
  const shorts = input.match(/shorts\/([^?/]+)/);
  if (shorts) return shorts[1];
  const short = input.match(/youtu\.be\/([^?/]+)/);
  if (short) return short[1];
  return input;
}

const Youtube: React.FC<Props> = ({
  video,
  close,
  exerciseName,
  prescription,
  hint,
  description,
}) => {
  const [playing, setPlaying] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const url = extractVideoId(video);

  const {width} = useWindowDimensions();
  // 16:9 aspect ratio fills the modal width.
  const playerHeight = Math.round((width * 9) / 16);

  const onStateChange = React.useCallback((state: string) => {
    if (state === 'ended') setPlaying(false);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable
          onPress={close}
          hitSlop={12}
          accessibilityLabel="Close video"
          style={styles.topBarBtn}>
          <MaterialIcons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <AppText bold style={styles.topBarTitle} numberOfLines={1}>
          {exerciseName ? exerciseName.toUpperCase() : 'EXERCISE'}
        </AppText>
        <View style={styles.topBarBtn} />
      </View>

      <View style={[styles.videoArea, {height: playerHeight}]}>
        <YoutubePlayer
          height={playerHeight}
          width={width}
          play={playing}
          videoId={url}
          onChangeState={onStateChange}
          onReady={() => setLoading(false)}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.primary} size="large" />
            <AppText bold style={styles.loadingText}>
              LOADING VIDEO
            </AppText>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detail}>
        {!!prescription && (
          <View style={styles.prescriptionRow}>
            <View style={styles.prescriptionRail} />
            <AppText bold style={styles.prescriptionText}>
              {prescription}
            </AppText>
          </View>
        )}

        {!!description && (
          <View style={styles.descriptionBlock}>
            <AppText bold style={styles.descriptionLabel}>
              ABOUT
            </AppText>
            <AppText style={styles.descriptionBody}>{description}</AppText>
          </View>
        )}

        {!!hint && (
          <View style={styles.hintBlock}>
            <AppText bold style={styles.hintLabel}>
              HINT
            </AppText>
            <AppText style={styles.hintBody}>{hint}</AppText>
          </View>
        )}

        {!prescription && !hint && !description && (
          <AppText style={styles.emptyDetail}>
            No additional notes for this exercise. Watch the form cue above and
            mimic the tempo.
          </AppText>
        )}
      </ScrollView>

      <Pressable
        onPress={close}
        style={styles.bottomCloseBtn}
        accessibilityLabel="Close video">
        <AppText bold style={styles.bottomCloseText}>
          CLOSE
        </AppText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.ink},

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A2A',
  },
  topBarBtn: {width: 40, alignItems: 'center'},
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 1.6,
  },

  videoArea: {
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    color: colors.primary,
    fontSize: 11,
    letterSpacing: 2,
  },

  detailScroll: {flex: 1, backgroundColor: colors.cream},
  detail: {padding: 16, gap: 16},

  prescriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prescriptionRail: {
    width: 4,
    height: 24,
    backgroundColor: colors.primary,
  },
  prescriptionText: {
    color: colors.primaryDeep,
    fontSize: 13,
    letterSpacing: 1.6,
  },

  descriptionBlock: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  descriptionLabel: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1.8,
  },
  descriptionBody: {
    color: '#222222',
    fontSize: 14,
    lineHeight: 21,
  },

  hintBlock: {
    backgroundColor: colors.paper,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.rule,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  hintLabel: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 1.8,
  },
  hintBody: {
    color: '#333333',
    fontSize: 14,
    lineHeight: 20,
  },

  emptyDetail: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },

  bottomCloseBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCloseText: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 2,
  },
});

export default Youtube;
