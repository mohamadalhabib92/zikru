# Zikru — Apple Watch et Apple TV

Document de travail pour Mohamed. Rien ici n’a été envoyé sur l’App Store : pas de `eas build`, pas de `eas submit`.

Le téléphone (iOS `com.vibecode.zikru-76mpdv`, Android, PWA) reste le même projet Expo. La montre est une cible native ajoutée à ce projet. L’Apple TV est une **autre** application, dans `apps/zikru-tv`, parce qu’un portage tvOS du projet téléphone casserait le build iPhone.

## Pourquoi cette découpe

| | Apple Watch | Apple TV |
|---|---|---|
| Où | `targets/watch`, `targets/watch-widget`, module `modules/zikru-watch` | `apps/zikru-tv` |
| UI | SwiftUI. Expo n’a pas de cible watchOS. | Expo Router + `react-native-tvos` |
| Build | Le **même** `eas build -p ios` que l’iPhone. La montre est dans l’ipa. | Commande lancée **depuis** `apps/zikru-tv`. Profils `preview` et `production` de ce dossier. |
| Calcul des heures | Bibliothèque `adhan` sur l’iPhone. La montre affiche le relevé reçu (8 jours). | La même bibliothèque `adhan`, sur la TV, avec les villes et méthodes déjà dans l’app. |
| Version EAS | Inchangée : `production` du dépôt racine, `autoIncrement`, source `remote`. | `appVersionSource: local`, `autoIncrement: false`. Ne pas partager le compteur de build de l’iPhone. |

Expo documente tvOS en remplaçant `react-native` par `react-native-tvos` puis en passant `EXPO_TV=1`. Ce plugin réécrit le projet natif **pour la TV à la place de l’iPhone**. Ici, le téléphone dépend de modules sans tvOS (`react-native-ble-plx`, photo, notifications, OCR). Les remplacer dans le `package.json` racine changerait le binaire iPhone. On ne le fait pas.

`react-native-tvos@0.88-stable` existe (SDK 58 / RN 0.88). Il est utilisé **seulement** par `apps/zikru-tv`.

## Apple Watch

### Ce que la montre fait

- Horaires du jour et compte à rebours, avec le lieu, la méthode et le madhhab Asr de l’iPhone.
- Huit jours sont envoyés. Au-delà, la montre dit d’ouvrir l’iPhone. Elle ne recalcule pas : une seconde implémentation d’`adhan` divergerait.
- Tasbih : formules **approuvées** déjà dans l’app (arabe inchangé, source affichée, badge « Exemple » si c’est le contenu d’amorçage). Retour haptique. Chaque appui est ajouté au compteur de l’iPhone quand la montre le joint. Le chiffre sur le poignet est la séance du poignet, pas une copie en direct du total du téléphone.
- Complication « Prochaine prière » (cadran).
- Adhan : notification locale courte, son `adhan_cue.wav` (Jarih, CC BY-SA 3.0, moins de 30 s) s’il est dans le bundle. Pas de lecture des fichiers Wikimedia. Le signal suit les prières cochées et le réglage « Adhan à l’heure de la prière ». S’il est coupé, la montre ne sonne pas.

### Identifiants

| Cible | Bundle ID |
|---|---|
| iPhone (inchangé) | `com.vibecode.zikru-76mpdv` |
| Montre | `com.vibecode.zikru-76mpdv.watchkitapp` |
| Complication | `com.vibecode.zikru-76mpdv.watchkitapp.widget` |
| App Group (montre + complication) | `group.com.vibecode.zikru-76mpdv` |

L’App Group ne sert **pas** à faire passer les données de l’iPhone à la montre (ce sont deux appareils). L’iPhone envoie le relevé par WatchConnectivity (`updateApplicationContext`, et un envoi de complication au plus toutes les 15 minutes si le relevé change). L’app montre l’écrit dans l’App Group pour la complication.

L’identifiant iPhone **n’a pas** reçu l’entitlement App Group, pour ne pas invalider le profil de provisionnement actuel tant que le portail n’est pas prêt. Les entitlements sont sur les cibles montre.

`EXPO_NO_CAPABILITY_SYNC=1` doit rester : EAS ne crée pas les capacités tout seul. Il faut les créer à la main **avant** le prochain build iOS, sinon la signature des cibles montre échoue. Le binaire iPhone, lui, n’a pas de nouvelle capacité.

### Étapes Apple (Mohamed)

