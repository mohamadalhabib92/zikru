import AppIntents
internal import ExpoAppIntents

// Trois intentions simples : elles ouvrent l'app sur le bon écran. Aucune donnée n'est lue
// ni envoyée ; l'app reçoit seulement l'identifiant de l'action (liste fermée côté JS).

struct NextPrayerIntent: AppIntent {
  static let title: LocalizedStringResource = "Prochaine prière"
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "open", params: ["action": "prayers"])
    return .result()
  }
}

struct StartWirdIntent: AppIntent {
  static let title: LocalizedStringResource = "Démarrer mon wird"
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "open", params: ["action": "wird"])
    return .result()
  }
}

struct OpenTasbihIntent: AppIntent {
  static let title: LocalizedStringResource = "Ouvrir le tasbih"
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "open", params: ["action": "tasbih"])
    return .result()
  }
}
