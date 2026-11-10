# Groupes, enseignement, Hafs, Warsh et tajwīd

Document pour Mohamed. Il décrit trois souhaits : que les membres d’un groupe de zikr puissent s’écrire, et s’ils le veulent se voir ; que certaines personnes puissent enseigner le Coran et le tajwīd ; que l’on puisse lire le Coran en riwaya Hafs et en riwaya Warsh, avec les règles de tajwīd en couleurs.

Décisions de Mohamed, le 10 novembre 2026 : la discussion de groupe sera appliquée par lui sur la base en ligne ; les appels audio et vidéo passeront par un LiveKit hébergé par lui en Europe (pas encore acheté) ; enseigner demande Premium et une validation Bissabi, jamais une case cochée ; le texte Warsh et les couleurs de tajwīd attendent. Le détail du serveur est dans `docs/livekit-server-setup.md`.

Cette étape livrait d’abord le plan. Elle ne branche pas les appels tant que le serveur n’est pas là, et n’ajoute ni texte Warsh ni couleurs de tajwīd. La raison est dans les sections 2, 3 et 4 : les appels et l’enseignement attendent vos décisions, et les licences du Warsh et des couleurs ne sont pas assez claires pour les mettre dans l’application.

Rien n’est fusionné dans `main`. Aucune migration n’est appliquée au Supabase en ligne. Aucun build, aucune soumission aux magasins. Les zikrs, les compteurs et les objectifs déjà enregistrés ne sont pas touchés.

Le libellé exact de la messagerie et des appels reste : « chiffré en transit, pas encore de bout en bout ».

## Ce qui est déjà en place pour les groupes

Trois sortes de groupes existent.

- **Famille.** Le créateur est parent, donc administrateur. On entre par invitation, ou par une demande que l’administrateur accepte. Un enfant ne peut pas quitter seul.
- **Cercle de proches.** Le créateur est fondateur, donc administrateur. Même règle d’entrée. Les cercles sont réservés aux adultes. En gratuit, le plafond est de 4 personnes, créateur compris.
- **Groupe local.** Il reste sur le téléphone, sans compte. Il sert à noter un compteur après une séance. Il n’a pas de discussion.

Premium débloque seulement deux créations : un zikr personnel, et un groupe (famille, cercle, groupe local, programme). Rejoindre par invitation ou par demande acceptée reste gratuit, comme le Coran, les horaires, la qibla, l’adhan et le tasbih.

Composer le zikr du groupe, retirer un membre et supprimer le groupe sont réservés à l’administrateur (le parent, ou le fondateur). Un adulte ou un modérateur ne le fait plus. Cette règle est dans l’application et dans une migration locale qui n’est pas encore appliquée au serveur en ligne. Supprimer un groupe n’efface pas les compteurs des autres objectifs ni le profil.

Les compteurs de dhikr restent un sujet à part. La discussion, un futur appel ou une future leçon ne doivent pas les modifier.

## 1. Les membres peuvent s’écrire

### Ce qui existe

La discussion de groupe est écrite. Elle concerne une famille ou un cercle, pas le groupe local.

Chaque membre peut envoyer un texte (2 000 caractères au plus), répondre en citant, envoyer un message court déjà prévu (bravo, du‘ā, rappel, salām), et supprimer son message pour tout le monde. L’administrateur peut aussi effacer le message de quelqu’un d’autre. Les envois partis sans réseau repartent tout seuls. On peut mettre la discussion en sourdine et voir les messages non lus.

Tant que la migration n’est pas appliquée sur le serveur en ligne, la carte affiche « Bientôt disponible pour vos groupes ». Dès qu’elle l’est, la carte affiche le libellé « chiffré en transit, pas encore de bout en bout » et ouvre le fil.

Les enfants suivent le réglage parental, appliqué par le serveur :

- par défaut, **Parents** : l’enfant ne lit et n’écrit qu’avec ses parents ;
- **Famille** : toute la famille, jamais les invités ;
- **Aucune** : pas de discussion.

