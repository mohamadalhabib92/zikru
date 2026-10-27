# Zikru — fiche App Store (brouillon)

> Brouillon à recopier dans App Store Connect. Rien n'a été soumis.

| Champ | Valeur |
|---|---|
| Nom (≤ 30) | Zikru – Prière, Qibla, Tasbih (29 car.) |
| Sous-titre (≤ 30) | Prière, qibla et tasbih (23 car.) |
| Bundle ID | `com.vibecode.zikru-76mpdv` |
| SKU proposé | `zikru-ios-001` |
| Projet EAS | `92e1bb51-c48f-41ed-9131-13a6ed6bdb22` (compte habib548) |
| Version / build | 1.0.0 / numéro de build géré par EAS (remote, autoIncrement) |
| Langue principale | Français |
| Catégorie principale | Style de vie (Lifestyle) |
| Catégorie secondaire | Référence (Reference) |
| Prix | Gratuit |
| URL de confidentialité | https://mohamadalhabib92.github.io/zikru/privacy/ |
| URL d'assistance | https://mohamadalhabib92.github.io/zikru/support/ |
| URL marketing | https://mohamadalhabib92.github.io/zikru/ |
| Copyright | 2026 Mohamed El Habib Ba |
| Appareils | iPhone + iPad (supportsTablet) |
| Chiffrement | Aucun chiffrement non exempté (ITSAppUsesNonExemptEncryption = false) |

## Texte promotionnel (≤ 170)
Horaires de prière calculés hors ligne, boussole de qibla, tasbih avec compteur Bluetooth et calendrier hégirien.

## Mots-clés (≤ 100, séparés par des virgules)
`prière,salat,qibla,tasbih,dhikr,adhan,islam,musulman,hijri,horaires,compteur,bluetooth` (86 car.)

## Description — FR
Zikru, votre compagnon spirituel au quotidien.

• Horaires de prière calculés sur l'appareil, même hors ligne.
• Boussole de qibla et distance jusqu'à la Kaaba.
• Tasbih : compteur persistant, objectifs, retour haptique.
• Compteurs et bagues de dhikr Bluetooth : comptez chaque appui directement dans l'app.
• Dhikr avec leurs sources.
• Calendrier hégirien.
• Interface en français, anglais, allemand et arabe.

## Description — EN
Zikru is a daily spiritual companion: offline prayer times calculated on device, qibla compass, persistent tasbih counter with haptics, support for Bluetooth tasbih counters and dhikr rings, sourced dhikr and a Hijri calendar. French, English, German and Arabic interface.

## Classification par âge
4+ — réponses au questionnaire : aucune violence, aucun contenu sexuel, pas de jeux d'argent, pas de navigation web non filtrée, pas de contenu médical, pas de messagerie entre utilisateurs.

## Confidentialité de l'app (étiquettes « nutrition »)
- **Collecte de données : « Nous ne collectons pas de données »** (Data Not Collected). Tout est stocké uniquement sur l'appareil et n'est transmis ni à l'éditeur ni à des tiers (au sens d'Apple, il n'y a donc pas de « collecte »).
- Suivi (tracking) : Non. Pas d'identifiant publicitaire.
- À revoir si un backend (Supabase, Stripe, API) est activé dans une version future.

Données stockées localement (pour information) :
- Vos compteurs de tasbih, objectifs et historique ;
- Votre ville ou position (pour les horaires et la qibla), vos réglages de calcul et de langue ;
- L'identifiant du compteur Bluetooth que vous avez associé.

Autorisations :
- Localisation « pendant l'utilisation » : facultative, pour calculer les horaires et la qibla sur l'appareil. Vous pouvez saisir une ville à la place.
- Bluetooth : facultatif, pour se connecter à votre compteur de tasbih ou bague de dhikr. Seuls les appuis du compteur sont lus.

## Notes pour l'équipe de révision (App Review)
Aucun compte, fonctionne hors ligne. Le Bluetooth sert uniquement à lire les appuis d'un compteur de tasbih ou d'une bague de dhikr (une simulation est disponible dans l'écran Tasbih pour tester sans appareil). La localisation sert uniquement au calcul local des horaires et de la qibla.

Contact révision : à compléter (prénom, nom, téléphone, e-mail de Mohamed). Compte de démonstration : non requis.

## Captures d'écran à fournir
- iPhone 6,9 pouces (1320 × 2868 ou 1290 × 2796) : 3 à 10 captures.
- iPad 13 pouces (2064 × 2752 ou 2048 × 2732) : 3 à 10 captures (obligatoire car l'app est disponible sur iPad).

## Risques de refus (App Review) et corrections
| Niveau | Risque | À faire avant soumission |
|---|---|---|
| Moyen | 2.1 Contenus marqués « exemples à faire valider » et écran « Configuration manquante » (Supabase). | Faire valider les dhikr par un référent, retirer la mention « exemple » et masquer l'écran de configuration dans la version App Store. |
| Moyen | 4.3 : le marché des apps de prière est très saturé. | Mettre en avant la fonction distinctive (compteurs Bluetooth, hégirien unifié) dans la description et les captures. |
| Faible | Le Bluetooth doit être réellement utile pour le test. | Le mode de simulation et les notes de révision le permettent ; fournir une vidéo de démonstration avec un vrai compteur si possible. |
