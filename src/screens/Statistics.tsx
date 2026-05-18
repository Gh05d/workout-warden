// src/screens/Statistics.tsx
import React from 'react';
import {StyleSheet, View, useWindowDimensions} from 'react-native';
import {CartesianChart, Bar} from 'victory-native';
import roboto from '../../assets/Roboto-Medium.ttf';
import {LinearGradient, useFont, vec} from '@shopify/react-native-skia';

import ErrorComp from '../components/Error';
import Toast from '../components/Toast';
import Loading from '../components/Loading';
import AppPicker from '../components/AppPicker';

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
  weight: number | null;
}

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
  const [exercises, setExercises] = React.useState<{slug: string; name: string}[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [success, setSuccess] = React.useState('');
  const [data, setData] = React.useState<ChartPoint[]>([]);

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
    const db = await getDBConnection();
    const stats: StatsPoint[] = await fetchExerciseStats(db, found.slug);
    setData(
      stats.map(p => ({ts: Date.parse(p.date), weight: p.max_weight})),
    );
  }

  if (loading) return <Loading text="Loading Statistics" />;
  if (error) return <ErrorComp error={error}>{error.message}</ErrorComp>;

  const tsMin = data.length ? data[0].ts : 0;
  const tsMax = data.length ? data[data.length - 1].ts : 0;
  const formatXLabel = makeFormatXLabel(tsMax - tsMin);

  return (
    <View style={styles.root}>
      <AppPicker onSelect={onSelect} items={exercises.map(e => e.name)} />

      {data.length > 0 && (
        <View style={{height: height * 0.65}}>
          <CartesianChart
            domainPadding={{left: 30, top: 10, right: 30}}
            axisOptions={{
              font,
              formatXLabel,
              formatYLabel: v => v + ' kg',
            }}
            domain={{y: [0]}}
            data={data}
            xKey="ts"
            yKeys={['weight']}>
            {({points, chartBounds}) => (
              <Bar
                chartBounds={chartBounds}
                points={points.weight}
                roundedCorners={{topLeft: 5, topRight: 5}}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(0, 600)}
                  colors={[colors.primary, '#a78bfa']}
                />
              </Bar>
            )}
          </CartesianChart>
        </View>
      )}
      {!!success && <Toast message={success} onClose={() => setSuccess('')} />}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff', padding: 16, justifyContent: 'space-between', gap: 16},
});

export default Statistics;
