# Kaizen

Petites améliorations, une par semaine. Rien n’est fusionné depuis cette note.

## 2026-11-23

Les builds iPhone 1.0.30 (96) et Apple TV (18) attendent l’essai sur appareil. Cette passe ne touche pas le compteur de bague, le focus télé, la liste du Coran télé, ni la mémorisation télé.

### 1. Garde de versions Expo

- Avant : un `expo-file-system` qui ne correspondait pas à `expo-modules-core` faisait planter le lancement (`DYLD Symbol missing`, build 43). Rien ne vérifiait, à chaque test, que les modules natifs installés suivent la carte du SDK.
- Après : `scripts/test-expo-versions.mjs` compare chaque dépendance connue de `package.json`, plus `expo-modules-core`, à `expo/bundledNativeModules.json` (la même carte que `npx expo install --check`, lue en local, sans réseau). Un écart fait échouer `npm test`. Le 2026-11-23, les versions installées correspondaient déjà : aucun paquet n’a été changé.
- Fichiers : `scripts/test-expo-versions.mjs`, `package.json` (chaîne `npm test`).
- Tests : le script vérifie aussi qu’une version 57 de `expo-file-system` ou de `expo` serait refusée, et que `expo-file-system` et `expo-modules-core` sont bien dans le contrôle.

### 2. Compte à rebours de la prochaine prière (iPhone)

- Avant : l’accueil et l’écran Prières arrondissaient le temps restant à la minute et se rafraîchissaient toutes les 30 s. Sous 30 s, le bandeau affichait « 0 min ». Au-dessus d’une heure, l’unité des minutes manquait (« 2 h 05 »).
- Après : le temps restant porte toujours son unité (« 2 h 05 min », « 14 min », « 45 s »). Sous deux minutes, l’horloge avance chaque seconde ; au-delà, toujours toutes les 30 s. Le texte du compte à rebours est un peu plus grand, en chiffres tabulaires, or `#E2C171` sur le vert du bandeau (le même or déjà lisible sur l’accueil). Les horaires calculés ne changent pas. L’écran Prières de l’Apple TV garde l’ancien texte, pour ne pas bouger le build en essai.
- Fichiers : `src/lib/prayer.ts` (`countdownClock`, `prayerClockTick` ; `countdown` inchangé), `src/app/(tabs)/index.tsx`, `src/app/(tabs)/prayers.tsx`.
- Tests : `scripts/test-a-plus.mjs` (heures, minutes, secondes, zéro, temps négatif, seuil des deux minutes, et l’ancien arrondi « 0 min » toujours là).
