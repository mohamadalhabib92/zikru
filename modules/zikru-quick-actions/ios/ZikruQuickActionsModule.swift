import ExpoModulesCore
import UIKit

/// Action reçue avant que le JS soit prêt (démarrage à froid) ou pendant qu'il tourne.
final class ZikruQuickActionsStore {
  static let prefix = "zikru.action."
  static var pending: String?
  static var onAction: ((String) -> Void)?

  static func deliver(_ type: String) {
    guard type.hasPrefix(prefix) else { return }
    let id = String(type.dropFirst(prefix.count))
    pending = id
    onAction?(id)
  }
}

/// Reçoit `performActionFor` (y compris au démarrage à froid : ExpoAppSceneDelegate le relaie).
public class ZikruQuickActionsAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    guard shortcutItem.type.hasPrefix(ZikruQuickActionsStore.prefix) else {
      completionHandler(false)
      return
    }
    ZikruQuickActionsStore.deliver(shortcutItem.type)
    completionHandler(true)
  }
}

public class ZikruQuickActionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ZikruQuickActions")
    Events("onAction")

    OnStartObserving {
      ZikruQuickActionsStore.onAction = { [weak self] id in
        self?.sendEvent("onAction", ["id": id])
      }
    }
    OnStopObserving {
      ZikruQuickActionsStore.onAction = nil
    }

    /// Lit puis efface l'action en attente (une seule fois).
    Function("takePending") { () -> String? in
      let id = ZikruQuickActionsStore.pending
      ZikruQuickActionsStore.pending = nil
      return id
    }

    /// Remplace les actions de l'icône (titres déjà traduits côté JS).
    AsyncFunction("setItems") { (items: [[String: String]]) in
      let list: [UIApplicationShortcutItem] = items.prefix(4).compactMap { item in
        guard let id = item["id"], let title = item["title"] else { return nil }
        let icon = item["icon"].map { UIApplicationShortcutIcon(systemImageName: $0) }
        return UIApplicationShortcutItem(
          type: ZikruQuickActionsStore.prefix + id,
          localizedTitle: title,
          localizedSubtitle: item["subtitle"],
          icon: icon,
          userInfo: nil
        )
      }
      UIApplication.shared.shortcutItems = list
    }.runOnQueue(.main)
  }
}
