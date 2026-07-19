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

const PUPPY_TIMEOUT_MS = 5000;

const App: React.FC = () => {
  const [initiated, setInitiated] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);
  const [puppy, setPuppy] = React.useState('');
  const [error, setError] = React.useState<null | Error>(null);

  React.useEffect(() => {
    // Startup gate: only the database matters. This used to sit in a Promise.all
    // with the puppy fetch, so an unreachable network held the splash screen
    // open indefinitely — and when the fetch rejected, the app fell through
    // while initDB() was still seeding.
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

  // Purely decorative, so it must never gate startup. Bounded by its own timeout
  // because fetch has none: a half-open socket would otherwise hang for minutes.
  React.useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PUPPY_TIMEOUT_MS);

    fetch('https://dog.ceo/api/breeds/image/random', {
      signal: controller.signal,
    })
      .then(response => response.json())
      .then(data => {
        if (data?.status === 'success') setPuppy(data.message);
      })
      .catch(() => {
        /* offline, slow or aborted — the app simply runs without a puppy */
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
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
