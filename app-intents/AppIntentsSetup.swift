internal import ExpoAppIntents
internal import ExpoModulesCore

/// Module inline Expo qui relie les App Intents de Zikru à expo-app-intents.
/// Ne pas renommer cette classe.
final class AppIntentsSetup: Module {
  public func definition() -> ExpoModulesCore.ModuleDefinition {
    Name("AppIntentsSetup")

    OnCreate {
      Task {
        await AppIntentDispatcher.shared.setShortcutsRefreshHandler {
          ZikruShortcuts.updateAppShortcutParameters()
        }
        ZikruShortcuts.updateAppShortcutParameters()
      }
    }
  }
}
