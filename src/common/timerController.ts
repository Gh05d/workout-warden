// src/common/timerController.ts
//
// The single global workout timer. There is exactly one active timer;
// starting a new one replaces it. State lives outside React so the timer
// keeps running when cards unmount and while the app is backgrounded
// (the notifee foreground service keeps the JS runtime ticking).
//
// Time is wall-clock based: start() records an absolute end timestamp
// and remaining time is always derived from Date.now(). The tick only
// refreshes subscribers — even if Android freezes JS for minutes, the
// timer is correct the moment anything recomputes.
//
// This module is the only caller of the notification layer
// (timerNotification.ts) and the alarm (timerSound.ts). Components and
// notification buttons both act through this API, which keeps in-app UI
// and notification in sync by construction. Notification calls are
// fire-and-forget: they never gate a state transition.

import {AppState} from 'react-native';

import {startAlarm, stopAlarm} from './timerSound';
import * as timerNotification from './timerNotification';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'expired';

export interface TimerSnapshot {
  status: TimerStatus;
  /** Duration the active timer was started with (seconds). */
  target: number;
  /** Remaining seconds — wall-clock derived while running. */
  remaining: number;
  /** Identity of the card that started the timer; null after stop(). */
  ownerKey: string | null;
}

type Listener = () => void;

const TICK_MS = 250;

let status: TimerStatus = 'idle';
let target = 0;
let ownerKey: string | null = null;
let label: string | undefined;
let endAt: number | null = null; // epoch ms while running
let remainingAtPause = 0;
let tick: ReturnType<typeof setInterval> | null = null;

const listeners = new Set<Listener>();
let snapshot: TimerSnapshot = {
  status: 'idle',
  target: 0,
  remaining: 0,
  ownerKey: null,
};

function currentRemaining(): number {
  if (status === 'running' && endAt != null) {
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  }
  if (status === 'paused') return remainingAtPause;
  if (status === 'expired') return 0;
  return target;
}

function emit(): void {
  const remaining = currentRemaining();
  if (
    snapshot.status === status &&
    snapshot.target === target &&
    snapshot.remaining === remaining &&
    snapshot.ownerKey === ownerKey
  ) {
    return;
  }
  snapshot = {status, target, remaining, ownerKey};
  listeners.forEach(l => l());
}

function stopTick(): void {
  if (tick != null) clearInterval(tick);
  tick = null;
}

function startTick(): void {
  stopTick();
  tick = setInterval(onTick, TICK_MS);
}

function onTick(): void {
  if (status !== 'running') return;
  if (currentRemaining() <= 0) {
    expire();
    return;
  }
  emit();
}

function expire(): void {
  stopTick();
  status = 'expired';
  endAt = null;
  emit();
  startAlarm();
  // Cancel BEFORE showing: trigger and display share one notification id,
  // and cancelling the trigger also removes a displayed notification.
  timerNotification
    .cancelExpiryTrigger()
    .then(() => timerNotification.showExpired(label));
}

// -- public API ------------------------------------------------------------

export function start(
  durationSec: number,
  owner: string,
  ownerLabel?: string,
): void {
  stopAlarm(); // a replaced timer may be mid-alarm
  stopTick();
  status = 'running';
  target = durationSec;
  ownerKey = owner;
  label = ownerLabel;
  endAt = Date.now() + durationSec * 1000;
  remainingAtPause = 0;
  startTick();
  emit();
  const at = endAt;
  timerNotification
    .ensurePermission()
    .then(() => timerNotification.cancelExpiryTrigger())
    .then(() => timerNotification.showRunning(at, label))
    .then(() => timerNotification.scheduleExpiryTrigger(at, label));
}

export function pause(): void {
  if (status !== 'running') return;
  remainingAtPause = currentRemaining();
  status = 'paused';
  endAt = null;
  stopTick();
  emit();
  timerNotification
    .cancelExpiryTrigger()
    .then(() => timerNotification.showPaused(remainingAtPause, label));
}

export function resume(): void {
  if (status !== 'paused') return;
  status = 'running';
  endAt = Date.now() + remainingAtPause * 1000;
  startTick();
  emit();
  const at = endAt;
  timerNotification
    .showRunning(at, label)
    .then(() => timerNotification.scheduleExpiryTrigger(at, label));
}

/** In-app RESET: back to idle at full duration; notification goes away. */
export function reset(): void {
  stopAlarm();
  stopTick();
  status = 'idle';
  endAt = null;
  remainingAtPause = 0;
  emit();
  timerNotification.cancelExpiryTrigger().then(() => timerNotification.hide());
}

/** Notification RESET: restart the same timer from its full duration. */
export function restart(): void {
  if (ownerKey == null || target <= 0) return;
  start(target, ownerKey, label);
}

/** Full dismiss: stop alarm, clear owner, remove notification. */
export function stop(): void {
  stopAlarm();
  stopTick();
  status = 'idle';
  endAt = null;
  remainingAtPause = 0;
  ownerKey = null;
  label = undefined;
  target = 0;
  emit();
  timerNotification.cancelExpiryTrigger().then(() => timerNotification.hide());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): TimerSnapshot {
  return snapshot;
}

/** Doze path: the AlarmManager trigger fired although JS was frozen. */
function onExpiryTrigger(): void {
  if (status === 'running' && currentRemaining() <= 0) {
    expire();
  }
}

// Recompute immediately when the app returns to the foreground — while
// backgrounded without the service the interval may not have run.
AppState.addEventListener('change', state => {
  if (state === 'active' && status === 'running') onTick();
});

timerNotification.wireTimerEvents({
  pause,
  resume,
  restart,
  stop,
  onExpiryTrigger,
});

/** Test-only: restore pristine module state between test cases. */
export function _resetForTests(): void {
  stopTick();
  status = 'idle';
  target = 0;
  ownerKey = null;
  label = undefined;
  endAt = null;
  remainingAtPause = 0;
  listeners.clear();
  snapshot = {status: 'idle', target: 0, remaining: 0, ownerKey: null};
}
