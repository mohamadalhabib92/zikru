# Zikru sur tous les écrans

Ce texte est pour Mohamed. Il dit où l’application peut vivre, ce qui marche déjà, et dans quel ordre avancer. La première version publique laisse de côté l’Apple Watch et l’Apple TV. La cible, elle, est plus large : iPhone, iPad, Mac, Android, le site web, et plus tard la télévision.

Rien ici ne lance un build, une soumission, ni une migration sur le serveur en ligne.

## Ce qui existe aujourd’hui

Le projet est une application Expo (React Native), version 1.0.30, SDK 58.

- iPhone et iPad : `supportsTablet` est déjà vrai. Identifiant `com.vibecode.zikru-76mpdv`.
- Android : le paquet est déjà nommé `ch.mohamadba.zikru`. Les icônes adaptatives, la caméra, le micro, le Bluetooth et la position sont déclarés. Le profil EAS `production` produit maintenant un Android App Bundle (`.aab`), le format que Play exige. Le profil `development` produit un APK pour les essais. Aucun compte Play Console n’est encore ouvert, et il n’y a pas de fichier `google-services.json`.
- Web : l’export PWA part sur GitHub Pages à chaque poussée sur `main` (`.github/workflows/pages.yml`), à l’adresse du dépôt `/zikru`. La page de confidentialité est déjà dedans.

## Mac

Trois chemins. Un seul est recommandé pour commencer.

| Chemin | Ce que c’est | Travail |
|---|---|---|
| App iPad sur Mac Apple Silicon | L’app iPad tourne sur le Mac, sans réécriture. Apple appelle ça « Designed for iPad ». | Presque rien. Voir plus bas. |
| Mac Catalyst | Une vraie app Mac, avec fenêtres et menus. | Gros : Expo ne livre pas Catalyst. Il faudrait un projet natif à part. |
| Site installé (Safari ou Chrome) | La PWA déjà construite, ajoutée à l’écran d’accueil ou au Dock. | Déjà en place pour qui ouvre le site. |

**Recommandation : l’app iPad sur Mac, plus le site pour qui préfère le navigateur.** Catalyst attend.

Côté code, le drapeau est déjà là : `ios.supportsTablet` vaut `true` dans `app.json`. Rien d’autre à poser dans le dépôt. Le réglage qui compte est dans App Store Connect, fiche de l’app, **Disponibilité sur les Mac Apple Silicon** (ou « Make this app available on Mac »). Il est en général coché pour une app iPad. Il ne faut pas le décocher. Ce n’est pas un second identifiant : c’est la même app, le même achat Premium.

Limites de ce Mac : pas de fenêtre redimensionnée comme une app Mac, le Bluetooth du compteur dépend du Mac, la caméra et le micro passent par les réglages macOS. Pour un usage « grand écran dans le navigateur », la PWA reste le complément.

## Apple TV

Expo 58, dans ce dépôt, n’a pas de cible tvOS. `react-native-tvos` est une branche à part de React Native, pas un plugin qu’on ajoute à cette app. Un jour, un plugin Expo TV pourra exister. Aujourd’hui, l’Apple TV serait **une autre application**, avec son propre enregistrement App Store Connect (plateforme tvOS, pas une case de l’app iPhone).

Ce qui a du sens sur une télé, avec la télécommande :

- le compteur, un bouton de la télécommande ;
- l’écoute du Coran et de l’adhan, si le son du téléviseur suffit ;
- un tableau de groupe en lecture seule (présences, leçon) ;
- la lecture partagée en grand, si la personne a Premium et un compte.

Ce qui n’a pas de sens, ou pas de matériel :

- la caméra, l’OCR, le Bluetooth d’un anneau tenu à la main ;
- la qibla précise (pas de boussole) ;
- un appel vidéo face à la caméra du téléphone.

Ampleur : un projet natif séparé, une navigation à la télécommande, et seulement une partie des écrans. À faire après le téléphone, le Mac simple, Android et le site.

## Android

