# Google Play — piste de test interne

Ce dépôt est prêt pour un Android App Bundle (AAB) de production et pour `eas submit` sur la piste **internal**, en release **draft**. Rien ici ne lance de build, ne soumet l’app, ni ne la publie. La clé du compte de service ne doit jamais être commitée.

Package Android, déjà dans `app.json` : `ch.mohamadba.zikru`. Il est définitif dès le premier envoi : un autre package est une autre application.

## Ce qui est déjà réglé dans le dépôt

| Réglage | Où | Effet |
| --- | --- | --- |
| Compteur de version distant | `eas.json` → `cli.appVersionSource: remote` et `build.production.autoIncrement: true` | EAS garde le `versionCode` Android (et le `buildNumber` iOS) sur ses serveurs et l’augmente à chaque build **production**. |
| AAB | `build.production.android.buildType: app-bundle` | Le profil production produit un `.aab`. Le profil `preview` reste un APK : Play ne l’accepte pas pour une app nouvelle. |
| Soumission Android | `submit.production.android` | Piste `internal`, `releaseStatus: draft`, clé lue dans `$GOOGLE_SERVICE_ACCOUNT_KEY_PATH`. |
| Soumission iOS | `submit.production.ios` | Inchangée. `android.buildType` ne concerne pas iOS. |
| Icône adaptative | `android.adaptiveIcon` | Premier plan, fond, monochrome, fond `#0F3D30`. Les trois PNG font 1024×1024. |
| Notifications et adhan | permissions + plugins | Voir plus bas. |

