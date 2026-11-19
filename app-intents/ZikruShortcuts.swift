import AppIntents

/// Phrases Siri (compilées dans l'app). Chaque phrase doit contenir \(.applicationName).
/// Français d'abord (langue principale), anglais en complément.
struct ZikruShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: NextPrayerIntent(),
      phrases: [
        "Prochaine prière dans \(.applicationName)",
        "Quelle est la prochaine prière dans \(.applicationName)",
        "Next prayer in \(.applicationName)"
      ],
      shortTitle: "Prochaine prière",
      systemImageName: "clock"
    )
    AppShortcut(
      intent: StartWirdIntent(),
      phrases: [
        "Démarrer mon wird dans \(.applicationName)",
        "Start my wird in \(.applicationName)"
      ],
      shortTitle: "Démarrer mon wird",
      systemImageName: "leaf"
    )
    AppShortcut(
      intent: OpenTasbihIntent(),
      phrases: [
        "Ouvrir le tasbih dans \(.applicationName)",
        "Open tasbih in \(.applicationName)"
      ],
      shortTitle: "Ouvrir le tasbih",
      systemImageName: "circle.dotted"
    )
  }
}
