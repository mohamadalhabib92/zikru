package expo.modules.focuslock

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Mode Focus — épinglage d'écran (screen pinning).
 * Sur un appareil non géré, Android affiche lui-même une confirmation
 * (« Épingler cette appli ? ») : l'utilisateur garde toujours la main.
 */
class FocusLockModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FocusLock")

    Function("start") {
      val activity = appContext.currentActivity ?: return@Function false
      activity.runOnUiThread {
        try { activity.startLockTask() } catch (_: Throwable) {}
      }
      true
    }

    Function("stop") {
      val activity = appContext.currentActivity ?: return@Function false
      activity.runOnUiThread {
        try { activity.stopLockTask() } catch (_: Throwable) {}
      }
      true
    }

    Function("isPinned") {
      val ctx = appContext.reactContext ?: return@Function false
      val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
      } else {
        @Suppress("DEPRECATION") am.isInLockTaskMode
      }
    }
  }
}