Un invité et un enfant ne se voient pas dans le fil.

### Ce qui manque pour que ce soit vraiment ouvert

Le code est prêt. Le serveur en ligne ne l’a pas encore reçu : la migration `20261101100000_passe5_discussion_groupe.sql` est marquée non appliquée, et elle attend votre accord. Sans elle, personne ne se parle dans l’application publiée.

Ensuite, et seulement ensuite, une seconde migration prévient les membres (« Nouveau message », sans le texte) et permet à l’équipe de traiter les signalements depuis un compte modérateur.

Il n’y a pas de photos, de notes vocales, de réactions, ni de modification d’un message déjà envoyé. Le groupe local, sans compte, ne peut pas avoir cette discussion : les paroles resteraient sur un seul téléphone.

### Signaler, bloquer, file de modération

C’est en place, pour la discussion comme pour les encouragements plus anciens.

- **Signaler.** Motifs : spam, harcèlement, haine, contenu sexuel, violence, danger pour soi, usurpation, sécurité d’un enfant, autre. Une copie du message est figée au moment du signalement. Pour le danger pour soi et la sécurité d’un enfant, l’application rappelle les numéros d’urgence (112, police 117, Pro Juventute 147). Le signalement ne remplace pas un appel.
- **Bloquer.** C’est réciproque et décidé par le serveur. Les deux personnes ne peuvent plus s’écrire, et les messages déjà échangés disparaissent des deux côtés. La personne bloquée n’est pas prévenue. Le blocage ne cache pas la liste des membres ni les compteurs des séances : limite connue.
- **File.** Les signalements ouverts se lisent dans `private.moderation_queue`, par l’équipe, pas par les autres membres. Les doublons sont fusionnés. Plafonds : 20 signalements et 50 blocages par jour et par personne. Un filtre de mots et de liens s’applique avant l’envoi. Un compte peut être suspendu.
- **Ce qui manque.** Personne n’est prévenu par e-mail à l’arrivée d’un signalement. Il faut ouvrir la file. Il n’y a pas d’écran de modération dans l’application : le fondateur peut retirer un membre et effacer un message, le traitement de fond se fait au tableau de bord.

Les messages sont gardés 365 jours, puis effacés. Ils voyagent chiffrés en transit (le cadenas du réseau). L’équipe technique peut encore les lire en base, et ne doit le faire que pour un signalement. Il n’y a pas de chiffrement de bout en bout. Le libellé reste « chiffré en transit, pas encore de bout en bout ».

## 2. S’entendre et se voir, seulement si on le veut

Les appels ne sont pas allumés. La carte dit « Bientôt disponible ». L’interrupteur `calls.enabled` est sur faux. La migration et la fonction qui délivre le jeton ne sont pas déployées. Aucun compte LiveKit n’est ouvert.

Le code déjà écrit prévoit ceci, et cette étape ne le change pas :

- on entre seulement si on est membre, non suspendu, et si aucune personne déjà dans l’appel n’est bloquée ;
- la caméra est éteinte au départ ; on coche « Avec la vidéo » pour l’allumer ;
- un mineur, dans la famille : audio selon le même réglage que la discussion ; vidéo seulement si un parent a donné l’accord (`allow_video_calls`, non par défaut) ;
- les cercles sont pour les adultes ; le code prévoit en plus un accord parental si un mineur s’y trouvait ;
- 12 personnes au plus, 30 entrées par heure, pas d’enregistrement, pas de partage d’écran ;
- l’hôte (parent, ou fondateur et modérateurs) peut couper un micro ou retirer quelqu’un ;
- pas de sonnerie plein écran (pas de CallKit) : une notification simple, elle aussi coupée par défaut.

Les textes d’autorisation caméra et micro sont déjà rédigés en français, anglais et arabe. Apple exige ces phrases. Il ne faut pas ajouter le mode « appel en arrière-plan » tant qu’il n’y a pas de CallKit : Apple refuse cette combinaison.

