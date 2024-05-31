import React from 'react';
import {
  Button,
  Image,
  PermissionsAndroid,
  StyleSheet,
  View,
} from 'react-native';
import {colors, demotivationalQuotes} from '../common/variables';
import AppText from '../components/AppText';
import {exportDataToJSON, importDataFromJSON} from '../common/databaseService';

const Home: React.FC<BaseProps> = ({route}) => {
  const {puppy} = route?.params as {puppy: string};

  const [submitting, setSubmitting] = React.useState(false);

  const quote =
    demotivationalQuotes[
      Math.floor(Math.random() * demotivationalQuotes.length - 1)
    ];

  async function requestStoragePermission() {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs access to your storage to read the exported data',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('You can use the storage');
        return true;
      } else {
        console.log('Storage permission denied');
        return false;
      }
    } catch (err) {
      console.warn(err);
    }
  }

  requestStoragePermission();

  return (
    <View style={styles.root}>
      {!!puppy && (
        <Image source={{uri: puppy}} style={{width: '100%', height: 300}} />
      )}
      <AppText style={{fontSize: 16}} italic>
        {quote}
      </AppText>

      <Button
        color={colors.primary}
        title="Export data"
        onPress={async () => {
          try {
            await setSubmitting(true);
            await exportDataToJSON();
          } catch (_e) {
          } finally {
            setSubmitting(false);
          }
        }}
        disabled={submitting}
      />

      <Button
        color={colors.primary}
        title="Import data"
        onPress={async () => {
          try {
            const granted = await requestStoragePermission();
            if (!granted) return;

            await setSubmitting(true);
            await importDataFromJSON();
          } catch (_e) {
          } finally {
            setSubmitting(false);
          }
        }}
        disabled={submitting}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff', padding: 16, gap: 32},
});

export default Home;
