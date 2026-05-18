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
  day: number;
  weight: number | null;
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
    setData(stats.map((p, i) => ({day: i + 1, weight: p.max_weight})));
  }

  if (loading) return <Loading text="Loading Statistics" />;
  if (error) return <ErrorComp error={error}>{error.message}</ErrorComp>;

  return (
    <View style={styles.root}>
      <AppPicker onSelect={onSelect} items={exercises.map(e => e.name)} />

      {data.length > 0 && (
        <View style={{height: height * 0.65}}>
          <CartesianChart
            domainPadding={{left: 30, top: 10, right: 30}}
            axisOptions={{
              font,
              formatXLabel: v => 'Workout ' + v,
              formatYLabel: v => v + ' kg',
            }}
            domain={{y: [0]}}
            data={data}
            xKey="day"
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
