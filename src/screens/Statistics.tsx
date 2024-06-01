import React from 'react';
import {StyleSheet, View, useWindowDimensions} from 'react-native';
import {CartesianChart, Bar} from 'victory-native';
import roboto from '../../assets/Roboto-Medium.ttf';
import {LinearGradient, useFont, vec} from '@shopify/react-native-skia';

import Error from '../components/Error';
import Toast from '../components/Toast';
import Loading from '../components/Loading';
import AppPicker from '../components/AppPicker';

import {
  fetchExerciseProgress,
  getAllExercises,
  getDBConnection,
} from '../common/databaseService';
import {colors} from '../common/variables';

const Statistics: React.FC<BaseProps> = () => {
  const [exerciseNames, setExercises] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<null | Error>(null);
  const [success, setSuccess] = React.useState('');
  const [data, setData] = React.useState([]);

  const font = useFont(roboto, 12);
  const {height} = useWindowDimensions();

  React.useEffect(() => {
    init();
  }, []);

  async function onSelect(exercise: string) {
    const db = await getDBConnection();

    const res = await fetchExerciseProgress(db, exercise);

    const test = res.reduce((acc, cV) => {
      // If there's already an entry for this start date,
      // update it only if the current weight is higher
      if (acc[cV.start_date]) {
        acc[cV.start_date] = Math.max(acc[cV.start_date], cV.weight);
      } else {
        acc[cV.start_date] = cV.weight;
      }

      return acc;
    }, {});

    let j = 0;

    // Transforming the data for the chart, adding only the highest weight per day
    const transformedData = Object.keys(test).map(key => ({
      day: ++j,
      weight: test[key],
    }));

    setData(transformedData);
  }

  async function init() {
    try {
      const db = await getDBConnection();
      const exercises = await getAllExercises(db);
      setExercises(exercises.map(({name}) => name));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loading text="Loading Statistics" />;
  if (error) return <Error error={error}>{error?.message}</Error>;

  return (
    <View style={styles.root}>
      <AppPicker onSelect={onSelect} items={exerciseNames} />

      {!!data?.length && (
        <View style={{height: height * 0.65}}>
          <CartesianChart
            domainPadding={{left: 30, top: 10, right: 30}}
            axisOptions={{
              font,
              formatXLabel(value) {
                return 'Workout ' + value;
              },
              formatYLabel(value) {
                return value + ' kg';
              },
            }}
            domain={{y: [0]}}
            data={data}
            xKey="day"
            yKeys={['weight']}>
            {({points, chartBounds}) => (
              <Bar
                chartBounds={chartBounds}
                points={points.weight}
                roundedCorners={{
                  topLeft: 5,
                  topRight: 5,
                }}>
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
  root: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    justifyContent: 'space-between',
    gap: 16,
  },
});

export default Statistics;
