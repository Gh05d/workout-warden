import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {demotivationalQuotes} from '../common/variables';
import AppText from '../components/AppText';

const Home: React.FC<BaseProps> = ({route}) => {
  const {puppy} = route?.params as {puppy: string};

  const quote =
    demotivationalQuotes[
      Math.floor(Math.random() * demotivationalQuotes.length - 1)
    ];

  return (
    <View style={styles.root}>
      {!!puppy && (
        <Image source={{uri: puppy}} style={{width: '100%', height: 300}} />
      )}
      <AppText style={{fontSize: 16}} italic>
        {quote}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff', padding: 16, gap: 32},
});

export default Home;
