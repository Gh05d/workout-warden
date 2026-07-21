/**
 * timerController unit tests — modern fake timers drive both setInterval
 * AND Date.now (advanceTimersByTime moves the mocked clock), so the
 * wall-clock state machine is tested exactly as it runs on device.
 * Notification layer and alarm are mocked out.
 */
jest.mock('../src/common/timerNotification', () => ({
  ensurePermission: jest.fn(async () => {}),
  showRunning: jest.fn(async () => {}),
  showPaused: jest.fn(async () => {}),
  showExpired: jest.fn(async () => {}),
  hide: jest.fn(async () => {}),
  scheduleExpiryTrigger: jest.fn(async () => {}),
  cancelExpiryTrigger: jest.fn(async () => {}),
  wireTimerEvents: jest.fn(),
}));
jest.mock('../src/common/timerSound', () => ({
  startAlarm: jest.fn(),
  stopAlarm: jest.fn(),
}));

import * as controller from '../src/common/timerController';
import * as notification from '../src/common/timerNotification';
import {startAlarm, stopAlarm} from '../src/common/timerSound';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(1_000_000);
  controller._resetForTests();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('start → running with full remaining and owner', () => {
  controller.start(90, 'se-1', 'Dead Hang');
  expect(controller.getSnapshot()).toMatchObject({
    status: 'running',
    remaining: 90,
    target: 90,
    ownerKey: 'se-1',
  });
});

test('remaining derives from the wall clock, not tick counting', () => {
  controller.start(60, 'se-1');
  // Simulate Android freezing JS: clock jumps 25s while only ONE tick runs.
  jest.setSystemTime(1_000_000 + 25_000);
  jest.advanceTimersByTime(250);
  expect(controller.getSnapshot().remaining).toBe(35);
});

test('pause holds remaining, resume continues from it', () => {
  controller.start(60, 'se-1');
  jest.advanceTimersByTime(10_000);
  controller.pause();
  expect(controller.getSnapshot().status).toBe('paused');
  expect(controller.getSnapshot().remaining).toBe(50);
  jest.advanceTimersByTime(30_000); // paused: nothing moves
  expect(controller.getSnapshot().remaining).toBe(50);
  controller.resume();
  jest.advanceTimersByTime(5_000);
  expect(controller.getSnapshot().remaining).toBe(45);
});

test('expiry → expired, alarm starts, expired notification shown', async () => {
  controller.start(5, 'se-1');
  await jest.advanceTimersByTimeAsync(5_250);
  expect(controller.getSnapshot().status).toBe('expired');
  expect(controller.getSnapshot().remaining).toBe(0);
  expect(startAlarm).toHaveBeenCalledTimes(1);
  expect(notification.cancelExpiryTrigger).toHaveBeenCalled();
  expect(notification.showExpired).toHaveBeenCalled();
});

test('starting a new timer replaces the running one', () => {
  controller.start(60, 'se-1');
  jest.advanceTimersByTime(10_000);
  controller.start(30, 'se-2');
  expect(controller.getSnapshot()).toMatchObject({
    status: 'running',
    target: 30,
    remaining: 30,
    ownerKey: 'se-2',
  });
});

test('reset returns to idle at full duration, keeps owner, stops alarm', async () => {
  controller.start(60, 'se-1');
  await jest.advanceTimersByTimeAsync(60_250); // run into expiry
  controller.reset();
  expect(controller.getSnapshot()).toMatchObject({
    status: 'idle',
    remaining: 60,
    ownerKey: 'se-1',
  });
  expect(stopAlarm).toHaveBeenCalled();
  await Promise.resolve();
  await Promise.resolve();
  expect(notification.hide).toHaveBeenCalled();
});

test('stop clears owner and hides the notification', async () => {
  controller.start(60, 'se-1');
  controller.stop();
  expect(controller.getSnapshot()).toMatchObject({
    status: 'idle',
    ownerKey: null,
  });
  expect(stopAlarm).toHaveBeenCalled();
  await Promise.resolve();
  await Promise.resolve();
  expect(notification.hide).toHaveBeenCalled();
});

test('restart runs the same timer again from full duration', () => {
  controller.start(45, 'se-1');
  jest.advanceTimersByTime(20_000);
  controller.restart();
  expect(controller.getSnapshot()).toMatchObject({
    status: 'running',
    remaining: 45,
    ownerKey: 'se-1',
  });
});

test('snapshot identity is stable between changes (useSyncExternalStore)', () => {
  controller.start(60, 'se-1');
  const a = controller.getSnapshot();
  const b = controller.getSnapshot();
  expect(a).toBe(b);
  jest.advanceTimersByTime(1_000);
  expect(controller.getSnapshot()).not.toBe(a);
});

test('subscribers fire on change and can unsubscribe', () => {
  const listener = jest.fn();
  const unsub = controller.subscribe(listener);
  controller.start(60, 'se-1');
  expect(listener).toHaveBeenCalled();
  listener.mockClear();
  unsub();
  controller.stop();
  expect(listener).not.toHaveBeenCalled();
});

test('stop during an in-flight start chain never schedules a stale trigger', async () => {
  controller.start(60, 'se-1');
  controller.stop(); // lands while start's notification chain is still pending
  // start()'s chain is 4 links deep (ensurePermission -> cancel -> showRunning
  // -> schedule); each link needs ~2 microtask ticks to settle through these
  // async jest.fn mocks, so a handful of `await Promise.resolve()` isn't
  // enough to let it run to completion — flush generously to be sure.
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  expect(notification.scheduleExpiryTrigger).not.toHaveBeenCalled();
  expect(notification.hide).toHaveBeenCalled();
});
