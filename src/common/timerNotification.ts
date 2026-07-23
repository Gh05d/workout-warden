// src/common/timerNotification.ts
//
// All notifee access for the workout timer lives here; the controller
// (timerController.ts) is the only caller. Every function is a safe
// no-op on iOS and when notifications are unavailable (permission
// denied, notifee broken) — the in-app timer must keep working, so
// every notifee call is wrapped and failures only warn.
//
// One notification id is shared by the foreground-service notification
// and the AlarmManager expiry trigger. Invariant: cancelExpiryTrigger()
// must run BEFORE the next displayNotification with this id — notifee's
// cancel also removes a displayed notification with the same id.

import {Platform} from 'react-native';
import notifee, {
  AndroidForegroundServiceType,
  AndroidImportance,
  AuthorizationStatus,
  EventType,
  TriggerType,
} from '@notifee/react-native';
import type {Event} from '@notifee/react-native';

import {formatTime} from './functions';
import {colors} from './theme';

export const TIMER_NOTIFICATION_ID = 'workout-timer';

export const ACTION_PAUSE = 'timer-pause';
export const ACTION_RESUME = 'timer-resume';
export const ACTION_RESTART = 'timer-restart';
export const ACTION_STOP = 'timer-stop';

const CHANNEL_TIMER = 'timer';
const CHANNEL_EXPIRED = 'timer-expired';

export interface TimerEventHandlers {
  pause(): void;
  resume(): void;
  restart(): void;
  stop(): void;
  onExpiryTrigger(): void;
}

let handlers: TimerEventHandlers | null = null;

/** Called once by timerController at module init (injection avoids an
 * import cycle: this module must never import the controller). */
export function wireTimerEvents(h: TimerEventHandlers): void {
  handlers = h;
}

/**
 * Shared dispatcher for notifee foreground AND background events —
 * registered as onForegroundEvent below and as onBackgroundEvent in
 * index.js (background registration must happen outside the component
 * tree, before AppRegistry).
 */
export async function handleNotifeeEvent({type, detail}: Event): Promise<void> {
  if (handlers == null) return;
  if (type === EventType.ACTION_PRESS) {
    switch (detail.pressAction?.id) {
      case ACTION_PAUSE:
        handlers.pause();
        break;
      case ACTION_RESUME:
        handlers.resume();
        break;
      case ACTION_RESTART:
        handlers.restart();
        break;
      case ACTION_STOP:
        handlers.stop();
        break;
    }
    return;
  }
  // The AlarmManager expiry trigger fired (Doze belt-and-braces path).
  // The FGS displays share this id and also emit DELIVERED — they are
  // distinguishable because only they carry asForegroundService: true.
  if (
    type === EventType.DELIVERED &&
    detail.notification?.id === TIMER_NOTIFICATION_ID &&
    detail.notification?.android?.asForegroundService !== true
  ) {
    handlers.onExpiryTrigger();
  }
}

if (Platform.OS === 'android') {
  try {
    notifee.onForegroundEvent(handleNotifeeEvent);
  } catch (err) {
    console.warn('Registering timer notification events failed', err);
  }
}

let permissionAsked = false;
let channelsCreated = false;

async function ensureChannels(): Promise<void> {
  if (channelsCreated) return;
  await notifee.createChannel({
    id: CHANNEL_TIMER,
    name: 'Timer',
    importance: AndroidImportance.LOW, // silent, status-bar icon only
    sound: undefined,
  });
  await notifee.createChannel({
    id: CHANNEL_EXPIRED,
    name: 'Timer finished',
    importance: AndroidImportance.HIGH,
    sound: undefined, // alarm audio comes from TimerSound, not the channel
    vibration: false, // repeating vibration comes from startAlarm()
  });
  channelsCreated = true;
}

