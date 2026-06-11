package com.workoutwarden

import android.media.AudioAttributes
import android.media.MediaPlayer
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TimerSoundModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  // Guarded by `this`: @ReactMethod calls run on the NativeModulesQueue
  // thread, but the completion listener fires on the player's looper thread,
  // so every access to `player` must be synchronized.
  private var player: MediaPlayer? = null

  override fun getName(): String = NAME

  @ReactMethod
  @Synchronized
  fun play() {
    // Idempotent: if a player is already running, don't restart it.
    if (player != null) return
    val mp = MediaPlayer.create(reactApplicationContext, R.raw.timer_done) ?: return
    mp.setAudioAttributes(
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build())
    mp.setOnCompletionListener {
      synchronized(this) { if (player === it) player = null }
      it.release()
    }
    player = mp
    mp.start()
  }

  @ReactMethod
  @Synchronized
  fun stop() {
    val mp = player ?: return
    player = null
    try {
      if (mp.isPlaying) mp.stop()
    } catch (_: IllegalStateException) {
      // MediaPlayer can throw if it's in an invalid state — release anyway.
      // A double release() (racing the completion listener) is documented
      // as safe.
    }
    mp.release()
  }

  companion object {
    const val NAME = "TimerSound"
  }
}
