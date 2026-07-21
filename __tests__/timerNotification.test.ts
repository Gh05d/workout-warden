/**
 * timerNotification unit tests. The RN Platform is forced to 'android'
 * (the react-native Jest preset defaults to iOS, which would turn every
 * function into a guard-clause no-op). The notifee module itself comes
 * from the automatic manual mock in __mocks__/@notifee/react-native.js.
 */
jest.mock('react-native', () => ({Platform: {OS: 'android'}}));

import notifee, {EventType} from '@notifee/react-native';
import {
  ACTION_PAUSE,
  ACTION_STOP,
  TIMER_NOTIFICATION_ID,
  handleNotifeeEvent,
  showRunning,
  showPaused,
  scheduleExpiryTrigger,
  hide,
  wireTimerEvents,
} from '../src/common/timerNotification';

const mocked = notifee as jest.Mocked<typeof notifee>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('showRunning', () => {
  it('displays a foreground-service chronometer notification with actions', async () => {
    await showRunning(1_700_000_000_000, 'Dead Hang');
    expect(mocked.displayNotification).toHaveBeenCalledTimes(1);
    const [[arg]] = mocked.displayNotification.mock.calls;
    expect(arg.id).toBe(TIMER_NOTIFICATION_ID);
    expect(arg.android?.asForegroundService).toBe(true);
    expect(arg.android?.showChronometer).toBe(true);
    expect(arg.android?.chronometerDirection).toBe('down');
    expect(arg.android?.timestamp).toBe(1_700_000_000_000);
    const ids = arg.android?.actions?.map(a => a.pressAction.id);
    expect(ids).toEqual(['timer-pause', 'timer-restart', 'timer-stop']);
  });

  it('swallows notifee errors', async () => {
    mocked.displayNotification.mockRejectedValueOnce(new Error('boom'));
    await expect(showRunning(1)).resolves.toBeUndefined();
  });
});

describe('showPaused', () => {
  it('shows static remaining time without chronometer', async () => {
    await showPaused(83);
    const [[arg]] = mocked.displayNotification.mock.calls;
    expect(arg.body).toContain('1:23');
    expect(arg.android?.showChronometer).toBeUndefined();
    const ids = arg.android?.actions?.map(a => a.pressAction.id);
    expect(ids).toEqual(['timer-resume', 'timer-restart', 'timer-stop']);
  });
});

describe('scheduleExpiryTrigger', () => {
  it('creates an exact allow-while-idle timestamp trigger', async () => {
    await scheduleExpiryTrigger(1_700_000_000_000);
    const [[notification, trigger]] =
      mocked.createTriggerNotification.mock.calls;
    expect(notification.id).toBe(TIMER_NOTIFICATION_ID);
    expect(trigger).toMatchObject({
      timestamp: 1_700_000_000_000,
      alarmManager: {allowWhileIdle: true},
    });
  });
});

describe('hide', () => {
  it('stops the foreground service and cancels the notification', async () => {
    await hide();
    expect(mocked.stopForegroundService).toHaveBeenCalled();
    expect(mocked.cancelNotification).toHaveBeenCalledWith(
      TIMER_NOTIFICATION_ID,
    );
  });
});

describe('handleNotifeeEvent', () => {
  it('dispatches action presses to the wired handlers', async () => {
    const handlers = {
      pause: jest.fn(),
      resume: jest.fn(),
      restart: jest.fn(),
      stop: jest.fn(),
      onExpiryTrigger: jest.fn(),
    };
    wireTimerEvents(handlers);
    await handleNotifeeEvent({
      type: EventType.ACTION_PRESS,
      detail: {pressAction: {id: ACTION_PAUSE}},
    } as any);
    expect(handlers.pause).toHaveBeenCalledTimes(1);

    await handleNotifeeEvent({
      type: EventType.ACTION_PRESS,
      detail: {pressAction: {id: ACTION_STOP}},
    } as any);
    expect(handlers.stop).toHaveBeenCalledTimes(1);
  });

  it('maps a delivered expiry trigger to onExpiryTrigger', async () => {
    const handlers = {
      pause: jest.fn(),
      resume: jest.fn(),
      restart: jest.fn(),
      stop: jest.fn(),
      onExpiryTrigger: jest.fn(),
    };
    wireTimerEvents(handlers);
    await handleNotifeeEvent({
      type: EventType.DELIVERED,
      detail: {notification: {id: TIMER_NOTIFICATION_ID}},
    } as any);
    expect(handlers.onExpiryTrigger).toHaveBeenCalledTimes(1);
  });

  it('ignores DELIVERED from FGS displays (asForegroundService: true)', async () => {
    const handlers = {
      pause: jest.fn(),
      resume: jest.fn(),
      restart: jest.fn(),
      stop: jest.fn(),
      onExpiryTrigger: jest.fn(),
    };
    wireTimerEvents(handlers);
    await handleNotifeeEvent({
      type: EventType.DELIVERED,
      detail: {
        notification: {
          id: TIMER_NOTIFICATION_ID,
          android: {asForegroundService: true},
        },
      },
    } as any);
    expect(handlers.onExpiryTrigger).not.toHaveBeenCalled();
  });

  it('ignores foreign notifications and unknown actions', async () => {
    const handlers = {
      pause: jest.fn(),
      resume: jest.fn(),
      restart: jest.fn(),
      stop: jest.fn(),
      onExpiryTrigger: jest.fn(),
    };
    wireTimerEvents(handlers);
    await handleNotifeeEvent({
      type: EventType.DELIVERED,
      detail: {notification: {id: 'something-else'}},
    } as any);
    await handleNotifeeEvent({
      type: EventType.ACTION_PRESS,
      detail: {pressAction: {id: 'unrelated'}},
    } as any);
    expect(handlers.onExpiryTrigger).not.toHaveBeenCalled();
    expect(handlers.pause).not.toHaveBeenCalled();
  });
});
