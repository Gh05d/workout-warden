// src/screens/Home.tsx
import React from 'react';
import {Button, Image, StyleSheet, View} from 'react-native';
import {pick, types, errorCodes, isErrorWithCode} from '@react-native-documents/picker';

import AppText from '../components/AppText';
import {colors} from '../common/theme';
import {DEMOTIVATIONAL_QUOTES} from '../common/quotes';
import {exportDatabase, importDatabase} from '../common/databaseService';
import type {BaseProps} from '../common/types';

const Home: React.FC<BaseProps> = ({route}) => {
  const {puppy} = route?.params as {puppy: string};
  const [submitting, setSubmitting] = React.useState(false);

  const quote = DEMOTIVATIONAL_QUOTES[Math.floor(Math.random() * DEMOTIVATIONAL_QUOTES.length)];

  async function pickFile(): Promise<string | undefined> {
    try {
      const [res] = await pick({type: [types.allFiles]});
      return res.uri;
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        console.log('User canceled the picker');
        return;
      }
      throw err;
    }
  }

  return (
    <View style={styles.root}>
      {!!puppy && <Image source={{uri: puppy}} style={{width: '100%', height: 300}} />}
      <AppText style={{fontSize: 16}} italic>
        {quote}
      </AppText>

      <Button color={colors.primary} title="Export data" disabled={submitting}
        onPress={async () => {
          setSubmitting(true);
          try {
            await exportDatabase();
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <Button color={colors.primary} title="Import data" disabled={submitting}
        onPress={async () => {
          setSubmitting(true);
          try {
            const data = await pickFile();
            if (data) await importDatabase(data);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff', padding: 16, gap: 32},
});

export default Home;
