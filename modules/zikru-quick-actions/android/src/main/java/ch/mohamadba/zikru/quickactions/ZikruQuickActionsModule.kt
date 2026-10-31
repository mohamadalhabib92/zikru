package ch.mohamadba.zikru.quickactions

import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Raccourcis d'icône Android (appui long). Chaque raccourci ouvre un lien interne zikru:///…,
 * géré par expo-router comme n'importe quel lien : rien à mettre en attente côté natif.
 */
class ZikruQuickActionsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ZikruQuickActions")
    Events("onAction")

    Function("takePending") { null as String? }

    AsyncFunction("setItems") { items: List<Map<String, String>> ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return@AsyncFunction
      val context = appContext.reactContext ?: return@AsyncFunction
      val manager = context.getSystemService(ShortcutManager::class.java) ?: return@AsyncFunction
      val icon = Icon.createWithResource(context, context.applicationInfo.icon)
      val list = items.take(4).mapNotNull { item ->
        val id = item["id"] ?: return@mapNotNull null
        val title = item["title"] ?: return@mapNotNull null
        val path = item["path"] ?: return@mapNotNull null
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("zikru://$path")).setPackage(context.packageName)
        ShortcutInfo.Builder(context, id).setShortLabel(title).setLongLabel(title).setIcon(icon).setIntent(intent).build()
      }
      try {
        manager.dynamicShortcuts = list
      } catch (_: Exception) {
        // limite de fréquence du système : réessayé à la prochaine ouverture
      }
    }
  }
}
