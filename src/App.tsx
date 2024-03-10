import {GestureHandlerRootView} from 'react-native-gesture-handler';

import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import SQLite from 'react-native-sqlite-storage';

import Routes from './Routes';
import SplashScreen from './components/Splash';
import {initDB} from './common/databaseService';
import Toast from './components/Toast';

SQLite.enablePromise(true);

const App: React.FC<{}> = () => {
  const [initiated, setInitiated] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);
  const [puppy, setPuppy] = React.useState('');
  const [error, setError] = React.useState<null | Error>(null);

  React.useEffect(() => {
    (async function init() {
      try {
        const [response] = await Promise.all([
          fetch('https://dog.ceo/api/breeds/image/random'),
          initDB(),
        ]);

        const data = await response.json();

        if (data?.status == 'success') setPuppy(data.message);
      } catch (err) {
        console.log(err);
        setError(err as Error);
      } finally {
        setInitiated(true);
      }
    })();
  }, []);

  if (showSplash) {
    return (
      <SplashScreen
        source={require('../assets/splash.png')}
        removeSplashScreen={() => setShowSplash(false)}
        initiated={initiated}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{flex: 1}}>
        <Routes puppy={puppy} />
        {error && (
          <Toast
            message={error.message}
            type="error"
            onClose={() => setError(null)}
          />
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default App;
