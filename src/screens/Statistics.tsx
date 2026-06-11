// src/screens/Statistics.tsx
import React from 'react';
import {StyleSheet, View, useWindowDimensions} from 'react-native';
import {CartesianChart, Bar, Line} from 'victory-native';
import roboto from '../../assets/Roboto-Medium.ttf';
import {LinearGradient, useFont, vec} from '@shopify/react-native-skia';

import ErrorComp from '../components/Error';
import Toast from '../components/Toast';
import Loading from '../components/Loading';
import AppPicker from '../components/AppPicker';
import AppText from '../components/AppText';

import {colors} from '../common/theme';
import {
  fetchAllExerciseSlugs,
  fetchExerciseStats,
  getDBConnection,
  type StatsPoint,
} from '../common/databaseService';
import type {BaseProps} from '../common/types';

interface ChartPoint {
  /** Unix timestamp in ms — used as the x-axis position so points are
   * spaced by actual elapsed time, not by sample index. */
  ts: number;
  /** Max weight (kg) or, for bodyweight exercises, max reps per day. */
  value: number;
}

type Metric = 'weight' | 'reps';

/** Format a timestamp for the x-axis. Switches between "DD.MM" (short
 * ranges, < 4 months) and "MM/YY" (long ranges) based on the data span. */
function makeFormatXLabel(spanMs: number) {
  const FOUR_MONTHS_MS = 4 * 30 * 24 * 3600 * 1000;
  const long = spanMs > FOUR_MONTHS_MS;
  return (ms: number) => {
    const d = new Date(ms);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(2);
    return long ? `${mm}/${yy}` : `${dd}.${mm}`;
  };
}

const Statistics: React.FC<BaseProps> = () => {
  const [exercises, setExercises] = React.useState<
    {slug: string; name: string}[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [success, setSuccess] = React.useState('');
  const [data, setData] = React.useState<ChartPoint[]>([]);
  const [metric, setMetric] = React.useState<Metric>('weight');
  const [selected, setSelected] = React.useState<string | null>(null);

  const font = useFont(roboto, 12);
  const {height} = useWindowDimensions();

  React.useEffect(() => {
    (async () => {
      try {
        const db = await getDBConnection();
        setExercises(await fetchAllExerciseSlugs(db));
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSelect(name: string) {
    const found = exercises.find(e => e.name === name);
    if (!found) return;
    setSelected(name);
    const db = await getDBConnection();
    const stats: StatsPoint[] = await fetchExerciseStats(db, found.slug);
    // Victory-native cannot compute a y-domain from null values, so each
    // series only keeps non-null points. Weighted exercises chart max
    // weight; bodyweight exercises (reps but no weight → max_weight is
    // null) fall back to the max-reps series instead of rendering as
    // "no data". If both are empty we render an empty state below.
    const weightPoints: ChartPoint[] = [];
    const repsPoints: ChartPoint[] = [];
    for (const p of stats) {
      const ts = Date.parse(p.date);
      if (!Number.isFinite(ts)) continue;
      if (p.max_weight != null) weightPoints.push({ts, value: p.max_weight});
      if (p.max_reps != null) repsPoints.push({ts, value: p.max_reps});
    }
    if (weightPoints.length > 0) {
      setMetric('weight');
      setData(weightPoints);
    } else {
      setMetric('reps');
      setData(repsPoints);
    }
  }

  if (loading) return <Loading text="Loading Statistics" />;
  if (error) return <ErrorComp error={error}>{error.message}</ErrorComp>;

  const tsMin = data.length ? data[0].ts : 0;
  const tsMax = data.length ? data[data.length - 1].ts : 0;
  const formatXLabel = makeFormatXLabel(tsMax - tsMin);

  return (
    <View style={styles.root}>
      <AppPicker onSelect={onSelect} items={exercises.map(e => e.name)} />

      {selected != null && data.length === 0 && (
        <View style={styles.empty}>
          <AppText style={styles.emptyText}>
            No data recorded for this exercise yet.
          </AppText>
        </View>
      )}

      {data.length > 0 && (
        <View style={{height: height * 0.65}}>
          <CartesianChart
            domainPadding={{left: 30, top: 10, right: 30}}
            axisOptions={{
              font,
              formatXLabel,
              formatYLabel: v => v + (metric === 'weight' ? ' kg' : ' reps'),
            }}
            domain={{y: [0]}}
            data={data}
            xKey="ts"
            yKeys={['value']}>
            {({points, chartBounds}) => (
              <>
                <Bar
                  chartBounds={chartBounds}
                  points={points.value}
                  roundedCorners={{topLeft: 5, topRight: 5}}>
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(0, 600)}
                    colors={[colors.primary, '#a78bfa']}
                  />
                </Bar>
                <Line
                  points={points.value}
                  color="#1f2937"
                  strokeWidth={2}
                  curveType="monotoneX"
                />
              </>
            )}
          </CartesianChart>
        </View>
      )}
      {!!success && <Toast message={success} onClose={() => setSuccess('')} />}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
    padding: 16,
    justifyContent: 'space-between',
    gap: 16,
  },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 1.4,
    textAlign: 'center',
  },
});

export default Statistics;