Le champ local `android.versionCode` a été retiré. Avec la source distante, EAS ne s’en sert plus une fois le compteur créé, et une valeur locale `1` n’aurait servi qu’à amorcer le premier build production à **2**. Sans valeur locale, ce premier build initialise le compteur distant à **1**, puis les suivants l’augmentent. Si un build production Android a déjà eu lieu sur ce projet EAS, le compteur distant existe déjà : le retirer de `app.json` ne le remet pas à zéro. Pour le réaligner sur un `versionCode` déjà présent dans Play, la doc Expo décrit `eas build:version:set` ([App version management](https://docs.expo.dev/build-reference/app-versions)). Ce dépôt ne l’exécute pas.

`ios.buildNumber` reste dans `app.json`. Le compteur iOS distant, s’il existe déjà, continue de primer.

## Limites, sans les arrondir

- **Créer l’app** se fait dans Play Console. Il n’y a pas d’API pour ça. `eas submit` ne peut viser que l’app déjà créée, avec ce package.
- **Premier envoi manuel.** La procédure ci-dessous demande de déposer le premier AAB à la main. La doc Expo actuelle dit que cette étape est facultative et que `eas submit` peut créer la première release sur la piste internal ([Submit to the Google Play Store](https://docs.expo.dev/submit/android), [envoi manuel](https://docs.expo.dev/submit/android-manual)). On la garde quand même : c’est à ce moment-là que la Console propose la signature Play (clé générée par Google), et le profil du dépôt est en `draft` pour ne pas distribuer tout seul.
- **`draft` n’est pas un déploiement.** L’AAB est attaché à la piste internal, mais les testeurs ne le reçoivent pas tant que la release n’est pas validée dans la Console. Ce n’est pas une mise en production.
- **Même `versionCode` deux fois : refus.** L’AAB envoyé à la main consomme son `versionCode`. Ne pas le renvoyer avec `eas submit`. Le build production suivant en prend un nouveau.
- **Compte personnel créé après le 13 novembre 2023.** Avant une distribution publique, Google demande un test fermé avec au moins 12 testeurs inscrits en continu pendant 14 jours, puis une demande d’accès à la production ([App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)). La piste **internal** n’a pas cette exigence. Cette page vise les comptes personnels ; si le compte est une organisation, regarder dans la Console si la production est déjà ouverte.
- **Inscription Play Console : 25 USD, une fois**, payés à la création du compte développeur. La page d’aide ne décrit pas d’abonnement annuel ni de prix par application. Le paiement n’est pas remboursé si la vérification d’identité est refusée ([Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)).
- **Pas d’URL Play Store.** L’app n’est pas publiée. Ne pas inventer de lien `play.google.com/store`.
- **La clé n’est pas dans git**, et ce dépôt ne la dépose pas non plus chez Expo. `serviceAccountKeyPath` est défini : EAS remplace `$GOOGLE_SERVICE_ACCOUNT_KEY_PATH` par la variable du shell qui lance `eas submit`. Si elle est absente, le chemin reste littéral et la soumission échoue. Le build n’a pas besoin de cette variable. Omettre le champ ferait utiliser une clé enregistrée sur les serveurs Expo ; ce n’est pas la configuration retenue ([schéma eas.json](https://docs.expo.dev/eas/json)).
- **Pas de micro.** `expo-audio` a `recordAudioAndroid: false` et `microphonePermission: false`. Le manifeste ne demande pas `RECORD_AUDIO`.
- **Pas de push.** `expo-notifications` a `enableRemoteNotifications: false`. La clé Play ne sert pas à Firebase.

## 1. Compte Play Console

Aide officielle : [Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en). L’inscription passe par [play.google.com/console/signup](https://play.google.com/console/signup) (connexion Google). Compte Google, 18 ans, accord de distribution, frais de 25 USD, type de compte (personnel ou organisation), vérification d’identité. Un compte personnel doit aussi vérifier un appareil Android avant de publier ; le détail est dans la même page.

## 2. Créer l’application

Dans [Play Console](https://play.google.com/console) : **Create app**.

- Nom : Zikru. Langue par défaut : français (c’est la langue de l’app).
- Application, pas un jeu. Gratuite : l’app ne vend rien (checklist, « Digital purchases = No »).
- Le package n’est pas toujours demandé sur cet écran. Il est lu dans l’AAB au premier envoi. N’envoyer qu’un AAB de **ce** projet, profil **production**. Package attendu : `ch.mohamadba.zikru`.

## 3. Premier AAB, à la main

Sur la machine qui a le compte Expo du projet (`owner` `habib548`, `extra.eas.projectId` dans `app.json`) :

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile production
```

Télécharger le `.aab` depuis la page du build Expo. Ne pas committer ce fichier. Suivre ensuite [l’envoi manuel Expo](https://docs.expo.dev/submit/android-manual) :

1. Play Console → test interne → liste d’e-mails de testeurs → enregistrer.
2. Créer une release.
3. Intégrité de l’app → clé de signature → **clé générée par Google** (Play App Signing). La clé d’envoi reste celle du projet EAS, sur les serveurs Expo, pas dans git. Un autre keystore sera refusé après cet envoi.
4. Envoyer le `.aab`. Le `versionCode` affiché est celui du compteur distant.
5. Nom de release, puis enregistrer. L’avertissement « no deobfuscation file » peut être ignoré pour l’instant : la doc Expo le dit.
6. Ne pas promouvoir vers la production.

Les builds suivants doivent rester sur le même projet EAS, profil production, pour réutiliser cette clé d’envoi.

## 4. Compte de service et clé JSON

Guide Expo, à suivre pour les libellés d’écran : [creating-google-service-account.md](https://github.com/expo/fyi/blob/main/creating-google-service-account.md).

1. Projet Google Cloud s’il n’y en a pas : [console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate).
2. [Comptes de service](https://console.cloud.google.com/iam-admin/serviceaccounts) → Create Service Account. Nom reconnaissable (ex. envoi Play de Zikru). Copier l’e-mail du compte.
3. Manage keys → Create new key → **JSON**. Le fichier se télécharge.
4. Activer [Google Play Android Developer API](https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com).
5. Play Console → [Users and permissions](https://play.google.com/console/users-and-permissions) → Invite new users. Coller l’e-mail du compte de service. Onglet des permissions de l’app : sélectionner Zikru.
6. Droits indiqués par le guide Expo, pas Admin :
   - View app information (read-only)
   - Edit and delete draft apps
   - Release to production, exclude devices, and use Play App Signing
   - Release apps to testing tracks
   - Manage testing tracks and edit tester lists
   - Manage store presence

   La Console coche seule, en grisé, View app quality information, Manage policy declarations et Manage deep links. Pas besoin de View financial data, Manage orders and subscriptions, ni Reply to reviews.
7. Invite user.

Déposer le JSON **hors de git**. Le dossier `secrets/` est ignoré :

```bash
mkdir -p secrets
mv ~/Downloads/le-fichier-telecharge.json secrets/play-service-account.json
export GOOGLE_SERVICE_ACCOUNT_KEY_PATH="$PWD/secrets/play-service-account.json"
```

Un chemin absolu hors du dépôt convient aussi. Avant chaque commit : `git status` ne doit montrer ni ce JSON, ni un `*.keystore`. Sont ignorés : `secrets/`, `*.keystore`, `*service-account*.json`, `*serviceAccount*.json`, `*service_account*.json`, `pc-api-*.json`, et un JSON dont le nom finit par un tiret puis 12 caractères hexadécimaux (le nom que Google Cloud donne souvent au téléchargement, du type `projet-a1b2c3d4e5f6.json`). Un autre nom déposé à la racine du dépôt n’est pas ignoré : le mettre dans `secrets/` ou hors du dépôt.

Cette clé sert à `eas submit`. Ne pas la coller dans une issue, un screenshot, ou un secret Expo public.

## 5. Fiche, données, classification, politique

La Console bloque certaines actions tant que ces formulaires sont vides. Les réponses déjà alignées sur le code sont dans `store/app-privacy-checklist.md` (section 2 pour Data safety). Ne pas les contredire.

- **Politique de confidentialité** (URL déjà publiée et déjà utilisée par l’app) : `https://mohamadalhabib92.github.io/zikru/privacy/`
- Page d’assistance déjà citée dans la politique : `https://mohamadalhabib92.github.io/zikru/support/`
- Demande de suppression, URL indiquée par la checklist : `https://mohamadalhabib92.github.io/zikru/privacy/#fr-retention` — aussi dans l’app : Réglages › Confidentialité › Supprimer mon compte.
- Contact déjà dans la politique : `mohamadalhabib@live.com`.
- **Data safety** : collecte oui ; chiffrement en transit oui ; suppression possible oui ; compte facultatif par e-mail et code. Le détail des types (position approximative, nom, e-mail, identifiant, conviction religieuse, messages, contenu généré) est dans la checklist. Partage au sens Play : Non, sauf si Google exige de déclarer les messages Bilal comme partagés avec le prestataire.
- **Publicité** : non.
- **Classification de contenu** : remplir le questionnaire dans la Console. La checklist donne trois réponses IARC : les utilisateurs peuvent échanger du contenu = oui ; la position n’est pas partagée avec d’autres utilisateurs = non ; achats numériques = non. Le badge d’âge affiché par Play est le résultat du questionnaire, pas une valeur à inventer ici.
- **Service de premier plan** : le plugin `expo-audio` (`enableBackgroundPlayback: true`) ajoute `FOREGROUND_SERVICE` et `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, et déclare un service `mediaPlayback`. Si la page App content demande une déclaration, le type est la lecture média : l’adhan et les récitations partent d’une action de l’utilisateur (lecture, ou ouverture de la notification). Une vidéo de démonstration peut être exigée ([Foreground service requirements](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en)).
- **Alarmes exactes** : le manifeste déclare `SCHEDULE_EXACT_ALARM`, pas `USE_EXACT_ALARM`. La politique Play réserve `USE_EXACT_ALARM` aux apps dont le cœur est un réveil, un minuteur ou un calendrier, et soumet cette permission restreinte à examen ([Permissions and APIs that access sensitive information](https://support.google.com/googleplay/android-developer/answer/16558241?hl=en-GB)). `SCHEDULE_EXACT_ALARM` fait la même chose, avec l’accord de l’utilisateur. Quand il active les rappels, Android peut ouvrir les réglages « Alarmes et rappels ». S’il refuse, les notifications restent ; l’heure peut glisser. Si la Console affiche quand même un formulaire au moment de la release, décrire cet usage.

Autres permissions, déjà là, à ne pas retirer : `POST_NOTIFICATIONS` (aussi ajoutée par `expo-notifications`), `MODIFY_AUDIO_SETTINGS` (aussi ajoutée par `expo-audio`), Bluetooth du compteur, localisation pour les horaires et la qibla. `RECEIVE_BOOT_COMPLETED` est ajoutée par `expo-notifications` pour reprogrammer après un redémarrage ; elle n’est pas répétée dans `app.json`.

## 6. Builds et envois suivants

Même machine, clé hors du dépôt, variable définie dans **ce** shell :

```bash
export GOOGLE_SERVICE_ACCOUNT_KEY_PATH="/chemin/absolu/vers/play-service-account.json"
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --profile production
```

`eas submit` demande quel build envoyer. Choisir un build **production** dont le `versionCode` n’est pas déjà dans Play. Le profil dépose l’AAB sur **internal** en **draft**. Ouvrir ensuite la release dans la Console et la valider pour les testeurs internes. Ce n’est toujours pas la production.

Build et envoi d’un coup, même profil (donc toujours draft / internal). La variable doit déjà être définie :

```bash
npx eas-cli@latest build --platform android --profile production --auto-submit
```

En CI, la doc Expo utilise `eas submit --platform android --profile production` avec `EXPO_TOKEN`. `--non-interactive` ne peut pas demander la clé : avec le champ `serviceAccountKeyPath`, il faut que `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` soit définie dans l’environnement du job. Ne pas y mettre le contenu JSON du compte de service dans le dépôt.

iOS, inchangé de ce côté :

```bash
npx eas-cli@latest build --platform ios --profile production
```

Le `autoIncrement` du profil production continue de s’appliquer au `buildNumber` iOS. La soumission iOS continue d’utiliser `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID` et `EXPO_ASC_ISSUER_ID`.
