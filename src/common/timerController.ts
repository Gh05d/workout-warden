// src/common/timerController.ts
//
// The single global workout timer. There is exactly one active timer;
// starting a new one replaces it. State lives outside React so the timer
// keeps running when cards unmount and while the app is backgrounded.
// Background correctness does NOT come from the foreground service — RN's
// Timing module pauses setInterval on host-pause regardless of the FGS. It
// comes from wall-clock derivation, the AlarmManager expiry trigger, and
// the AppState recompute on return to foreground; the FGS's job is keeping
// the process alive and the notification ongoing.
//
// Time is wall-clock based: start() records an absolute end timestamp
// and remaining time is always derived from Date.now(). The tick only
// refreshes subscribers — even if Android freezes JS for minutes, the
// timer is correct the moment anything recomputes. On Android, the tick
// itself comes from the native TimerTick module (a Handler-driven ticker
// in the FGS process) rather than JS setInterval, precisely because that
// setInterval pause on host-pause would otherwise freeze the running
// notification's per-second countdown the moment the user backgrounds the
// app; iOS and Jest fall back to setInterval since there's no FGS process
// to keep ticking in the background there anyway.
//
// This module is the only caller of the notification layer
// (timerNotification.ts) and the alarm (timerSound.ts). Components and
// notification buttons both act through this API, which keeps in-app UI
// and notification in sync by construction. Notification calls are
// fire-and-forget: they never gate a state transition.

import {AppState, DeviceEventEmitter, NativeModules} from 'react-native';

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
let tickSubscription: {remove(): void} | null = null;

// Gates per-second notification refreshes from onTick(). Only true once
// the initial showRunning() for the current running span has resolved
// (i.e. the permission flow + channel creation are done and gen is still
// valid) — this stops a tick from calling displayNotification before the
// FGS notification exists, or racing a transition's own chain. Reset to
// false (and lastNotifiedRemaining to null) at the start of every
// transition that leaves or re-enters 'running'.
let notifLive = false;
let lastNotifiedRemaining: number | null = null;

// Each public transition that touches the notification layer bumps this
// and captures its own value as `gen`. Every step of that transition's
// `.then` chain re-checks `gen === opGen` before doing anything: a newer
// transition invalidates the async tail of every older one. State itself
// is already synchronous by the time a transition returns — this only
// serializes the notification/alarm-trigger side effects that trail it.
let opGen = 0;

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
  if (tickSubscription != null) {
    tickSubscription.remove();
    tickSubscription = null;
    NativeModules.TimerTick?.stop();
  }
}

function startTick(): void {
  stopTick();
  if (NativeModules.TimerTick != null) {
    tickSubscription = DeviceEventEmitter.addListener(
      'WorkoutTimerTick',
      onTick,
    );
    NativeModules.TimerTick.start(TICK_MS);
  } else {
    // iOS / Jest: no native ticker, fall back to JS setInterval.
    tick = setInterval(onTick, TICK_MS);
  }
}

function onTick(): void {
  if (status !== 'running') return;
  if (currentRemaining() <= 0) {
    expire();
    return;
  }
  emit();
  if (status === 'running' && notifLive) {
    const remaining = currentRemaining();
    if (remaining !== lastNotifiedRemaining) {
      lastNotifiedRemaining = remaining;
      // Fire-and-forget, dispatched synchronously in this task (no await
      // before this call): JS is single-threaded, so no transition can
      // interleave between the notifLive check and this dispatch, and
      // notifee's bridge calls are processed FIFO — a later hide()/show()
      // from a transition always lands after this in-flight update.
      timerNotification.showRunning(remaining, target, label);
    }
  }
}

function expire(): void {
  stopTick();
  notifLive = false;
  lastNotifiedRemaining = null;
  status = 'expired';
  endAt = null;
  emit();
  startAlarm();
  const gen = ++opGen;
  // Cancel BEFORE showing: trigger and display share one notification id,
  // and cancelling the trigger also removes a displayed notification.
  timerNotification.cancelExpiryTrigger().then(() => {
    if (gen !== opGen) return;
    return timerNotification.showExpired(label);
  });
}

// -- public API ------------------------------------------------------------

export function start(
  durationSec: number,
  owner: string,
  ownerLabel?: string,
): void {
  stopAlarm(); // a replaced timer may be mid-alarm
  stopTick();
  notifLive = false;
  lastNotifiedRemaining = null;
  status = 'running';
  target = durationSec;
  ownerKey = owner;
  label = ownerLabel;
  endAt = Date.now() + durationSec * 1000;
  remainingAtPause = 0;
  startTick();
  emit();
  const at = endAt;
  const gen = ++opGen;
  timerNotification
    .ensurePermission()
    .then(() => {
      if (gen !== opGen) return;
      return timerNotification.cancelExpiryTrigger();
    })
    .then(() => {
      if (gen !== opGen) return;
      return timerNotification.showRunning(durationSec, durationSec, label);
    })
    .then(() => {
      if (gen !== opGen) return;
      notifLive = true;
      // Sync to the value just displayed so the first tick doesn't
      // redundantly re-show the same remaining time as a "change".
      lastNotifiedRemaining = durationSec;
      return timerNotification.scheduleExpiryTrigger(at, label);
    });
}

export function pause(): void {
  if (status !== 'running') return;
  remainingAtPause = currentRemaining();
  notifLive = false;
  lastNotifiedRemaining = null;
  status = 'paused';
  endAt = null;
  stopTick();
  emit();
  const gen = ++opGen;
  timerNotification.cancelExpiryTrigger().then(() => {
    if (gen !== opGen) return;
    return timerNotification.showPaused(remainingAtPause, target, label);
  });
}

export function resume(): void {
  if (status !== 'paused') return;
  status = 'running';
  endAt = Date.now() + remainingAtPause * 1000;
  startTick();
  emit();
  const at = endAt;
  const remaining = remainingAtPause;
  const gen = ++opGen;
  timerNotification.showRunning(remaining, target, label).then(() => {
    if (gen !== opGen) return;
    notifLive = true;
    // Sync to the value just displayed — see start() for why.
    lastNotifiedRemaining = remaining;
    return timerNotification.scheduleExpiryTrigger(at, label);
  });
}

/** In-app RESET: back to idle at full duration; notification goes away. */
export function reset(): void {
  stopAlarm();
  stopTick();
  notifLive = false;
  lastNotifiedRemaining = null;
  status = 'idle';
  endAt = null;
  remainingAtPause = 0;
  emit();
  const gen = ++opGen;
  timerNotification.cancelExpiryTrigger().then(() => {
    if (gen !== opGen) return;
    return timerNotification.hide();
  });
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
  notifLive = false;
  lastNotifiedRemaining = null;
  status = 'idle';
  endAt = null;
  remainingAtPause = 0;
  ownerKey = null;
  label = undefined;
  target = 0;
  emit();
  const gen = ++opGen;
  timerNotification.cancelExpiryTrigger().then(() => {
    if (gen !== opGen) return;
    return timerNotification.hide();
  });
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
  stopTick(); // also tears down the tick subscription, if any
  opGen++; // invalidate any in-flight notification chain from the previous test
  notifLive = false;
  lastNotifiedRemaining = null;
  status = 'idle';
  target = 0;
  ownerKey = null;
  label = undefined;
  endAt = null;
  remainingAtPause = 0;
  listeners.clear();
  snapshot = {status: 'idle', target: 0, remaining: 0, ownerKey: null};
}
