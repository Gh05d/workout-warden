package com.workoutwarden

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// Legacy ReactPackage works under the new-arch interop layer in RN 0.85.
// The `createNativeModules` override is flagged deprecated against the new
// TurboModule registry path, but the bridge still exposes us via
// `NativeModules.TimerSound`. Suppress the warning rather than migrating
// to BaseReactPackage/codegen for a single 2-method module.
@Suppress("DEPRECATION")
class TimerSoundPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
      listOf(TimerSoundModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