### Trois façons, sans nouvel abonnement

| Façon | Idée | Coût | Limite principale |
|---|---|---|---|
| Appel direct entre téléphones | Les téléphones se parlent entre eux. Supabase ne fait que sonner et échanger les adresses. Un service STUN public aide à se trouver. | 0 CHF de plus | Beaucoup de réseaux mobiles ne laissent pas passer l’appel sans un relais TURN. À 4 personnes ou plus, chaque téléphone envoie plusieurs flux : la vidéo de groupe ne tient pas. |
| Serveur d’appels que l’on héberge | Un petit serveur à nous reçoit chaque flux et le renvoie aux autres (c’est un SFU). LiveKit, déjà prévu dans l’application, existe en logiciel libre (Apache 2.0). Jitsi aussi. | Le prix du serveur, pas un abonnement à la minute | Il faut une machine, un relais TURN, et quelqu’un pour les mises à jour. |
| Jitsi public (meet.jit.si) | On envoie l’appel chez un service gratuit tenu par d’autres. | 0 CHF | Pas de contrat adapté aux mineurs, données chez un tiers, conditions qui changent. À écarter. |

Le relais TURN est le point dur. Derrière un partage de connexion ou un opérateur mobile, deux téléphones ne se voient souvent pas. Le relais fait passer le son par un serveur. Un STUN public (par exemple celui de Google) ne relaye rien : il aide seulement à se trouver. Un TURN fiable se paie en machine et en bande passante. Il n’existe pas de relais public durable pour une application avec des enfants.

Le chiffrement de bout en bout d’un appel de groupe est possible seulement dans de petites salles, et mal sur le site web. Avec un serveur au milieu, le son et l’image sont chiffrés jusqu’au serveur, qui peut les voir. On ne promet pas le bout en bout. Le libellé reste « chiffré en transit, pas encore de bout en bout ».

### Recommandation

Laisser les appels éteints tant que vous n’avez pas choisi.

Quand vous voudrez les ouvrir : **garder LiveKit, déjà écrit dans l’application, et le faire tourner sur un petit serveur à vous en Europe (Francfort, comme le texte de confidentialité), avec un relais TURN sur la même machine.** Ne pas prendre l’offre payante LiveKit Cloud. Ne pas reconstruire un second système pair-à-pair. Ne pas utiliser meet.jit.si.

Coût : un serveur, de l’ordre de 10 à 20 CHF par mois pour l’audio de petits cercles (4 personnes). La vidéo de plusieurs personnes fait monter la bande passante ; c’est le vrai risque de facture, pas un abonnement par siège. Si le budget doit rester à zéro franc de plus, les appels restent sur « Bientôt disponible ». Le pair-à-pair gratuit ne tient pas la promesse d’un appel de groupe.

Risques assumés si vous allumez cette option : le serveur voit le média (d’où le libellé) ; une panne du serveur coupe les appels ; il faut surveiller l’espace disque et ne jamais activer l’enregistrement ; un mineur ne doit pas pouvoir allumer la caméra sans un parent ; la course entre deux entrées simultanées est acceptée dans la version actuelle.

Cette étape n’allume rien et n’ajoute aucun service.

## 3. Enseigner le Coran et le tajwīd

Il n’y a pas de rôle enseignant. Les leçons de tajwīd déjà dans le module bien-être sont un aide-mémoire, marquées « à relire par un enseignant ». L’application n’écoute pas et ne corrige pas une récitation. Le rôle « Guide (imam, muqaddim, enseignant) » est décrit pour les communautés locales, qui ne sont pas construites.

### Comment on devient enseignant

Jamais en cochant une case. Le droit est écrit côté serveur, par l’équipe Zikru / Bissabi, de la même façon qu’une suspension aujourd’hui : une ligne ajoutée avec le rôle service, après vérification. Un fondateur de cercle, un modérateur, ou la personne elle-même, ne peut pas se l’accorder.

