/**
 * @format
 */

import {AppRegistry, UIManager, Platform} from 'react-native';
import notifee from '@notifee/react-native';
import App from './src/App';
import {name as appName} from './app.json';
// Importing the controller wires the notification-event handlers — must
// happen before onBackgroundEvent below so headless action presses
// (pause/reset/stop from the notification) reach the state machine.
import './src/common/timerController';
import {handleNotifeeEvent} from './src/common/timerNotification';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Keeps the countdown notification's foreground service alive. The
  // promise intentionally never resolves — notifee.stopForegroundService()
  // (called via timerNotification.hide()) is what ends the service.
  notifee.registerForegroundService(() => new Promise(() => {}));
  notifee.onBackgroundEvent(handleNotifeeEvent);
}

AppRegistry.registerComponent(appName, () => App);
