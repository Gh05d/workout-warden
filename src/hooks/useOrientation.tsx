import React from 'react';
import { useWindowDimensions } from 'react-native';

type Orientation = 'landscape' | 'portrait';

const useOrientation = (): Orientation => {
  const [orientation, setOrientation] = React.useState<Orientation>('portrait');
  const { width, height } = useWindowDimensions();

  React.useEffect(() => {
    setOrientation(width > height ? 'landscape' : 'portrait');
  }, [width, height]);

  return orientation;
};

export default useOrientation;
