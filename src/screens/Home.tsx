import React from 'react';
import {Button, Image, StyleSheet, View} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';

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

  async function pickFile() {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.json],
      });

      // Read the file content
      const content = await RNFS.readFile(res.uri, 'utf8');
      return content;
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User canceled the picker');
      } else {
        throw err;
      }
    }
  }

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
            await setSubmitting(true);
            const data = await pickFile();
            await importDataFromJSON(JSON.parse(data));
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
