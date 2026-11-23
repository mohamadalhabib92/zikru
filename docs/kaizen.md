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

## 2026-11-23 — Mémorisation, vague 1

Branche `cursor/hifz-rappel-actif-267d`, à partir de `846a836`. La mémorisation reste gratuite sur iPhone et sur la télé. Les cartes `hifz-cards` ne changent pas de forme.

### Rappel actif

- Avant : la leçon se terminait par une note (facile, moyen, difficile), sans exercice qui fait chercher le verset.
- Après : depuis la mémorisation, et après une leçon ou une révision, un rappel propose l’ordre des mots, un mot manquant, la suite du verset, puis le verset suivant parmi d’autres versets de la même sourate. Les échus passent d’abord, puis la leçon. La note revient dans les mêmes cartes. La télé n’a pas de nouvel écran : elle lit ces cartes.
- Fichiers : `src/lib/hifz-wave.ts`, `src/app/quran/hifz-recall.tsx`, entrées dans `src/app/quran/hifz.tsx` et `src/app/quran/hifz-session.tsx`.
- Tests : `scripts/test-srs.mjs`.

### Plan local

- Avant : « Nouvelle leçon » proposait la suite de la dernière sourate suivie, sans plan enregistré.
- Après : une clé `hifz-plan`, à part des cartes, retient une sourate, un juz’ ou une plage, et 3, 4 ou 5 versets par jour (5 par défaut), ou une date but. La leçon proposée suit ce plan. Effacer le plan ne retire aucune carte.
- Fichiers : `src/lib/hifz-wave.ts`, `src/lib/hifz-wave-store.ts`, `src/app/quran/hifz.tsx`.
- Tests : `scripts/test-srs.mjs`.

### Série douce et rappel

- Avant : aucune série propre à la mémorisation. Le rappel Coran existait déjà, coupé par défaut, après le Fajr ou le ‘Isha.
- Après : si la file du jour est finie, ou si une leçon a été notée alors que la file était vide, un jour s’ajoute. Un jour manqué ne casse pas la série. Le nombre n’est pas un classement. Le même créneau Fajr / ‘Isha se règle depuis la mémorisation, toujours coupé par défaut.
- Fichiers : `src/lib/hifz-wave.ts` (`hifz-streak`), `src/app/quran/hifz.tsx`. Le plan des notifications n’est pas réécrit.
- Tests : `scripts/test-srs.mjs`.

### Retirer ou marquer une plage

- Avant : on ne pouvait pas, depuis l’accueil de la mémorisation, retirer une plage ni la marquer comme déjà sue.
- Après : sur la plage choisie, après confirmation, « Retirer du suivi » appelle `forgetHifz`. « Marquer comme déjà mémorisé » met l’intervalle à 21 jours, sans inventer de révisions et sans toucher aux autres cartes.
- Fichiers : `src/lib/hifz-wave.ts`, `src/app/quran/hifz.tsx`. `startHifz` reste un ajout seul.
- Tests : `scripts/test-srs.mjs`, `scripts/test-tv.mjs` (gratuité et carte visible sur la télé le jour où elle est échue).
