import React, {useState, useCallback} from 'react';
import {Button, View, useWindowDimensions} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import Loading from './Loading';
import {colors} from '../common/variables';

interface Props {
  video: string;
  close: () => void;
}

const Youtube: React.FC<Props> = ({video, close}) => {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = React.useState(true);
  const [, url] = video.split('watch?v=');

  const {height} = useWindowDimensions();

  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') setPlaying(false);
  }, []);

  return (
    <View>
      <YoutubePlayer
        height={height / 2}
        play={playing}
        videoId={url}
        onChangeState={onStateChange}
        onReady={() => setLoading(false)}
      />

      {loading && <Loading text="Lade Video" />}

      {!loading && (
        <View style={{paddingHorizontal: 16}}>
          <Button color={colors.primary} title="Close" onPress={close} />
        </View>
      )}
    </View>
  );
};

export default Youtube;
