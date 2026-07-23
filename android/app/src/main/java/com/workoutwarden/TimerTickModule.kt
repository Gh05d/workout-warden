package com.workoutwarden

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

// Native ticker for the workout timer notification. RN's JS Timing module
// (setInterval) is paused by the OS on host-pause even while our foreground
// service keeps the process alive — so a JS interval alone freezes the
// notification's per-second refresh exactly when the user backgrounds the
// app. This module ticks from a Handler on the main looper instead: as long
// as the process is alive (which the FGS guarantees), these callbacks keep
// firing and reach JS via a DeviceEventEmitter event.
class TimerTickModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  // Guarded by `this`: @ReactMethod calls run on the NativeModulesQueue
  // thread, but the Handler callback fires on the main looper thread, so
  // every access to `tickRunnable` must be synchronized.
  private val handler = Handler(Looper.getMainLooper())
  private var tickRunnable: Runnable? = null

  override fun getName(): String = NAME

  @ReactMethod
  @Synchronized
  fun start(intervalMs: Double) {
    stopLocked()
    val interval = intervalMs.toLong()
    val runnable =
        object : Runnable {
          override fun run() {
            if (reactApplicationContext.hasActiveReactInstance()) {
              reactApplicationContext
                  .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                  .emit("WorkoutTimerTick", null)
            }
            handler.postDelayed(this, interval)
          }
        }
    tickRunnable = runnable
    handler.postDelayed(runnable, interval)
  }

  @ReactMethod
  @Synchronized
  fun stop() {
    stopLocked()
  }

  // Not annotated itself — only ever called from `start()`/`stop()`, which
  // already hold the monitor (Kotlin's @Synchronized is reentrant).
  private fun stopLocked() {
    tickRunnable?.let { handler.removeCallbacks(it) }
    tickRunnable = null
  }

  companion object {
    const val NAME = "TimerTick"
  }
}
