/**
 * @format
 */

import {AppRegistry, UIManager, Platform} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

AppRegistry.registerComponent(appName, () => App);