Avant d’écrire cette ligne, Bissabi vérifie l’identité, le lien avec l’enseignement (ijāza ou enseignant connu), et l’acceptation des règles. Le nom du valideur, la date et la version restent notés, comme pour les autres textes « à valider ».

### Ce qu’un enseignant pourrait faire

- Ouvrir une leçon pour un groupe dont il est responsable : un passage (sourate et versets), une consigne, un renvoi vers une récitation déjà proposée dans l’application.
- Donner une récitation à préparer. L’élève marque « fait ». L’application ne note pas la voix.
- Lancer une séance en direct, sur le modèle du zikr en direct déjà existant. Le compteur de cette séance ne se mélange pas aux objectifs de dhikr.
- La caméra d’une séance reste éteinte par défaut, avec les mêmes accords que les appels.

Il ne voit pas les compteurs privés. Il ne parle pas à un enfant en dehors des règles de la famille.

### Sécurité

- Un cours avec des mineurs n’est pas un cercle de proches. Les cercles sont adultes. Une classe avec des enfants a un parent ou un responsable nommé, et les règles familiales de messagerie s’appliquent.
- La mixité est un réglage du groupe, choisi à la création, pas une surprise en vidéo. Proposition : par défaut, pas de vidéo mixte ; l’administrateur l’ouvre explicitement, et un mineur reste soumis à l’accord d’un parent.
- Signaler et bloquer réutilisent la file déjà en place, avec le motif sécurité d’un enfant.
- Un enseignant se suspend comme n’importe quel compte.
- Un adulte peut quitter. Un enfant ne quitte pas seul une famille.

### Gratuit ou Premium

Décision du 10 novembre 2026 : enseigner demande Premium et la validation Bissabi. Rejoindre une classe reste gratuit.

Proposition laissée de côté : suivre un cours et enseigner ne sont pas des achats. Premium continue de réserver la création d’un zikr personnel et d’un groupe privé. Un enseignant validé par Bissabi reçoit le droit d’ouvrir une classe, sans acheter Premium, pour que l’enseignement ne soit pas vendu. Les élèves rejoignent gratuitement, comme aujourd’hui pour une invitation.

Ce rôle n’est pas construit dans cette étape : ce n’est pas un petit ajout, et plusieurs choix vous reviennent.

## 4. Hafs, Warsh, et les couleurs du tajwīd

### Ce que l’application affiche aujourd’hui

Le texte embarqué, hors ligne, est celui de **Hafs ‘an ‘Asim**, en deux formes, toutes deux de Tanzil, version 1.1, reproduites sans modification :

- écriture simple, pour la recherche ;
- écriture uthmane, pour la lecture, avec le découpage en juz’, hizb, quarts, pages du mushaf de Médine (604) et sajdas.

Deux récitants Warsh sont proposés en audio seulement (Ibrahim al-Dosary, Yassin al-Jaza’iri). Le texte à l’écran reste celui de Hafs. L’application le dit déjà. Les fichiers audio ne sont pas inclus : ils sont écoutés au moment de la lecture, et leurs droits restent aux récitateurs.

Les couleurs de tajwīd ne sont pas affichées. Le mushaf coloré reste masqué tant que la licence des annotations n’est pas confirmée (`YOUR_TAJWID_DATA_LICENSE`). Une leçon n’est colorée que si le texte annoté, une fois les marques retirées, est identique au texte Tanzil, lettre pour lettre. Le Coran n’est jamais réécrit.

### Ce que chaque licence permet

Vérifié le 10 novembre 2026, sur les pages citées.

