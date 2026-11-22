# Zikru 1.0.30 — réponses « App Privacy » (App Store Connect), « Data safety » (Google Play) et classification par âge

Source de vérité : `src/lib/privacy-policy.ts` (politique publiée sur https://mohamadalhabib92.github.io/zikru/privacy/, version 1.0.30, 10 novembre 2026).
Ces réponses décrivent le comportement **réel** de la version 1.0.30, y compris l’iPhone, l’iPad, le Mac (app iPad sur Apple Silicon), l’Apple Watch embarquée et l’Apple TV (tvOS, même fiche `6773032754`).

Faits techniques qui fondent les réponses :

- Horaires, qibla, hégirien, tasbih, texte arabe du Coran (Tanzil, dans l’app), Pickthall, rappels : sur l’appareil. Aucun envoi.
- Météo (facultative, consentement) : position **arrondie à 0,1°** (≈ 10 km) envoyée à Open-Meteo (OpenMeteo GmbH, Bürglen, Suisse ; serveurs en Europe et en Amérique du Nord). Pas d’identifiant. Le nom de ville est calculé sur l’appareil. Journaux Open-Meteo : 90 jours, selon eux.
- Compte (facultatif, Communauté / Famille / Bilal) : Supabase Inc. (États-Unis, sous-traitant), base à Zurich (`eu-central-2`). E-mail (code à usage unique), nom affiché, identifiant, familles, cercles, messages d’encouragement, objectifs, séances, agenda, contrôles parentaux. Suppression du compte dans l’app.
- Messages et séances : chiffrés **en transit**, pas encore de bout en bout. Liens refusés, filtre d’insultes graves. Un enfant n’écrit par défaut qu’à ses parents.
- Signalement et blocage : un signalement envoie à l’équipe (mohamadalhabib@live.com) une copie du contenu, l’identifiant du compte, le motif et la précision. La personne signalée n’est pas prévenue. Conservation : 365 jours après traitement.
- Appels de groupe (audio / vidéo, quand ils sont ouverts) : serveur **LiveKit que nous hébergeons en Europe** (pas un nuage LiveKit aux États-Unis). La ville exacte sera écrite dans la politique à l’ouverture du service. Le serveur reçoit l’identifiant, le nom affiché et l’adresse IP le temps de l’appel. Son et image : chiffrés en transit, pas encore de bout en bout, **non enregistrés**. Zikru ne garde qu’une trace technique (heure, groupe, vidéo oui/non), 30 jours.
- Bilal (facultatif, consentement) : messages → fonction Supabase (Zurich) → Anthropic PBC (États-Unis, Claude). L’identifiant sert au quota et **n’est pas transmis** à Anthropic. Le contenu n’est pas enregistré sur nos serveurs. Anthropic : suppression en principe sous 30 jours, pas d’entraînement.
- Contenus et CDN, seulement quand la personne ouvre la fonction. Aucun identifiant de compte :
  - `api.alquran.cloud` — traductions encore proposées (Hamidullah) et tafsirs encore proposés (Jalalayn, as-Sa‘di).
  - `api.quran.com` — tafsir as-Sa‘di.
  - `quranenc.com` — **non contacté** dans le build App Store (`EXPO_PUBLIC_STORE_RELEASE=1`) tant que la licence n’est pas confirmée.
  - `everyayah.com`, secours `cdn.islamic.network` — récitation verset par verset, après l’ouverture, Wi-Fi sauf réglage contraire. Pas dans la sauvegarde iCloud.
  - `cdn.mp3quran.net` — audio de la sourate al-Kahf, cité, lu à la demande.
  - `upload.wikimedia.org` — voix d’adhan qui ne sont pas déjà dans l’app. L’écran verrouillé n’utilise que le son court embarqué.
  - GitHub Pages (GitHub Inc., États-Unis) — site et PWA, journaux techniques dont l’adresse IP.
- Apple Watch : WatchConnectivity avec l’iPhone. Compteurs et libellés restent sur les appareils. Pas de serveur de plus.
- Apple TV : mêmes serveurs facultatifs que le téléphone (compte, LiveKit, CDN de contenu). Pas de collecte propre à la télé.
- Bluetooth : appuis du compteur, en local. Notifications : locales, pas de push serveur (`enableRemoteNotifications: false`).
- Achat Premium à vie : Apple (plus tard Google Play). Zikru ne reçoit pas la carte. L’identifiant de produit et de transaction **restent sur l’appareil**. Le reçu n’est pas envoyé aux serveurs Zikru. Ce n’est donc pas une donnée « collectée » au sens Apple (elle ne quitte pas l’appareil).
- Aucune publicité, aucun SDK d’analyse ou de crash, aucun IDFA/AAID, aucune revente.
- Contact données : **mohamadalhabib@live.com**. Réponse sous 30 jours.

Écart corrigé par rapport à la fiche 1.0.24 : l’historique d’achat n’est plus déclaré collecté (il ne quitte pas l’appareil, comme le dit déjà la politique §13). Le son et l’image des appels LiveKit, les signalements, la montre et la télé sont maintenant nommés. `quranenc.com` reste nommé, avec la précision qu’il n’est pas appelé dans le build App Store.

---

## 1. App Store Connect → App Privacy

**« Do you or your third-party partners collect data from this app? » → Yes**

Pour **chaque** type : Purpose = **App Functionality** uniquement. Tracking = **No**.

| Catégorie Apple | Type | Collecté ? | Linked to the user? | Tracking | Pourquoi |
|---|---|---|---|---|---|
| Contact Info | **Email Address** | Oui | **Yes** | No | Connexion par code (compte facultatif) |
| Contact Info | **Name** | Oui | **Yes** | No | Nom affiché dans Famille / Cercles, et pendant un appel |
| Contact Info | Phone, Physical Address, Other | Non | — | — | |
| Location | **Coarse Location** | Oui | **No** | No | Météo, ≈ 10 km, Open-Meteo, sans identifiant |
| Location | Precise Location | **Non** | — | — | Le GPS précis reste sur l’appareil (horaires, qibla). La montre et la télé n’ajoutent pas de position. |
| Sensitive Info | **Sensitive Info** | Oui | **Yes** | No | Appartenance à une famille / un cercle et pratique partagée |
| User Content | **Emails or Text Messages** | Oui | **Yes** | No | Encouragements, messages à Bilal, texte d’un signalement |
| User Content | **Audio Data** | Oui | **Yes** | No | Appel LiveKit. Temps réel, non enregistré. Lié au compte le temps de l’appel. |
| User Content | **Photos or Videos** | Oui | **Yes** | No | Vidéo d’un appel, seulement si la personne l’ouvre. Non enregistrée. |
| User Content | **Other User Content** | Oui | **Yes** | No | Objectifs, séances, agenda, noms de famille/cercle, copie du contenu signalé |
| User Content | Gameplay, Customer Support | Non | — | — | |
| Identifiers | **User ID** | Oui | **Yes** | No | Identifiant Supabase. Aussi envoyé à LiveKit le temps de l’appel. Pas à Anthropic. |
| Identifiers | Device ID | **Non** | — | — | Pas d’IDFA. L’identifiant Bluetooth du compteur reste local. |
| Purchases | Purchase History | **Non** | — | — | Reçu StoreKit gardé sur l’appareil, non envoyé à Zikru. |
| Health & Fitness, Financial Info, Contacts, Browsing History, Search History, Usage Data, Diagnostics, Other Data | — | **Non** | — | — | |

Notes :
- « Tracking » = No partout. Ne pas afficher ATT.
- Privacy Policy URL : `https://mohamadalhabib92.github.io/zikru/privacy/`
- Le manifeste `ios.privacyManifests.NSPrivacyCollectedDataTypes` de `app.json` déclare EmailAddress, Name, UserID, CoarseLocation, EmailsOrTextMessages, AudioData, PhotosorVideos, OtherUserContent, SensitiveInfo. Tracking = false, but = AppFunctionality. PurchaseHistory n’y est plus : le reçu ne quitte pas l’appareil.
- Les CDN de contenu reçoivent l’adresse IP et l’élément demandé, comme un site web. Apple ne demande pas une ligne « IP » séparée pour ça. Aucun identifiant de compte ne leur est joint.

## 2. Google Play Console → Data safety

**Questions générales**
- Does your app collect or share any of the required user data types? → **Yes**
- Is all of the user data collected by your app encrypted in transit? → **Yes** (HTTPS/TLS, LiveKit en transit)
- Do you provide a way for users to request that their data is deleted? → **Yes** — dans l’app ; URL : `https://mohamadalhabib92.github.io/zikru/privacy/#fr-retention`
- Account creation : **Email + OTP**, compte **facultatif**.

**Types** (Collected = Yes, Shared = **No**¹, Required/Optional = **Optional**, Purpose = **App functionality**)

| Catégorie Play | Type | Ephemeral ? | Remarque |
|---|---|---|---|
| Location | **Approximate location** | **Yes** | Météo, ≈ 10 km |
| Location | Precise location | — **Non collecté** | Reste sur l’appareil |
| Personal info | **Name** | No | Nom affiché |
| Personal info | **Email address** | No | Compte |
| Personal info | **User IDs** | No | ID de compte |
| Personal info | **Religious or political beliefs** | No | Famille / cercle, pratique partagée |
| Messages | **Other in-app messages** | No | Encouragements, Bilal (éphémère côté serveur), signalements |
| Audio | **Voice or sound recordings** | **Yes** | Appel LiveKit, non enregistré |
| Photos and videos | **Photos** / **Videos** | **Yes** | Vidéo d’appel seulement si elle est ouverte, non enregistrée |
| App activity | **Other user-generated content** | No | Objectifs, séances, agenda, contenu signalé |
| Financial info | Purchase history | — **Non collecté** | Apple / Google encaissent. Le reçu ne va pas sur nos serveurs. |
| Device or other IDs | — | — **Non collecté** | |
| App info and performance | — | — **Non collecté** | Aucun SDK |

¹ **Shared = No** au sens Google : Supabase, Anthropic, Open-Meteo et le LiveKit que nous hébergeons traitent pour notre compte. Si Google l’exige pour Bilal ou LiveKit, cocher *Shared → App functionality*.

## 3. Classification par âge

L’app a une messagerie entre membres, des contenus déposés par les utilisateurs (noms, règles, objectifs, messages), un signalement, un blocage, un filtre d’insultes, un assistant IA (Bilal) et un mode Famille.

Réponses :
- Violence, sexe/nudité, grossièretés, horreur, drogues, jeux d’argent, concours, contenu médical : **None**.
- **Messaging and Chat** : **Yes**.
- **User-Generated Content** : **Yes**.
- **Social Media** : No (pas de profil public ni de fil ouvert ; invitation).
- **Advertising** : No.
- **Unrestricted Web Access** : No.
- **Parental Controls** : **Yes**.
- **Age Assurance** : No.

**Recommandé : 13+.**

Pourquoi pas 4+ ni 9+ : des personnes peuvent s’écrire et déposer du texte. Apple classe ce couple messagerie + contenu d’utilisateurs en 13+, même lorsque le cercle est sur invitation. Les contrôles parentaux et le fait qu’un enfant n’écrit qu’à ses parents ne descendent pas la note à 9+ tant que la messagerie existe pour les adultes du cercle.

Pourquoi pas 16+ ni 18+ : pas de violence, pas de contenu sexuel, pas de jeux d’argent, pas de web ouvert. Bilal est cadré, sans contenu mature, et demande un consentement.

Guideline 1.2 : filtre, signalement, blocage et contact publié (mohamadalhabib@live.com) sont décrits dans la politique 1.0.30 et présents dans l’app. Ça ne change pas le 13+.

Google Play → IARC : « Users can interact » = **Yes** ; « Shares location with other users » = No ; « Digital purchases » = **Yes** (`ch.mohamadba.zikru.premium.lifetime`, produit Play pas encore créé).

## 4. Montre, télé, Mac

| Surface | Donnée en plus ? |
|---|---|
| Apple Watch | Non. Compteur et libellés passent par WatchConnectivity. Pas de LiveKit, pas de météo, pas de compte sur la montre. |
| Apple TV | Non, au-delà de ce tableau. Le salon peut ouvrir le Coran (CDN audio), un groupe et la discussion (Supabase, LiveKit si un appel est lancé). |
| Mac Apple Silicon | Même binaire iPad. Mêmes réponses. La boussole et le Bluetooth dépendent du Mac. |