Le code vise déjà Android (paquet, permissions, `expo-iap` qui parle à Play Billing, LiveKit et WebRTC déclarés). Ce qui manque n’est pas un écran, c’est le compte et quelques réglages de production.

| Sujet | État dans le dépôt |
|---|---|
| Profil EAS | `preview` : APK interne. `production` : Android App Bundle. `development` : APK avec le client de développement. |
| Compte Play Console | Pas ouvert. Sans lui, pas de fiche, pas d’achat, pas de publication. |
| Adhan | Notifications locales, comme sur iPhone. Le son court est dans l’app. L’alarme exacte (`SCHEDULE_EXACT_ALARM`) n’est **pas** déclarée : Google la restreint et demande un formulaire. On ne l’ajoute pas tant que le comportement réel n’est pas mesuré sur un téléphone. |
| Push (FCM) | `expo-notifications` a `enableRemoteNotifications: false`. Les messages de groupe passent par un drapeau de build (`EXPO_PUBLIC_GROUP_PUSH`) encore éteint, et il faudrait une clé FCM dans EAS. Rien de cela n’est posé. |
| Premium | Le même identifiant `ch.mohamadba.zikru.premium.lifetime` est prévu pour Play Billing via `expo-iap`. Le reçu n’est pas encore vérifié sur le serveur. |
| Appels | Le plugin LiveKit règle le mode « communication » sur Android. Ça ne remplace pas un essai sur un appareil. |
| OCR | Le module de lecture de photo est iPhone seulement (Vision). Sur Android, l’écran dit de copier le texte puis de le coller. |

## Site web et vitrine

Le site actuel **est** l’application (PWA) plus la page confidentialité. Il n’y a pas encore de page d’accueil « marketing » séparée (présentation, fonctions, aide). GitHub Pages peut l’héberger sans abonnement, à côté de l’app, tant que la source Pages reste « GitHub Actions ».

### Parité des fonctions

| Fonction | iPhone / iPad | Mac (app iPad) | Android | Web / PWA | Apple TV |
|---|---|---|---|---|---|
| Compteur à l’écran | Marche | Marche (même app) | Marche dans le code, pas publié | Marche | Gros travail |
| Anneau Bluetooth | Marche | Petit travail (matériel du Mac) | Marche dans le code | Sans objet | Sans objet |
| Objectifs et compteurs séparés | Marche | Marche | Marche dans le code | Marche | Gros travail |
| Rejoindre un groupe | Marche | Marche | Marche dans le code | Marche | Gros travail |
| Discussion | Marche | Marche | Marche dans le code | Marche | Peu utile |
| Appels audio / vidéo | Dans le code, éteints | Même app, à essayer | Dans le code, à essayer | Marche si le navigateur a WebRTC | Sans objet (caméra) ; l’audio serait un gros travail |
| Classes, leçon, lecture partagée | Dans le code, drapeau fermé | Même app | Dans le code | Dans le code | Gros travail, lecture seule d’abord |
| Coller un programme | Marche | Marche | Marche | Marche | Sans objet |
| Photo OCR | iPhone (Vision), pas dans tous les builds | Même limite que l’iPad | Pas de lecture sur l’appareil | Sans objet (on colle le texte) | Sans objet |
| Adhan et horaires | Marche (notifications locales) | Notifications du Mac, à vérifier | Marche dans le code ; alarme exacte non déclarée | Notification du navigateur, moins fiable | Gros travail |
| Qibla | Marche | Boussole du Mac incertaine | Marche dans le code | Position du navigateur, pas de boussole fiable | Sans objet |
| Texte du Coran (Hafs) | Marche | Marche | Marche | Marche | Gros travail |
| Écoute du Coran | Marche | Marche | Marche | Marche (hors ligne plus fragile) | Gros travail |
| Widgets | iPhone / iPad | Non | Prévu dans le code | Sans objet | Sans objet |
| Achat Premium | StoreKit, sur l’appareil | Même achat que l’iPad | Play Billing prévu, compte Play absent | Pas d’achat Apple. Voir plus bas. | Autre fiche, plus tard |
| Page vitrine (accueil, fonctions, aide) | Sans objet | Sans objet | Sans objet | Petit travail, Pages gratuit | Sans objet |

