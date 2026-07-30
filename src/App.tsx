// src/App.tsx
import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import SQLite from 'react-native-sqlite-storage';

import Routes from './Routes';
import SplashScreen from './components/Splash';
import Toast from './components/Toast';
import {initDB} from './common/databaseService';

SQLite.enablePromise(true);

const App: React.FC = () => {
  const [initiated, setInitiated] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);
  const [error, setError] = React.useState<null | Error>(null);

  React.useEffect(() => {
    // Startup gate: only the database matters. The decorative puppy fetch
    // lives in VibeCard, with the state it renders — it used to sit up here
    // (once even in a Promise.all with initDB, holding the splash screen open
    // on an unreachable network) and travel down via Routes' initialParams,
    // which a mounted screen never re-reads, so late fetches never showed.
    (async function init() {
      try {
        await initDB();
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
        <Routes />
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