1. [developer.apple.com](https://developer.apple.com) → Identifiers → App Groups → enregistrer `group.com.vibecode.zikru-76mpdv` (équipe `Y9XF9RY2BU`).
2. Nouvel App ID **WatchKit App**, bundle `com.vibecode.zikru-76mpdv.watchkitapp`. Cocher App Groups et ce groupe. Ne pas activer de push.
3. Nouvel App ID **App Extension** (WidgetKit), bundle `com.vibecode.zikru-76mpdv.watchkitapp.widget`. Même App Group.
4. L’App ID iPhone existant : ne rien ajouter si le build doit rester signable tout de suite. Les profils montre sont distincts.
5. App Store Connect, fiche `6773032754` : la montre voyage **dans** le binaire iPhone. Pas une fiche séparée. Après le premier binaire qui contient la montre, l’écran « Apple Watch » de la fiche peut demander des captures.
6. Garder `EXPO_NO_CAPABILITY_SYNC=1` sur le build. Les profils des cibles `ZikruWatch` et `ZikruWatchWidget` sont déclarés dans `app.json` (`extra.eas.build.experimental.ios.appExtensions`) pour qu’EAS les prépare. S’il demande un profil, le créer sur le portail (distribution App Store) et l’associer, sans lancer la synchro automatique des capacités.

### Commandes (dépôt racine)

Ne pas lancer tant que les trois identifiants et l’App Group existent.

```bash
# à la racine du dépôt, pas dans apps/zikru-tv
EXPO_NO_CAPABILITY_SYNC=1 npx eas-cli@latest build --platform ios --profile production
```

Le profil `production` ne change pas : `autoIncrement`, source de version `remote`. Android et le profil `preview` non plus, à part que le prebuild iOS embarque maintenant la montre. Un build Android n’a pas de cible watchOS.

Simulateur (après prebuild local, Xcode, montre jumelée au simulateur) :

```bash
npx expo prebuild -p ios --clean
npx expo run:ios
```

Le dossier `ios/` généré ne se commite pas.

## Apple TV

Lecture seule, navigation au focus (télécommande) :

- Horaires du jour, compte à rebours, ville et méthode déjà dans l’app (`adhan`).
- Coran : arabe alquran.cloud `quran-simple-enhanced`, sens Hamidullah, Pickthall ou Muyassar, citation affichée. Pas les éditions QuranEnc (autre API) dans cette première TV.
- Adhan : les cinq voix Wikimedia déjà listées, lues en HTTPS, attribution (auteur, licence, page) à l’écran. Rien n’est copié dans le binaire. Pas de synthèse.
- Dhikr approuvé (contenu d’amorçage, badge exemple) et du‘as déjà sourcées. L’arabe n’est pas modifié. Le sens français des du‘as est celui du dépôt. Pas de traduction anglaise de ces textes.
- Pas de compte, pas de communauté, pas de Bluetooth, pas de photo.

Interface : français d’abord. L’anglais de **cette** interface TV est marqué « pas encore relue » (✎). Les noms de prières anglais reprennent le catalogue déjà dans l’app.

### Ce qui n’est pas un build iPhone

`apps/zikru-tv` a son propre `package.json` (`react-native` → `react-native-tvos@0.88-stable`) et son `eas.json`. Il n’a pas le `projectId` du téléphone, pour ne pas incrémenter le build number distant de l’iPhone.

Même bundle ID `com.vibecode.zikru-76mpdv` : sur l’App Store, tvOS peut être une plateforme de la même fiche, mais le **profil de provisionnement tvOS n’est pas** le profil iOS. EAS ne le crée pas. `credentialsSource` est `local`.

### Étapes Apple (TV)

1. Installer le SDK tvOS dans Xcode (`xcodebuild -downloadPlatform tvOS` ou les réglages Composants).
2. Portail développeur : le bundle `com.vibecode.zikru-76mpdv` doit autoriser tvOS (capability de la plateforme). Créer un profil de **distribution tvOS** (pas le profil iOS) avec le certificat de distribution déjà utilisé, et le garder en local (`credentials.json`, non commité).
3. App Store Connect : ajouter la plateforme tvOS à la fiche existante. Captures 1920×1080. Ce n’est pas une seconde fiche si le bundle ID est le même.
4. Ne pas activer `autoIncrement` ni `appVersionSource: remote` sur ce projet EAS.

### Commandes

```bash
cd apps/zikru-tv
npm install
npx eas-cli@latest init --id <nouveau-projet-sous-habib548>
# ne pas réutiliser 92e1bb51-c48f-41ed-9131-13a6ed6bdb22

# simulateur Apple TV (Mac + Xcode)
EXPO_TV=1 npx expo prebuild --clean
npx expo run:ios

# nuage, seulement après le profil tvOS local
EXPO_NO_CAPABILITY_SYNC=1 npx eas-cli@latest build --platform ios --profile preview
EXPO_NO_CAPABILITY_SYNC=1 npx eas-cli@latest build --platform ios --profile production
```

Le plugin `@react-native-tvos/config-tv` est réglé avec `isTV: true` : ce dossier ne produit pas un binaire iPhone.

## Limites (honnêtes)

- La montre sans iPhone à portée garde les huit jours déjà reçus, puis s’arrête. Pas de GPS sur la montre, pas de recalcul.
- La complication ne se met à jour qu’après un passage du relevé (ouverture de Zikru sur l’iPhone, montre ayant déjà lancé l’app au moins une fois).
- Le chrome de la montre (boutons, « Touchez pour compter ») est en français. Les **noms** de prière suivent la langue du téléphone.
- L’adhan de la montre n’est pas la voix choisie dans les réglages. C’est le signal court déjà embarqué, ou le son par défaut si le fichier n’est pas dans la cible.
- Les appuis montre sont comptés comme des appuis manuels sur l’iPhone. Remettre à zéro sur la montre n’efface pas les appuis déjà reçus.
- Expo Go n’a ni la montre ni le module natif. Il faut un build EAS ou `expo run:ios`.
- L’Apple TV n’est pas le même binaire. Pas de compteur partagé avec le téléphone, pas de hors-ligne du Coran tant qu’une sourate n’a pas été ouverte une fois (cache local ensuite).
- QuranEnc, le mushaf page par page, la communauté, Bilal, le Bluetooth et la météo ne sont pas sur la TV.
- Ici, `expo prebuild` a produit un projet iOS avec les cibles `ZikruWatch` (watchOS, bundle `.watchkitapp`, embarquée dans `Watch/`) et `ZikruWatchWidget`, et un projet tvOS (`platform :tvos`, `SDKROOT = appletvos`). Il n’y a pas eu de compilation Xcode, ni de signature, ni de `eas build`.
