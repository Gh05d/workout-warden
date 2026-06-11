// src/common/timerSound.ts
//
// Thin JS bridge for the native `TimerSound` module (see
// android/app/src/main/java/com/workoutwarden/TimerSoundModule.kt).
//
// Plays the bundled `res/raw/timer_done.mp3` via Android's MediaPlayer on
// the ALARM audio stream — bypasses notification silencing and respects
// the user's alarm volume. iOS has no native module wired up, so the
// fallback is a no-op.

import {NativeModules, Platform, Vibration} from 'react-native';

interface TimerSoundBridge {
  play(): void;
  stop(): void;
}

const noop: TimerSoundBridge = {play() {}, stop() {}};

const native = NativeModules.TimerSound as TimerSoundBridge | undefined;

// The no-op fallback is only intended for iOS. On Android a missing module
// means the registration broke (e.g. TimerSoundPackage not added in
// MainApplication.kt, or the new-arch interop layer was disabled) — surface
// that instead of silently skipping every alarm.
if (native == null && Platform.OS === 'android') {
  console.warn(
    'TimerSound: native module not found — timer alarms will be silent. ' +
      'Check TimerSoundPackage registration in MainApplication.kt.',
  );
}

export const TimerSound: TimerSoundBridge = native ?? noop;

// Android's Vibrator pattern is [wait, on, wait, on, ...] — the first value
// is always a leading delay. Start with 0 so the first buzz is immediate;
// otherwise the user perceives the alarm as silent until the delay elapses.
const VIBRATION_PATTERN = [0, 600, 250, 600, 250, 1200];

/**
 * Start the timer-expiry alarm: repeating vibration + sound on the alarm
 * stream. The vibration repeats until stopAlarm() is called — callers must
 * pair every start with a stop on all exit paths (including unmount).
 */
export function startAlarm(): void {
  Vibration.vibrate(VIBRATION_PATTERN, true);
  TimerSound.play();
}

/** Stop both alarm channels. Safe to call when no alarm is running. */
export function stopAlarm(): void {
  Vibration.cancel();
  TimerSound.stop();
}
