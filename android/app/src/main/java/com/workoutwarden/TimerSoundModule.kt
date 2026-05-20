package com.workoutwarden

import android.media.AudioAttributes
import android.media.MediaPlayer
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TimerSoundModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var player: MediaPlayer? = null

  override fun getName(): String = NAME

  @ReactMethod
  fun play() {
    // Idempotent: if a player is already running, don't restart it.
    // React state updaters can be invoked twice in strict/concurrent mode,
    // and `setTimeLeft(prev => { ...; TimerSound.play(); ... })` would
    // otherwise re-create the MediaPlayer mid-playback.
    if (player != null) return
    val mp = MediaPlayer.create(reactApplicationContext, R.raw.timer_done) ?: return
    mp.setAudioAttributes(
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build())
    mp.setOnCompletionListener {
      it.release()
      if (player === it) player = null
    }
    player = mp
    mp.start()
  }

  @ReactMethod
  fun stop() {
    stopInternal()
  }

  private fun stopInternal() {
    val mp = player ?: return
    player = null
    try {
      if (mp.isPlaying) mp.stop()
    } catch (_: IllegalStateException) {
      // MediaPlayer can throw if it's in an invalid state — release anyway.
    }
    mp.release()
  }

  companion object {
    const val NAME = "TimerSound"
  }
}
