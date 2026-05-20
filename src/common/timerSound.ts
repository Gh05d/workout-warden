// src/common/timerSound.ts
//
// Thin JS bridge for the native `TimerSound` module (see
// android/app/src/main/java/com/workoutwarden/TimerSoundModule.kt).
//
// Plays the bundled `res/raw/timer_done.mp3` via Android's MediaPlayer on
// the ALARM audio stream — bypasses notification silencing and respects
// the user's alarm volume. iOS has no native module wired up, so the
// fallback is a no-op.

import {NativeModules} from 'react-native';

interface TimerSoundBridge {
  play(): void;
  stop(): void;
}

const noop: TimerSoundBridge = {play() {}, stop() {}};

export const TimerSound: TimerSoundBridge =
  (NativeModules.TimerSound as TimerSoundBridge | undefined) ?? noop;
