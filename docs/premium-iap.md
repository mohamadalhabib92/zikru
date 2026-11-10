# Zikru Premium — achat à vie (non appliqué en production)

Branche d’intégration : au-dessus de `cursor/testflight-integration-5e5e` (1.0.30). Aucun build EAS, aucune soumission, aucune migration appliquée au Supabase hébergé.

## Identifiant

`ch.mohamadba.zikru.premium.lifetime`

App Store Connect n’accepte dans un identifiant d’achat que des lettres, des chiffres, des underscores et des points. Le bundle iOS reste `com.vibecode.zikru-76mpdv` (il contient un trait d’union, donc il ne peut pas servir de préfixe). L’identifiant d’achat est celui du package Android `ch.mohamadba.zikru`, le même sur l’App Store et sur Google Play.

## Bibliothèque

`expo-iap` 6.4.3 (StoreKit 2 / Play Billing, plugin Expo). Pas de RevenueCat, pas de secret dans l’app. Le reçu n’est pas envoyé à un serveur : l’appareil relit les achats au lancement et garde un cache local si le store ne répond pas.

## Ce que Premium débloque

Seulement :

1. créer un zikr personnel (composition, objectifs, répétitions) ;
2. créer un groupe : famille, cercle, groupe local, ou programme de groupe.

Le téléchargement, les horaires, la qibla, le Coran, l’adhan, le tasbih, les zikrs inclus, rejoindre par invitation ou par demande acceptée restent gratuits.

## Antériorité (rien n’est effacé)

Au premier lancement de cette version, l’app regarde les zikrs déjà sur l’appareil et les groupes locaux créés par la personne (le groupe d’exemple « Zikr Allah Akbar » ne compte pas). Si elle en a déjà un, Premium est accordé sur cet appareil (`grandfather`), sans réécrire ces données. Un compte qui a déjà créé une famille, un cercle ou un programme reçoit le même droit quand il est en ligne. Les zikrs déjà présents restent modifiables même sans cet enregistrement : le verrou ne porte que sur une nouvelle création.

La migration locale `20261110120000_premium_creation.sql` (non appliquée) ajoute une ligne `user_entitlements` source `grandfather` pour ces créateurs, sans modifier leurs groupes. Le plan `lifetime` ne reprend pas les anciens bonus (50 membres, Bilal illimité) : les autres limites restent celles du gratuit.

## Verrou serveur

Le verrou `premium_creation_gate` est **false**. L’app refuse déjà la création. Le serveur ne bloque qu’après :

```sql
update public.app_config set value = 'true' where key = 'premium_creation_gate';
```

et seulement quand un achat vérifié peut écrire `user_entitlements` (clé App Store côté serveur, jamais dans l’app). Tant que `payments_enabled` reste false, une ligne `storekit` ne compte pas. L’appliquer trop tôt empêcherait un client payant de créer un groupe.

Les zikrs personnels ne sont pas en base : le serveur ne peut pas les verrouiller. Le verrou client suffit pour la v1.

## Administration des groupes

Déjà en place, conservé : le créateur d’une famille est parent, le créateur d’un cercle est fondateur ; pas d’entrée publique ; la suppression d’une famille est réservée aux parents et celle d’un cercle au fondateur ; on peut quitter un groupe ; une invitation de famille vient d’un parent.

Ajusté dans `20261110130000_admin_groupe.sql` (fichier local, non appliqué) : composer le zikr (objectifs, programme, session), retirer un autre membre et supprimer le groupe sont réservés au parent ou au fondateur. Un adulte ou un modérateur ne le peut plus. L’invitation d’un cercle vient du fondateur. Une demande d’entrée n’ajoute personne tant que l’administrateur ne l’accepte pas. `delete_group` retire ce groupe seulement : les compteurs des autres objectifs et le profil restent. Les compteurs d’une étape ne sont pas réécrits quand on change son nombre ou sa place.

## App Store Connect — à faire avant tout build

1. Compte payant : **Paid Apps Agreement** signé (Accords, fiscalité et banque), coordonnées bancaires et fiscales à jour.
2. Fonctionnalité : **In-App Purchases** activée pour l’app `com.vibecode.zikru-76mpdv`.
3. Produit :
   - Type : **Non-Consumable** (non consommable, pas un abonnement).
   - Product ID : `ch.mohamadba.zikru.premium.lifetime` (exactement, sans trait d’union).
   - Reference name : `Zikru Premium lifetime`.
   - Prix : palier **CHF 8.45** (le palier Apple le plus proche si 8.45 n’existe pas tel quel ; ne pas écrire ce montant dans l’app). Disponibilité : tous les pays.
   - Localisations au minimum français et anglais : nom « Zikru Premium », description « Achat unique à vie : créer ses zikrs et ses groupes. Le reste de Zikru reste gratuit. »
   - Capture d’examen : écran Premium (prix, ce qui est inclus, Restaurer, liens confidentialité et conditions).
4. Confidentialité de l’app : ajouter **Purchases / Purchase History**, lié à l’utilisateur = Non, suivi = Non, finalité = Fonctionnalité de l’app. Politique : la page confidentialité (section Achats).
5. Ne pas lancer `eas build` ni `eas submit` tant que ce produit n’existe pas dans App Store Connect.

## Essai sandbox (notes de révision)

1. Créer un compte **Sandbox** dans Utilisateurs et accès › Sandbox (App Store Connect). Se déconnecter du compte Apple de production sur l’appareil, ou utiliser Réglages › Développement › Compte Sandbox.
2. Installer un build de développement ou TestFlight qui contient ce code (pas Expo Go : StoreKit n’y est pas).
3. Ouvrir Réglages › Zikru Premium, ou tenter « Nouvelle composition » / « Créer une famille ».
4. Le prix affiché doit venir du store, pas d’un montant écrit dans l’app.
5. Acheter avec le compte sandbox. Annuler : rien ne change. Couper le réseau pendant l’achat : un droit déjà vérifié reste. Relancer l’app : l’achat est relu.
6. Supprimer et réinstaller, puis **Restaurer les achats** : Premium revient.
7. Sans Premium : on peut encore ouvrir un zikr déjà créé, rejoindre un groupe avec un code, et utiliser prière, qibla, Coran, adhan et tasbih.
8. Avec Premium : créer un groupe. L’administrateur retire un membre, change le nombre d’un objectif, et supprime le groupe après confirmation. Un autre membre ne peut pas le faire. La version web affiche que l’achat se fait dans l’app iOS.
