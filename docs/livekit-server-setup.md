# Serveur d’appels LiveKit (à faire par Mohamed)

Les appels ne sont pas ouverts. Le drapeau `calls.enabled` reste `false`, et l’adresse du serveur est vide. Tant que les deux ne sont pas remplis, l’application affiche « Bientôt disponible ». Le secret du serveur n’est jamais mis dans l’application : seule la fonction `call-token` le lit, et cette fonction n’est pas déployée.

Taille retenue : **4 vCPU, 8 Go de mémoire, 80 Go de disque**. C’est assez pour les appels audio et vidéo des groupes actuels (12 personnes au plus). Un plus petit serveur coupe l’image dès que plusieurs caméras sont ouvertes.

## Quel hébergeur

Prix relevés le 10 novembre 2026, hors TVA sauf mention.

| | Hetzner CX33 | Infomaniak (Public Cloud) |
|---|---|---|
| Où | Falkenstein ou Nuremberg, Allemagne (Union européenne) | Genève, Suisse |
| Taille | 4 vCPU, 8 Go, 80 Go NVMe | 4 vCPU, 8 Go, 50 Go, dans le tableau publié |
| Prix affiché | 8,99 € par mois, plafond mensuel, hors TVA. Source : grille Hetzner lue le 10 novembre 2026 (CX33, Falkenstein). | 16,10 CHF par mois pour cet exemple (4 processeurs, 8 Go, 50 Go, 1 To). Source : [page des prix Infomaniak](https://www.infomaniak.com/en/hosting/public-cloud/prices). |
| Trafic | Environ 20 To inclus, puis 1 € par To | 1 To dans l’exemple publié. La vidéo de groupe dépasse vite 1 To. |
| Paiement | Carte, dans la console Hetzner | Carte. Crédit d’essai possible, à vérifier au moment de la commande. |

**Recommandation : Hetzner CX33 à Falkenstein.** Le prix est clair, le serveur est en Europe, et le trafic inclus tient la vidéo. Si le CX33 est en rupture, prenez le CX43 (8 vCPU, 16 Go, 16,49 € par mois hors TVA le même jour).

**Infomaniak** si vous voulez le serveur en Suisse. Comptez alors le dépassement de trafic, ou un forfait plus large : 1 To ne suffit pas si plusieurs classes ouvrent la vidéo.

Vous créez le compte, vous payez, vous gardez la facture. Personne d’autre ne le fait à votre place.

## Ce que vous faites, dans l’ordre

1. Créez le compte chez l’hébergeur et payez le serveur (Ubuntu 24.04). Notez l’adresse IPv4.
2. Achetez ou réutilisez un nom, par exemple `appels.zikru.ch`, et faites-le pointer vers cette adresse (enregistrement A).
3. Sur le serveur, installez LiveKit (logiciel libre, licence Apache 2.0) et un relais TURN (`coturn`), avec un certificat TLS (Caddy ou le certificat de LiveKit). Ports à ouvrir : 443 (TCP), 7881 (TCP), 50000–60000 (UDP), 3478 et 5349 (TURN).
4. Choisissez une clé et un secret LiveKit dans la configuration du serveur. Ne les envoyez pas par e-mail et ne les collez pas dans le code.
5. Quand le serveur répond en `wss://appels.votredomaine`, et seulement alors, dans le tableau Supabase (pas dans l’application) :
   - secret de la fonction `call-token` : `LIVEKIT_URL` = cette adresse `wss://…`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` ;
   - puis, après avoir déployé vous-même la fonction et appliqué vous-même la migration des appels :
     ```sql
     update public.app_config set value = '"wss://appels.votredomaine"' where key = 'calls.server_url';
     update public.app_config set value = 'true' where key = 'calls.enabled';
     ```
6. L’adresse vide ou le drapeau `false` referme les appels sans nouvelle version de l’application.

La migration `20261110140000_appels_url_classes.sql` et la fonction `supabase/functions/call-token` restent locales tant que vous ne les appliquez pas. Ne les lancez pas sur la base en ligne avant d’avoir le serveur.

## App Store (quand un build sera fait, pas maintenant)

Les phrases caméra et micro sont déjà dans l’application, en français (texte par défaut) et en anglais (`locales/fr.json`, `locales/en.json`, `app.json`). Elles disent que l’image et la voix ne partent que si la personne ouvre elle-même la caméra ou le micro, vers le serveur d’appels, sans enregistrement.

À ne pas ajouter : le mode « appel en arrière-plan » (VoIP) et CallKit. Apple refuse le mode VoIP sans sonnerie native. Les appels actuels n’ont pas de sonnerie plein écran.

Déclaration chiffrement : l’application utilise le chiffrement standard du réseau (TLS, et le chiffrement de l’appel jusqu’au serveur). Le réglage « chiffrement non exempté » reste sur non. On ne déclare pas un chiffrement de bout en bout : le libellé reste « chiffré en transit, pas encore de bout en bout ».

Fiche confidentialité App Store : audio et vidéo liés à la fonction d’appel, non utilisés pour le suivi, non conservés après l’appel. La trace technique (heure, groupe) est décrite dans la politique de confidentialité.

## Rappel de sécurité

Caméra et micro éteints au départ. Chacun les ouvre. L’administrateur peut couper un micro, retirer une personne, ou terminer l’appel pour tout le monde. On peut signaler depuis l’appel. Rien n’est enregistré.