**Tanzil — texte Hafs, déjà dans l’application.**  
Pages : [licence](https://tanzil.net/docs/text_license), [téléchargement](https://tanzil.net/download/).  
Le formulaire officiel propose seulement : Simple, Simple (Plain), Simple (Minimal), Simple (Clean), Uthmani, Uthmani (Minimal). Pas de Warsh. Uthmani est décrit comme le texte du mushaf de Médine. Version 1.1, février 2021.  
La notice dit : Creative Commons Attribution 3.0 ; copie et diffusion de copies conformes autorisées dans tout site ou application ; **changer le texte est interdit** ; citer Tanzil Project ; mettre un lien vers tanzil.net ; garder la notice dans les copies. L’application fait déjà cela. On ne modifie pas ce texte.

**Complexe du Roi Fahd (KFGQPC) — texte et police Warsh.**  
Le complexe annonce une plateforme développeurs et un paquet « ligne Warsh » (police, document Word signé du texte complet, fichiers JSON, SQL, etc.). L’annonce : [texte du complexe](https://qurancomplex.gov.sa/%D9%85%D8%AC%D9%85%D8%B9-%D8%A7%D9%84%D9%85%D9%84%D9%83-%D9%81%D9%87%D8%AF-%D9%84%D8%B7%D8%A8%D8%A7%D8%B9%D8%A9-%D8%A7%D9%84%D9%85%D8%B5%D8%AD%D9%81-%D8%A7%D9%84%D8%B4%D8%B1%D9%8A%D9%81-%D9%8A%D8%AA-2/). La page de téléchargement `qurancomplex.gov.sa/quran-dev/` répond 404 le jour de cette relecture.  
La licence lue dans les polices qui circulent est contradictoire : elle autorise l’usage, la copie et la diffusion à titre gratuit, et elle dit en même temps que la police ne peut pas être vendue, modifiée, ni reproduite, et que toute reproduction demande un accord écrit. Ce n’est pas une autorisation claire pour une application qui a un achat Premium.  
On n’embarque donc ni le texte Warsh ni la police.

**Quran Foundation (quran.com) — affichage, pas une copie dans l’application.**  
Conditions du 11 octobre 2026 : [Developer Terms](https://api-docs.quran.foundation/legal/developer-terms/).  
On peut afficher leur contenu dans l’application, y compris une application payante ou avec achat intégré. Le texte du Coran ne se modifie pas. On ne vend pas, on ne sous-licence pas et on ne redistribue pas les données brutes. Une copie hors ligne passe par leur « Content Sync », avec une synchronisation au plus tous les 7 jours, et cette voie n’autorise pas à livrer la base déjà emballée dans l’application. Le cache ordinaire est limité à une semaine. Il faut un compte développeur.  
Les scripts documentés de ce socle sont le uthmani, le uthmani tajwīd, l’indopak et l’imla’i. Pas un texte Warsh identifié. Les mettre dans le dépôt serait une redistribution, qui demande une licence commerciale à part. On ne le fait pas. Couleurs : [verset uthmani tajwīd](https://api-docs.quran.foundation/docs/content_apis_versioned/4.0.0/quran-verses-uthmani-tajweed/).

**alquran.cloud — édition colorée « quran-tajweed ».**  
Conditions mises à jour le 14 juin 2026 : [terms](https://alquran.cloud/terms-and-conditions).  
Le texte arabe, venu notamment de Tanzil, peut être reproduit, y compris dans une application payante, avec une citation. L’édition colorée vient de GlobalQuran, et ces conditions ne donnent pas de licence propre aux marques de couleur. L’application le note déjà et n’active pas ces couleurs.

**cpfair/quran-tajweed — fichier d’annotations.**  
Dépôt : [github.com/cpfair/quran-tajweed](https://github.com/cpfair/quran-tajweed). Le README dit Creative Commons Attribution 4.0 pour le fichier d’annotations, et les conditions Tanzil pour le texte. Il n’y a pas de fichier LICENSE à la racine. Le projet n’est plus maintenu. Les positions des couleurs visent une copie Tanzil d’avril 2017, et l’auteur écrit que le fichier Tanzil a changé depuis : utiliser un autre texte demande de tout recalculer, à ses risques. Les arbres de règles ont été bâtis à partir de ReciteQuran et des mushafs tajwīd de Dar al-Maarifah, dont les droits ne nous sont pas cédés. Poser ces index sur le Tanzil 1.1 actuel pourrait colorer les mauvaises lettres. On ne les embarque pas.

**QUL (Tarteel).**  
[FAQ](https://qul.tarteel.ai/faq) : usage commercial possible seulement ressource par ressource, certaines avec restrictions. Pas de licence unique pour le tajwīd QPC. Même réserve que pour le Complexe du Roi Fahd.

### Décision de cette étape

On n’ajoute pas de sélecteur Hafs / Warsh, et on n’ajoute pas d’interrupteur de couleurs. Il n’y a pas de source à la fois complète, vérifiable, et clairement autorisée pour mettre le texte Warsh ou les couleurs dans l’application sans le modifier. Le texte Hafs de Tanzil reste celui qui est affiché. Les récitants Warsh restent en audio, avec la phrase qui prévient que le texte à l’écran est celui de Hafs.

Pour débloquer le Warsh plus tard : un écrit du Complexe du Roi Fahd (info@qurancomplex.gov.sa) qui autorise, pour Zikru, la copie conforme du texte et de la police dans l’application gratuite et dans l’achat Premium, sans modification, avec la citation demandée. Avant cet écrit, on n’intègre pas le fichier.

Pour les couleurs, plus tard, deux portes propres : le même écrit du Complexe, ou le Content Sync de Quran Foundation sans jamais copier la base dans le dépôt, et seulement sur les versets identiques au Tanzil déjà embarqué. Les leçons écrites dans l’application restent « à relire » tant qu’un enseignant ne les a pas validées.

## 5. Décisions à prendre

1. Appliquer au serveur en ligne la migration de la discussion de groupe, puis celle des notifications. Tant que ce n’est pas fait, les membres ne se parlent pas dans l’application publiée.
2. Qui regarde la file `private.moderation_queue`, et dans quel délai, surtout pour « sécurité d’un enfant ».
3. Les appels : les laisser éteints, ou accepter un serveur en Europe (ordre de grandeur 10 à 20 CHF par mois pour l’audio) pour LiveKit auto-hébergé. Pas d’abonnement LiveKit Cloud.
4. Si les appels s’ouvrent : vidéo autorisée dans un cercle d’adultes, ou audio seulement au début. La caméra reste éteinte par défaut dans les deux cas.
5. Enseignant : qui à Bissabi valide, sur quelle preuve, et le nom affiché dans les crédits de validation.
6. Une classe peut-elle accueillir des mineurs, et la vidéo mixte est-elle fermée par défaut (proposition : oui, fermée).
7. Un enseignant validé peut-il ouvrir une classe sans acheter Premium (proposition : oui, une classe, l’enseignement n’est pas vendu).
8. Écrire au Complexe du Roi Fahd pour le texte Warsh et les couleurs, avant toute intégration.
9. Le chiffrement de bout en bout des messages (prévu plus tard, phase 3) et des appels : ne pas le promettre. Le libellé reste « chiffré en transit, pas encore de bout en bout ».

## Annexe technique

Branche : `cursor/v3-groups-teaching-quran-5f31`, au-dessus de `cursor/premium-lifetime-iap-2f4e` (PR 10, elle-même au-dessus de la PR 9). Aucun fichier de Coran, aucune migration, aucun secret ajoutés. Seul ce document est nouveau.

### Discussion

- Migration locale non appliquée : `supabase/migrations/20261101100000_passe5_discussion_groupe.sql` (`group_messages`, `post_group_message`, `group_chat_rights`, `delete_group_message`, signalement `group_message`, rétention 365 jours).
- Notifications et file côté modérateur : `supabase/migrations/20261101200000_passe6_moderation_push.sql`, après la passe 5. Fonction `push-group-message` non déployée. Le texte du message n’entre pas dans la notification.
- File historique : vue `private.moderation_queue` (`supabase/migrations/20261030120000_moderation_retention.sql`), mode d’emploi `docs/moderation.md`.
- Écran : `src/app/discussion.tsx`, `src/components/chat/discussion.tsx`. Carte : `DiscussionCard` dans `src/components/community/parts.tsx`. Tant que `group_unread` manque, la carte dit « Bientôt disponible ».
- Libellé exact dans la carte et en tête de `discussion.tsx` : « chiffré en transit, pas encore de bout en bout ».
- Règles enfant : `private.family_pair_ok`, défaut `parents`.
- Groupes locaux sans fil : `src/components/LocalGroups.tsx`.

### Administration et Premium

- Créateur administrateur, demandes d’entrée : `supabase/migrations/20261110130000_admin_groupe.sql` (`private.is_group_admin`, `group_join_requests`). Non appliquée.
- Premium : création de zikr personnel et de groupe seulement. Migration `supabase/migrations/20261110120000_premium_creation.sql`, verrou `premium_creation_gate` à `false`. Produit `ch.mohamadba.zikru.premium.lifetime`. Détail : `docs/premium-iap.md`.
- Les compteurs (`goal_contributions`, `zikr_session_counts`, tasbih) ne sont pas écrits par la discussion ni par les appels.

### Appels (non activés, non modifiés ici)

- `supabase/migrations/20261102100000_appels.sql`, `calls.enabled = false`, plafond 12, `allow_video_calls` défaut faux.
- Fonction `supabase/functions/call-token/` non déployée. Écran `src/components/call/call-screen.tsx` : `withVideo` et `cam` partent de faux.
- Média : DTLS-SRTP jusqu’au serveur LiveKit. Pas d’egress. Document `docs/appels.md`.
- Permissions déjà dans `app.json` et `locales/fr.json` (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`). Pas de mode VoIP.

### Coran

- Génération : `scripts/gen-quran-uthmani.mjs`. Texte : `src/lib/quran-uthmani.ts` (notice Tanzil conservée). Métadonnées : `src/lib/quran-meta.ts`.
- Crédits à l’écran : `src/app/sources.tsx`, `src/lib/quran-licenses.ts` (`QURAN_TEXT_SOURCE`, statut vérifié).
- Audio Warsh sans texte Warsh : `src/lib/recitation.ts`, phrase dans `src/components/quran/ReaderSettings.tsx`.
- Couleurs bloquées : `src/lib/tajwid.ts` (`tajwidColorsAllowed`), `src/lib/app-placeholders.ts` (`TAJWID_DATA_LICENSE = YOUR_TAJWID_DATA_LICENSE`).

### Licences (liens)

- Tanzil, notice et interdiction de modifier : https://tanzil.net/docs/text_license
- Tanzil, types téléchargeables (pas de Warsh) : https://tanzil.net/download/
- CC BY 3.0 : https://creativecommons.org/licenses/by/3.0/
- Annonce KFGQPC, plateforme développeurs : https://qurancomplex.gov.sa/%D9%85%D8%AC%D9%85%D8%B9-%D8%A7%D9%84%D9%85%D9%84%D9%83-%D9%81%D9%87%D8%AF-%D9%84%D8%B7%D8%A8%D8%A7%D8%B9%D8%A9-%D8%A7%D9%84%D9%85%D8%B5%D8%AD%D9%81-%D8%A7%D9%84%D8%B4%D8%B1%D9%8A%D9%81-%D9%8A%D8%AA-2/
- Quran Foundation, conditions développeurs (11 octobre 2026) : https://api-docs.quran.foundation/legal/developer-terms/
- Quran Foundation, texte uthmani tajwīd : https://api-docs.quran.foundation/docs/content_apis_versioned/4.0.0/quran-verses-uthmani-tajweed/
- alquran.cloud, conditions (14 juin 2026) : https://alquran.cloud/terms-and-conditions
- cpfair/quran-tajweed (CC BY 4.0 annoncé dans le README, index de 2017) : https://github.com/cpfair/quran-tajweed
- QUL, licence par ressource : https://qul.tarteel.ai/faq