/** Ask for POST_NOTIFICATIONS once (Android 13+; auto-granted below). */
export async function ensurePermission(): Promise<void> {
  if (Platform.OS !== 'android' || permissionAsked) return;
  permissionAsked = true;
  try {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      console.warn(
        'Timer notifications denied — timer keeps running without one.',
      );
    }
  } catch (err) {
    console.warn('Timer notification permission request failed', err);
  }
}

const openApp = {id: 'default', launchActivity: 'default'} as const;

/**
 * Live countdown — the countdown itself is the bold title (central,
 * prominent placement) and android.progress fills as time elapses.
 * Per-second refreshes are driven by the native TimerTick module calling
 * this repeatedly (see timerController.ts); there is no chronometer.
 */
export async function showRunning(
  remainingSec: number,
  totalSec: number,
  label?: string,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannels();
    await notifee.displayNotification({
      id: TIMER_NOTIFICATION_ID,
      title: formatTime(remainingSec),
      body: label ?? 'Workout timer',
      android: {
        channelId: CHANNEL_TIMER,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
        ],
        color: colors.primary,
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        progress: {max: totalSec, current: totalSec - remainingSec},
        pressAction: openApp,
        actions: [
          {title: 'Pause', pressAction: {id: ACTION_PAUSE}},
          {title: 'Reset', pressAction: {id: ACTION_RESTART}},
          {title: 'Stop', pressAction: {id: ACTION_STOP}},
        ],
      },
    });
  } catch (err) {
    console.warn('Timer notification (running) failed', err);
  }
}

export async function showPaused(
  remainingSec: number,
  totalSec: number,
  label?: string,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannels();
    await notifee.displayNotification({
      id: TIMER_NOTIFICATION_ID,
      title: formatTime(remainingSec),
      body: `PAUSED${label ? ' · ' + label : ''}`,
      android: {
        channelId: CHANNEL_TIMER,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
        ],
        color: colors.primary,
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        progress: {max: totalSec, current: totalSec - remainingSec},
        pressAction: openApp,
        actions: [
          {title: 'Resume', pressAction: {id: ACTION_RESUME}},
          {title: 'Reset', pressAction: {id: ACTION_RESTART}},
          {title: 'Stop', pressAction: {id: ACTION_STOP}},
        ],
      },
    });
  } catch (err) {
    console.warn('Timer notification (paused) failed', err);
  }
}

export async function showExpired(label?: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannels();
    await notifee.displayNotification({
      id: TIMER_NOTIFICATION_ID,
      title: "TIME'S UP",
      body: label,
      android: {
        channelId: CHANNEL_EXPIRED,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
        ],
        color: colors.primary,
        ongoing: true,
        autoCancel: false,
        pressAction: openApp,
        actions: [{title: 'Stop', pressAction: {id: ACTION_STOP}}],
      },
    });
  } catch (err) {
    console.warn('Timer notification (expired) failed', err);
  }
}

export async function hide(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.stopForegroundService();
    await notifee.cancelNotification(TIMER_NOTIFICATION_ID);
  } catch (err) {
    console.warn('Hiding timer notification failed', err);
  }
}

/** Doze belt-and-braces: AlarmManager fires the expiry even if JS froze. */
export async function scheduleExpiryTrigger(
  endAt: number,
  label?: string,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannels();
    await notifee.createTriggerNotification(
      {
        id: TIMER_NOTIFICATION_ID,
        title: "TIME'S UP",
        body: label,
        android: {
          channelId: CHANNEL_EXPIRED,
          pressAction: openApp,
          actions: [{title: 'Stop', pressAction: {id: ACTION_STOP}}],
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: endAt,
        alarmManager: {allowWhileIdle: true},
      },
    );
  } catch (err) {
    console.warn('Scheduling timer expiry trigger failed', err);
  }
}

export async function cancelExpiryTrigger(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.cancelTriggerNotification(TIMER_NOTIFICATION_ID);
  } catch (err) {
    console.warn('Cancelling timer expiry trigger failed', err);
  }
}
