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
import {formatTime} from '../src/common/functions';

const mocked = notifee as jest.Mocked<typeof notifee>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('showRunning', () => {
  it('shows a central countdown title with a filling progress bar and actions', async () => {
    await showRunning(37, 90, 'Dead Hang');
    expect(mocked.displayNotification).toHaveBeenCalledTimes(1);
    const [[arg]] = mocked.displayNotification.mock.calls;
    expect(arg.id).toBe(TIMER_NOTIFICATION_ID);
    expect(arg.title).toBe(formatTime(37));
    expect(arg.body).toBe('Dead Hang');
    expect(arg.android?.asForegroundService).toBe(true);
    expect(arg.android?.progress).toEqual({max: 90, current: 53});
    expect(arg.android?.showChronometer).toBeUndefined();
    expect(arg.android?.chronometerDirection).toBeUndefined();
    expect(arg.android?.timestamp).toBeUndefined();
    const ids = arg.android?.actions?.map(a => a.pressAction.id);
    expect(ids).toEqual(['timer-pause', 'timer-restart', 'timer-stop']);
  });

  it('falls back to a default body when no label is given', async () => {
    await showRunning(10, 10);
    const [[arg]] = mocked.displayNotification.mock.calls;
    expect(arg.body).toBe('Workout timer');
  });

  it('swallows notifee errors', async () => {
    mocked.displayNotification.mockRejectedValueOnce(new Error('boom'));
    await expect(showRunning(1, 1)).resolves.toBeUndefined();
  });
});

describe('showPaused', () => {
  it('shows the central countdown title and a frozen progress bar', async () => {
    await showPaused(83, 120, 'Dead Hang');
    const [[arg]] = mocked.displayNotification.mock.calls;
    expect(arg.title).toBe(formatTime(83));
    expect(arg.body).toBe('PAUSED · Dead Hang');
    expect(arg.android?.progress).toEqual({max: 120, current: 37});
    expect(arg.android?.showChronometer).toBeUndefined();
    const ids = arg.android?.actions?.map(a => a.pressAction.id);
    expect(ids).toEqual(['timer-resume', 'timer-restart', 'timer-stop']);
  });

  it('omits the label separator when no label is given', async () => {
    await showPaused(83, 120);
    const [[arg]] = mocked.displayNotification.mock.calls;
    expect(arg.body).toBe('PAUSED');
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
