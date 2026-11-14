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
3. Sur le serveur, installez LiveKit (logiciel libre, licence Apache 2.0) et un relais TURN (`coturn`), avec un certificat TLS. Le client tente d’abord l’UDP (ports 50000–60000 et TURN 3478). Si le réseau mobile bloque l’UDP, le repli est **TURN sur TLS, port 443** (`turns:`), le même port que le site web. Ouvrez aussi 7881 (TCP) pour le média ICE-TCP.
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

## Cibles de qualité

Les appels restent dans le groupe ou la classe. L’écran d’accueil ne lance pas d’appel. Les nombres ci-dessous sont ceux du client (`src/lib/calls/quality.ts`), pas une promesse de réseau.

| Réglage | Valeur |
|---|---|
| Son | Opus, une seule voie, 24 kbit/s au plus, DTX (silence presque gratuit), RED (paquet en double si le réseau perd) |
| Traitement | annulation d’écho, suppression du bruit, contrôle automatique du volume |
| Image, 1 ou 2 personnes | 1280×720, 30 images/s, 1,2 Mbit/s, plus deux couches plus petites (360p et 180p) |
| Image, 3 personnes ou plus | 640×360, 24 images/s, 450 kbit/s, plus la couche 180p |
| Économie de données ou batterie basse | 320×180, 15 images/s, 160 kbit/s, une seule couche. Le son ne change pas. |
| Codecs | VP8 en premier, H.264 en secours. VP9 et AV1 (SVC) sont prévus seulement quand tous les téléphones du groupe les décodent. |
| Adaptation | simulcast, dynacast (on n’envoie pas une couche que personne ne regarde), flux adaptatif (la taille de l’image suit la vignette) |
| Reprise Wi-Fi ↔ 4G | nouvel essai tout de suite, puis 0,2 s, 0,5 s, 1 s, 2 s, 4 s |
| Sortie son | Bluetooth, puis casque, puis haut-parleur. Bouton haut-parleur / écouteur sur le téléphone. |

Débit montant au plafond, avant que dynacast coupe les couches inutiles :

- tête-à-tête : 24 kbit/s + 1,2 + 0,45 + 0,16 Mbit/s ≈ **1,83 Mbit/s** ;
- grille : 24 kbit/s + 0,45 + 0,16 Mbit/s ≈ **0,63 Mbit/s** ;
- économie : 24 + 160 kbit/s ≈ **0,18 Mbit/s**.

En réception, une personne dans une grille de 12 peut tirer jusqu’à 11 fois 0,45 Mbit/s ≈ **5 Mbit/s** si chaque vignette reste en 360p. Avec de petites vignettes, le flux adaptatif descend vers 180p (11 × 0,16 ≈ **1,8 Mbit/s**).

### Taille du serveur pour cette qualité

LiveKit ne ré-encode pas : il renvoie les couches déjà envoyées. Le goulet est le processeur et le débit sortant, pas le disque.

| Charge en même temps | Machine | Pourquoi |
|---|---|---|
| Jusqu’à environ 20 cours à deux en 720p, ou une classe de 12 en grille | CX33, 4 vCPU, 8 Go | Un cours à deux sort environ 2,4 Mbit/s du serveur. Une grille de 12 en 360p peut sortir environ 60 Mbit/s si tout le monde reçoit tout le monde. Le port du CX33 (1 Gbit/s) le tient. |
| Plusieurs classes en même temps, ou des grilles qui restent en 720p | CX43, 8 vCPU, 16 Go | Le processeur de 4 cœurs sature avant le port réseau. |

Le trafic mensuel : une heure de grille à 12 personnes autour de 60 Mbit/s sortants fait environ 27 Go. Le forfait Hetzner (environ 20 To) couvre des centaines d’heures. Le forfait Infomaniak à 1 To en couvre une trentaine : trop juste si la vidéo de groupe est l’usage normal.

Exemple de relais, sans secret dans le dépôt. Le secret TURN reste sur le serveur.

```yaml
rtc:
  use_external_ip: true
  port_range_start: 50000
  port_range_end: 60000
  congestion_control:
    enabled: true
    allow_pause: true
turn:
  enabled: true
  domain: appels.votredomaine
  tls_port: 443
  udp_port: 3478
```

### Ce qui n’égale pas WhatsApp

WhatsApp chiffre de bout en bout. Zikru, non : le son et l’image sont chiffrés jusqu’au serveur LiveKit, que le serveur peut voir. Le libellé reste « chiffré en transit, pas encore de bout en bout ».

LiveKit sait chiffrer de bout en bout (flux insérables sur le web, `RNE2EEManager` sur le téléphone, marqué expérimental). On ne l’active pas. Le coût : tous les appareils du groupe doivent savoir déchiffrer, sinon l’image est noire ; le chiffrement de chaque image coûte de la batterie ; VP9/AV1 et le secours H.264 deviennent plus fragiles ; Safari et les vieux téléphones décrochent. La qualité visée ici (720p, plusieurs couches, reprise rapide) passe avant. On pourra le rouvrir quand le groupe entier est sur des téléphones qui le supportent, et le libellé changera à ce moment-là seulement.

WhatsApp a des serveurs partout. Un seul serveur en Allemagne ou en Suisse ajoute du délai dès que les deux personnes ne sont pas dans le même pays. La qualité dans le même pays peut s’en approcher. Le délai intercontinental, non.

La sonnerie plein écran (CallKit et PushKit sur iPhone, ConnectionService et service de premier plan sur Android) et l’image flottante (picture-in-picture) ne sont pas dans le binaire actuel : elles demandent un build natif, que cette étape ne lance pas. Le client règle déjà le routage Bluetooth / haut-parleur avec le module audio déjà inclus. Au prochain build, il faudra ajouter ensemble le mode arrière-plan `voip` et CallKit : Apple refuse le mode `voip` sans sonnerie native. `calls.enabled` reste faux en attendant.

## App Store (quand un build sera fait, pas maintenant)

Les phrases caméra et micro sont déjà dans l’application, en français (texte par défaut) et en anglais (`locales/fr.json`, `locales/en.json`, `app.json`). Elles disent que l’image et la voix ne partent que si la personne ouvre elle-même la caméra ou le micro, vers le serveur d’appels, sans enregistrement.

Au prochain build, et pas avant : mode arrière-plan `audio` et `voip` **avec** CallKit et PushKit sur iPhone, et ConnectionService plus un service de premier plan (micro, caméra, lecture) sur Android. Le mode `voip` seul, sans CallKit, fait rejeter l’app. Ce build n’est pas lancé ici.

Déclaration chiffrement : l’application utilise le chiffrement standard du réseau (TLS, et le chiffrement de l’appel jusqu’au serveur). Le réglage « chiffrement non exempté » reste sur non. On ne déclare pas un chiffrement de bout en bout : le libellé reste « chiffré en transit, pas encore de bout en bout ».

Fiche confidentialité App Store : audio et vidéo liés à la fonction d’appel, non utilisés pour le suivi, non conservés après l’appel. La trace technique (heure, groupe) est décrite dans la politique de confidentialité.

## Rappel de sécurité

Caméra et micro éteints au départ. Chacun les ouvre. L’administrateur peut couper un micro, retirer une personne, ou terminer l’appel pour tout le monde. On peut signaler depuis l’appel. Rien n’est enregistré.