« Marche dans le code » veut dire : le même source vise cette plateforme, aucun binaire public n’a été produit dans cette étape.

### Premium sur le web, sans contourner Apple

Sur iPhone, Premium est un achat intégré. Apple interdit de mettre dans l’app iPhone un bouton qui envoie vers un paiement moins cher sur le site pour la même fonction (règle 3.1.1, et les règles « anti-steering » : ne pas pousser le client hors de l’app pour éviter la commission).

Sur le **site**, ouvert dans un navigateur, Apple n’est pas le magasin. Un paiement Stripe y est possible, à condition de :

1. ne pas placer dans l’app iPhone un lien « payez moins cher sur le site » ;
2. vérifier le paiement **sur le serveur**, puis écrire une ligne de droit sur le compte (`user_entitlements`), la même table que pour Apple et Google ;
3. laisser `payments_enabled` à faux tant que cette vérification n’existe pas (c’est le cas aujourd’hui : le reçu n’est pas envoyé au serveur).

Ainsi, un Premium acheté sur le site, sur l’iPhone ou sur Android est le **même droit**, reconnu partout où la personne se connecte. L’antériorité déjà prévue reste une ligne de cette table, pas un second système.

## Ordre recommandé

L’ampleur est la taille du changement, pas un calendrier.

1. **Mac par l’app iPad.** Vérifier dans App Store Connect que la case Mac Apple Silicon est cochée. Aucun nouveau code. Le site reste le complément navigateur.
2. **Android publiable.** Ouvrir le compte Play Console, créer l’achat `ch.mohamadba.zikru.premium.lifetime`, puis un build EAS `production` (AAB). Le profil est prêt. Ne pas déclarer l’alarme exacte avant un essai.
3. **Un seul Premium sur le serveur.** Vérifier les reçus Apple, Google et, pour le site seulement, Stripe. Écrire `user_entitlements`. Tant que ce n’est pas fait, le droit reste sur l’appareil et le web ne peut pas vendre.
4. **Vitrine.** Une page d’accueil, les fonctions, l’aide, à côté de la PWA déjà sur GitHub Pages. Pas de lien depuis l’app iPhone vers un prix Stripe.
5. **Trous du web qui comptent.** L’OCR reste « coller le texte ». Les appels web existent si le navigateur a WebRTC. Le Bluetooth n’y sera pas.
6. **Apple TV en dernier**, application séparée, seulement compteur, écoute et lecture en grand.

## Annexe technique

- Expo SDK `~58`, `app.json` : iOS `supportsTablet: true`, bundle `com.vibecode.zikru-76mpdv`, Android `ch.mohamadba.zikru`, web `output: single`, `baseUrl: /zikru`.
- `eas.json` : `development` APK, `preview` APK interne, `production` AAB (`buildType: app-bundle`) et `autoIncrement`. Soumission iOS seulement (`ascAppId` `6773032754`). Pas de bloc `submit.android`.
- Notifications : plugin `expo-notifications` avec `enableRemoteNotifications: false`. Push groupe : `src/lib/group-push.native.ts`, drapeau `EXPO_PUBLIC_GROUP_PUSH`.
- Achats : `expo-iap` 6.4.3, `src/lib/premium-store.native.ts` (iOS et Android). Le web (`premium-store.ts`) a `payments: false`.
- OCR : `modules/zikru-ocr`, chargé seulement sur iOS (`src/lib/ocr.native.ts`).
- Appels : `@livekit/react-native` et WebRTC. Sur le web, `callsSupported()` regarde `RTCPeerConnection`.
- Droit serveur : `user_entitlements`, `private.may_create_groups`, `payments_enabled` faux. Sources qui comptent sans ce drapeau : `manual`, `promo`, `grandfather`. `storekit` et `play` attendent le drapeau.
- Pages : `.github/workflows/pages.yml`, branche `main` seulement.
- Apple TV : aucune dépendance tvOS dans `package.json`. Ne pas ajouter `react-native-tvos` dans cette app Expo.
