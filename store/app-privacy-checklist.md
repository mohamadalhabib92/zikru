# Zikru 1.0.24 — réponses « App Privacy » (App Store Connect), « Data safety » (Google Play) et classification par âge

Source de vérité : `src/lib/privacy-policy.ts` (politique publiée sur https://mohamadalhabib92.github.io/zikru/privacy/).
Ces réponses décrivent le comportement **réel** de la version 1.0.24. À mettre à jour à chaque nouveau flux de données.

Faits techniques qui fondent les réponses :
- Horaires de prière, qibla, hégirien, tasbih, Coran, rappels : calculés et stockés **sur l’appareil** (aucun envoi).
- Météo (facultative, consentement explicite) : position **arrondie à 0,1°** (≈ 10 km) envoyée à Open-Meteo (OpenMeteo GmbH, Suisse). Pas d’identifiant. Le nom de ville est trouvé localement (BigDataCloud supprimé).
- Compte (facultatif, uniquement pour Communauté / Famille) : Supabase, hébergement Zurich (eu-central-2). E-mail, nom affiché, identifiant de compte, familles/cercles, messages d’encouragement, objectifs partagés, séances de dhikr partagées, agenda familial, contrôles parentaux. Suppression du compte dans l’app.
- Bilal (IA, facultatif, consentement explicite) : texte des messages → fonction Supabase (Zurich) → Anthropic (États-Unis). L’identifiant de compte sert au quota et **n’est pas transmis** au fournisseur ; la conversation n’est pas enregistrée sur notre serveur (reste sur l’appareil).
- Bluetooth : lecture des appuis du compteur, en local. Notifications : planifiées en local, pas de push serveur.
- Aucune publicité, aucun SDK d’analyse ou de crash, aucun IDFA/AAID, aucune revente.
- Contact pour les demandes liées aux données (accès, rectification, suppression, opposition) : **mohamadalhabib@live.com** (politique section 1 et droits, fr/en/ar ; page d’assistance). Réponse sous 30 jours. À reporter dans Google Play › Data safety / fiche (adresse e-mail de contact) et dans App Store Connect si demandé.

---

## 1. App Store Connect → App Privacy

**« Do you or your third-party partners collect data from this app? » → Yes**

Pour **chaque** type ci-dessous : Purpose = **App Functionality** uniquement. Tracking = **No**.
Ne cocher **aucun** autre usage (pas Third-Party Advertising, Developer’s Advertising, Analytics, Product Personalization, Other).

| Catégorie Apple | Type | Collecté ? | Linked to the user? | Tracking | Pourquoi |
|---|---|---|---|---|---|
| Contact Info | **Email Address** | Oui | **Yes** | No | Connexion par code (compte facultatif) |
| Contact Info | **Name** | Oui | **Yes** | No | Nom affiché dans Famille / Cercles |
| Contact Info | Phone, Physical Address, Other | Non | — | — | |
| Location | **Coarse Location** | Oui | **No** | No | Météo, position arrondie ≈ 10 km envoyée à Open-Meteo sans identifiant |
| Location | Precise Location | **Non** | — | — | Le GPS précis reste sur l’appareil (horaires, qibla) |
| Sensitive Info | **Sensitive Info** | Oui | **Yes** | No | Appartenance à une famille / un cercle de dhikr et pratique partagée = conviction religieuse |
| User Content | **Emails or Text Messages** | Oui | **Yes** | No | Messages d’encouragement entre membres ; messages envoyés à Bilal |
| User Content | **Other User Content** | Oui | **Yes** | No | Objectifs partagés, séances et compteurs de dhikr partagés, agenda familial, noms de famille/cercle |
| User Content | Photos/Videos, Audio, Gameplay, Customer Support | Non | — | — | |
| Identifiers | **User ID** | Oui | **Yes** | No | Identifiant du compte Supabase |
| Identifiers | Device ID | **Non** | — | — | Aucun IDFA/IDFV collecté (l’ID Bluetooth du compteur reste local) |
| Health & Fitness, Financial Info, Contacts, Browsing History, Search History, Purchases, Usage Data, Diagnostics, Other Data | — | **Non** | — | — | |

Notes :
- « Linked » = Yes pour tout ce qui passe par le compte (l’e-mail l’identifie). Les messages Bilal sont rattachés au compte côté quota : on déclare donc *Linked* par prudence.
- « Tracking » = No partout : aucune donnée n’est combinée avec des données de tiers à des fins publicitaires ni partagée avec un courtier. Ne pas afficher la demande ATT.
- Privacy Policy URL : `https://mohamadalhabib92.github.io/zikru/privacy/`
- Le manifeste `ios.privacyManifests.NSPrivacyCollectedDataTypes` de `app.json` déclare exactement ces 7 types (EmailAddress, Name, UserID, CoarseLocation, EmailsOrTextMessages, OtherUserContent, SensitiveInfo), Tracking = false, but = AppFunctionality.

## 2. Google Play Console → Data safety

**Questions générales**
- Does your app collect or share any of the required user data types? → **Yes**
- Is all of the user data collected by your app encrypted in transit? → **Yes** (HTTPS/TLS partout)
- Do you provide a way for users to request that their data is deleted? → **Yes** — dans l’app (Réglages › Confidentialité › Supprimer mon compte) ; URL de demande : `https://mohamadalhabib92.github.io/zikru/privacy/#fr-retention`
- Account creation : « My app allows users to create an account » → méthode : **Email + OTP** ; compte **facultatif**.

**Types de données** (pour chacun : Collected = Yes, Shared = **No**¹, Processed ephemerally = selon tableau, Required/Optional = **Optional**, Purpose = **App functionality** uniquement)

| Catégorie Play | Type | Ephemeral ? | Remarque |
|---|---|---|---|
| Location | **Approximate location** | **Yes** | Météo, arrondie ≈ 10 km, non stockée par nous |
| Location | Precise location | — **Non collecté** | Reste sur l’appareil |
| Personal info | **Name** | No | Nom affiché |
| Personal info | **Email address** | No | Compte |
| Personal info | **User IDs** | No | ID de compte |
| Personal info | **Religious or political beliefs** | No | Appartenance famille/cercle, pratique partagée |
| Messages | **Other in-app messages** | No | Encouragements entre membres ; messages à Bilal (ces derniers sont éphémères côté serveur) |
| App activity | **Other user-generated content** | No | Objectifs, séances partagées, agenda familial |
| App activity | In-app search history | — **Non collecté** | Recherche Coran locale |
| Device or other IDs | — | — **Non collecté** | |
| App info and performance (crash logs, diagnostics) | — | — **Non collecté** | Aucun SDK |

¹ **Shared = No** : au sens de Google, le transfert à un prestataire qui traite pour notre compte (Supabase, Anthropic, Open-Meteo) n’est pas un « partage ». Si Google l’exige pour Bilal, cocher *Shared → Other in-app messages → App functionality*.

## 3. Classification par âge (nouveau questionnaire Apple, depuis juillet 2025)

L’app contient désormais : messagerie entre membres (encouragements), contenus générés par les utilisateurs (noms de cercles, règles, objectifs), un assistant IA conversationnel (Bilal) et un mode Famille avec contrôles parentaux.

Réponses recommandées :
- Violence, contenu sexuel/nudité, grossièretés, horreur, drogues/alcool/tabac, jeux d’argent, concours, contenu médical : **None**.
- **Messaging and Chat** : **Yes** (encouragements entre membres d’une famille ou d’un cercle).
- **User-Generated Content** : **Yes**.
- **Social Media** (« social networking ») : No (pas de profil public ni de fil ouvert ; communautés sur invitation).
- **Advertising** : No.
- **Unrestricted Web Access** : No (liens externes vers des sources uniquement).
- **Parental Controls** : **Yes** (mode Famille).
- **Age Assurance** : No.
- Assistant IA / chatbot : le déclarer dans la question sur le contenu généré (Bilal est cadré par un prompt religieux, sans contenu mature).

Classification attendue : **13+** (messagerie + UGC sans modération complète). Pour viser **9+** il faudrait que la messagerie soit limitée aux membres invités **et** que signalement/blocage soient en place (P6).

⚠️ **Guideline 1.2 (UGC)** : Apple exige pour toute app avec UGC/messagerie : (a) un filtre ou une modération, (b) un moyen de **signaler** un contenu, (c) un moyen de **bloquer** un utilisateur abusif, (d) un contact publié. Ces éléments ne sont **pas encore** dans l’app → **P6 obligatoire avant d’activer la Communauté en production**, sinon risque de refus 1.2.

Google Play → IARC : répondre « Users can interact/exchange content » = **Yes** ; « Shares user location with other users » = No ; « Digital purchases » = No.
