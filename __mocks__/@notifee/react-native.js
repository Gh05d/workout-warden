// Manual Jest mock for @notifee/react-native. Lives at the project root so
// Jest applies it automatically to every test that imports notifee.
const notifee = {
  requestPermission: jest.fn(async () => ({authorizationStatus: 1})),
  createChannel: jest.fn(async () => 'channel-id'),
  displayNotification: jest.fn(async () => 'notification-id'),
  createTriggerNotification: jest.fn(async () => 'notification-id'),
  cancelTriggerNotification: jest.fn(async () => {}),
  cancelNotification: jest.fn(async () => {}),
  stopForegroundService: jest.fn(async () => {}),
  registerForegroundService: jest.fn(),
  onForegroundEvent: jest.fn(() => () => {}),
  onBackgroundEvent: jest.fn(),
};

module.exports = {
  __esModule: true,
  default: notifee,
  AndroidImportance: {NONE: 0, MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4},
  AuthorizationStatus: {NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1},
  EventType: {
    UNKNOWN: -1,
    DISMISSED: 0,
    PRESS: 1,
    ACTION_PRESS: 2,
    DELIVERED: 3,
  },
  TriggerType: {TIMESTAMP: 0, INTERVAL: 1},
  AndroidForegroundServiceType: {
    FOREGROUND_SERVICE_TYPE_SPECIAL_USE: 1073741824,
  },
};
