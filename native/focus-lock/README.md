# focus-lock (Android) — désactivé

Module Expo local qui permet au **Mode Focus** d'épingler l'app à l'écran sur Android
(`Activity.startLockTask()` / `stopLockTask()`). Android demande toujours une
confirmation à l'utilisateur sur un téléphone personnel.

**État : désactivé.** Ce dossier est volontairement hors de `modules/`, donc il
n'est pas autolinké et ne change rien au build actuel. Sans lui, le Mode Focus
affiche les étapes guidées d'épinglage (Réglages › Sécurité › Épinglage d'appli).

## Pour l'activer (décision de Mohamed)
1. `git mv native/focus-lock modules/focus-lock`
2. Rebuild natif Android (`npx expo prebuild -p android` puis build EAS/Gradle).
   iOS n'est pas concerné (`platforms: ["android"]`).
3. Le JS (`src/lib/focusLock.ts`) détecte le module via
   `requireOptionalNativeModule('FocusLock')` et propose « Épingler maintenant ».

Non compilé ici (pas de JDK/SDK Android sur la machine de préparation) : à valider
au premier build.

## iOS — ce qui n'est pas possible / ce qu'il faudrait
- Une app iOS ne peut pas verrouiller seule un iPhone personnel ni couper les
  notifications. `UIAccessibility.requestGuidedAccessSession` ne fonctionne que sur
  un appareil **supervisé (MDM)**.
- Alternatives réelles : **Accès guidé** (triple-clic, activé une fois par
  l'utilisateur), un **Mode de concentration iOS** avec filtre.
- **Screen Time API** (FamilyControls / ManagedSettings / DeviceActivity) : bloquer
  les autres apps pendant la séance. Nécessite : demande de l'entitlement
  *Family Controls (Distribution)* à Apple par Mohamed (équipe Y9XF9RY2BU), un config
  plugin (entitlement + extension DeviceActivityMonitor), un module natif Swift et
  un rebuild natif. Non implémenté.
