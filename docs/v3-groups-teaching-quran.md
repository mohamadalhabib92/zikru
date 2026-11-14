# Groupes, enseignement, Hafs, Warsh et tajwīd

Document pour Mohamed. Il décrit trois souhaits : que les membres d’un groupe de zikr puissent s’écrire, et s’ils le veulent se voir ; que certaines personnes puissent enseigner le Coran et le tajwīd ; que l’on puisse lire le Coran en riwaya Hafs et en riwaya Warsh, avec les règles de tajwīd en couleurs.

Décisions de Mohamed, le 10 novembre 2026 : la discussion de groupe sera appliquée par lui sur la base en ligne ; les appels audio et vidéo passeront par un LiveKit hébergé par lui en Europe (pas encore acheté) ; enseigner demande Premium et une validation Bissabi, jamais une case cochée ; les élèves paieront leurs enseignants et Zikru prendra 5 % ; Zikru voudra recevoir des dons pour des causes. Le texte Warsh et les couleurs de tajwīd attendent. Le serveur d’appels est dans `docs/livekit-server-setup.md`. Aucun paiement ni aucun don n’est branché.

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
6. Tranché : une classe peut accueillir des mineurs seulement si l’enseignant ouvre l’option, et un parent doit aussi l’autoriser. La vidéo mixte reste fermée tant que l’enseignant ne l’ouvre pas.
7. Tranché : enseigner exige Premium et la validation Bissabi. Rejoindre une classe reste gratuit.
8. Écrire au Complexe du Roi Fahd pour le texte Warsh et les couleurs, avant toute intégration.
9. Le chiffrement de bout en bout des messages (prévu plus tard, phase 3) et des appels : ne pas le promettre. Le libellé reste « chiffré en transit, pas encore de bout en bout ».
10. Tranché : la commission est 5 % (`teaching.commission_bps` = 500). Elle se calcule sur ce qui reste après la commission du magasin. Pour un cours Stripe, il n’y a pas de commission de magasin : 5 % du prix du cours. Les frais de traitement Stripe ne réduisent pas cette base. L’encaissement reste fermé (`teaching.payments_enabled` = faux).
11. Le prestataire : Stripe Connect en Suisse, formule « vous fixez les prix » (la commission est la vôtre ; Stripe facture 2 CHF par enseignant qui reçoit un virement dans le mois, plus 0,25 % + 0,55 CHF par virement), ou une autre formule. Confirmer que TWINT passe bien sur les comptes enseignants.
12. Le cours en tête-à-tête (paiement hors magasin) et le cours à plusieurs (achat intégré Apple et Google) sont deux prix. Les ouvrir ensemble, ou commencer par l’un des deux.
13. Quelles causes, et avec quelle fondation partenaire. Bissabi Drinks - BA, entreprise individuelle, ne peut pas être présentée comme une œuvre d’utilité publique.
14. Qui, fiduciaire ou avocat en Suisse, relit la TVA, la LBA et le fait de ne pas garder l’argent des élèves sur le compte de Bissabi.
15. Tranché : tout le monde dans un appel ou une leçon en direct doit avoir Premium, y compris les personnes invitées et les élèves. Rejoindre le groupe ou la classe, et la discussion écrite, restent gratuits.

## 6. Payer un enseignant, et donner

Décision du 10 novembre 2026 : l’élève paie l’enseignant, Zikru garde **5 %**, et Zikru veut pouvoir recevoir des dons. Rien n’est encaissé dans cette étape : pas de Stripe branché, pas de bouton donner. `teaching.payments_enabled` et `donations.enabled` restent faux. Le taux est posé : `teaching.commission_bps` = **500** (500 dix-millièmes = 5 %). L’interrupteur fermé empêche tout prélèvement, même avec ce taux.

La base du calcul est le montant reçu **après la commission du magasin** (Apple ou Google). Les frais de traitement Stripe ne sont pas une commission de magasin : sur un cours tête-à-tête, les 5 % portent sur le prix du cours.

Exemple, cours à **100 CHF**.

| | Cours à deux, Stripe | Cours à plusieurs, achat Apple (15 %) |
|---|---|---|
| Prix payé par l’élève | 100.00 | 100.00 |
| Commission du magasin | aucune | 15.00 |
| Montant sur lequel portent les 5 % | 100.00 | 85.00 |
| Commission Zikru | 5.00 | 4.25 |
| Reste pour l’enseignant, avant les frais de traitement Stripe | 95.00 | 80.75 |

Les frais de carte ou de virement Stripe se paient en plus de ce tableau. Ils ne font pas passer la base de 100 CHF à « 100 moins les frais Stripe ». Sur le cours Apple, la base est bien 85 CHF, pas 100.

Ce chapitre décrit le cadre. Ce n’est pas un avis d’avocat ni de fiduciaire. Avant d’encaisser, Mohamed fait relire le montage.

### Cours à deux, et cours à plusieurs

Apple, [consignes de revue](https://developer.apple.com/app-store/review/guidelines/), lues le 10 novembre 2026.

- **3.1.1.** Débloquer une fonction dans l’application se paie avec l’achat intégré.
- **3.1.3(d).** Un service en direct entre **deux** personnes (l’exemple donné par Apple est le cours particulier) peut se payer **autrement** que par l’achat intégré. Un service en direct « un vers quelques-uns » ou « un vers plusieurs » **doit** passer par l’achat intégré.
- Hors des exceptions, l’application ne doit pas pousser vers un autre paiement. Apple permet d’écrire aux gens **en dehors** de l’application.

Conséquence pour Zikru : une leçon en direct **un enseignant, un élève**, non enregistrée, peut passer par Stripe (carte, et TWINT si le compte enseignant l’accepte). Une classe où plusieurs élèves paient le même cours en direct doit passer par l’achat intégré sur iPhone. Le Premium déjà prévu reste un achat intégré : ce n’est pas le paiement de l’enseignant.

Décision du 10 novembre 2026, après coup : **l’élève aussi** doit avoir acheté Zikru Premium pour entrer dans l’appel ou la lecture. Sur un cours à deux payé par Stripe, l’élève paie donc deux fois. Une fois à Apple, l’achat à vie `ch.mohamadba.zikru.premium.lifetime`, pour avoir le droit d’ouvrir l’appel. Une fois à l’enseignant, via Stripe, pour le prix du cours. La règle 3.1.3(d) permet le paiement hors magasin pour le cours particulier. Elle ne dit pas qu’on peut ajouter cet achat intégré obligatoire par-dessus. Apple peut juger que l’accès à l’appel est déjà le service, et que Stripe n’est plus seulement le cours. Ce n’est pas un avis. Mohamed le fait relire avant le premier franc. Le tableau plus haut ne compte pas cet achat Premium : il reste en plus des 100 CHF.

La commission Apple, [programme petites entreprises](https://developer.apple.com/app-store/small-business-program/) : 15 % si les recettes App Store de l’année restent sous 1 million de dollars, sinon 30 %. Ce pourcentage sort du prix payé par l’élève **avant** de partager le reste entre Zikru et l’enseignant. Exemple sans choisir le taux de Zikru : sur 100 francs d’un cours à plusieurs, Apple peut garder 15 francs. Il reste 85 francs à répartir. Si la commission Zikru s’ajoute encore, l’enseignant reçoit moins. Il faut décider si le taux Zikru se calcule sur les 100 francs, ou sur les 85.

Google, [règle Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en) et [explications](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en), lues le même jour.

- Un cours en ligne **entre deux personnes**, qui n’est pas réécoutable ensuite, n’est pas obligé d’utiliser la facturation Google. L’exemple de Google est le cours de musique ou de loisir.
- Dès que ce n’est plus ce cas, la facturation Google est exigée, et l’application ne doit pas mener vers un autre paiement.
- [Frais de service](https://support.google.com/googleplay/android-developer/answer/112622?hl=en) : pour les pays pas encore dans la nouvelle grille (Australie, EEE, Japon, Royaume-Uni, États-Unis), la page indique 15 % sur le premier million de dollars de recettes de l’année, puis 30 %. La Suisse n’est pas dans la liste des pays déjà basculés. Le cours à plusieurs sur Android subit donc ces frais, du même ordre que chez Apple, tant que Google n’a pas étendu l’autre grille.

Le web (le site) n’a pas ces commissions de magasin. Un paiement commencé dans l’application iPhone pour un cours à plusieurs ne peut pas être renvoyé vers le site pour éviter Apple.

### Dons

Apple, mêmes consignes.

- **3.2.1(vi).** Une organisation **déjà approuvée** par Apple peut collecter dans l’application, avec Apple Pay, en disant à quoi sert l’argent et en pouvant remettre un reçu. Une plateforme qui liste plusieurs œuvres doit faire approuver **chacune**.
- **3.2.2(iv).** Sinon, on ne collecte pas dans l’application. L’application qui veut lever des fonds doit être **gratuite** sur l’App Store, et l’argent se donne **dehors**, par Safari ou par SMS.
- Hors des États-Unis, l’approbation Apple Pay pour dons passe par [Benevity](https://developer.apple.com/apple-pay/nonprofits/). Apple dit ne pas prendre de commission sur Apple Pay. Bissabi Drinks - BA n’est pas une organisation sans but lucratif : cette approbation ne lui est pas ouverte.

Zikru a déjà un achat Premium. La phrase d’Apple « l’application qui lève des fonds doit être gratuite » entre en tension avec cet achat. Tant que ce point n’est pas éclairci avec Apple, le don ne doit pas avoir de bouton dans l’application iPhone. Un lien qui ouvre Safari vers la page de la fondation partenaire est le seul geste envisagé, et encore seulement après relecture, parce que la règle parle d’une application gratuite.

Google, règle Payments, point 3 : la facturation Google **ne doit pas** servir aux dons exonérés d’impôt. Un pourboire peut rester hors facturation Google seulement si **100 %** va au destinataire et si le paiement n’ouvre aucun contenu. Une commission Zikru prélevée sur un don casserait cette condition. Dessin retenu : le montant annoncé arrive entier à la cause. Les frais du prestataire sont affichés à part. Zikru ne prend pas de commission sur le don tant que ce point n’est pas décidé autrement.

### Encaisser en Suisse, sans abonnement mensuel

Page officielle [Stripe Connect, Suisse](https://stripe.com/en-ch/connect/pricing), lue le 10 novembre 2026. Deux formules.

- **Stripe fixe les prix des enseignants.** La plateforme ne paie ni abonnement, ni frais de virement, ni frais de vérification. Stripe encaisse ses frais de paiement auprès de l’enseignant. La commission de Zikru n’est pas un taux que l’on pose librement : c’est un partage que Stripe accorde s’il l’accepte. Cette formule ne suffit pas seule pour un taux choisi par Mohamed.
- **Vous fixez les prix.** C’est celle qui permet une commission réglée dans `teaching.commission_bps`. Stripe facture alors **2 CHF par compte enseignant actif dans le mois** (un compte est actif s’il reçoit un virement) et **0,25 % + 0,55 CHF par virement**. Ce n’est pas un abonnement de la plateforme : s’il n’y a aucun virement, cette ligne est à zéro. Les frais de carte s’ajoutent. Stripe dit que, en paiement direct sur le compte de l’enseignant, les remboursements et les contestations sont à la charge de ce compte.

[TWINT chez Stripe](https://stripe.com/en-ch/payment-method/twint) : les clients en Suisse peuvent payer en francs, avec remboursement total ou partiel. La page ne dit pas que le versement séparé vers chaque enseignant est inclus. À faire confirmer par Stripe avant de promettre TWINT sur les cours. Sinon, [Payrexx](https://payrexx.com/en-ch/plattformen) sait partager un paiement suisse (TWINT compris) entre la plateforme et l’enseignant, mais ses offres plateforme sont des abonnements : ce n’est pas « zéro franc par mois ».

Vérification des enseignants (KYC), décrite par Stripe et résumée pour un particulier en Suisse : nom, date de naissance, adresse, téléphone, e-mail, site, compte bancaire. Tant qu’il manque une pièce, Stripe bloque les encaissements et les virements. Zikru ne stocke pas la pièce d’identité : l’enseignant la donne à Stripe.

Remboursement : l’élève annule avant le cours selon une règle écrite (à fixer). Le versement à l’enseignant attend la fin du délai, pour ne pas reverser puis courir après l’argent. Une contestation de carte reste possible après coup : le compte enseignant Stripe la porte, pas une caisse cachée dans l’application.

### TVA, et ne pas garder l’argent des autres

[Administration fédérale des contributions](https://www.estv.admin.ch/fr/assujettissement-a-la-tva), page lue le 10 novembre 2026. Une entreprise en Suisse devient en principe assujettie à la TVA si son chiffre d’affaires de prestations atteint **100 000 francs**. Les dons et les subventions, qui ne sont pas la contrepartie d’une prestation (art. 18 al. 2 LTVA, cités sur cette page), **ne comptent pas** dans ce seuil.

La commission est une prestation. Elle compte. Le prix du cours compte pour Zikru **si Zikru facture l’élève en son nom**. Il ne compte que pour la commission **si l’enseignant est le vendeur** et si Zikru ne fait que prélever son taux. C’est le dessin à viser avec Stripe : l’argent du cours va chez l’enseignant, la commission va chez Zikru. Un fiduciaire doit le confirmer, parce que le bon classement change le moment où la TVA devient obligatoire.

[FINMA, fiche crowdfunding](https://www.finma.ch/en/~/media/finma/dokumente/dokumentencenter/myfinma/faktenblaetter/faktenblatt-crowdfunding.pdf) : si une plateforme reçoit l’argent sur **ses** comptes et le garde, elle doit vérifier si une autorisation bancaire est nécessaire. La garder plus de 60 jours, ou dépasser 1 million de francs, change la réponse. Faire transiter des paiements à titre professionnel relève en principe de la loi contre le blanchiment : adhésion à un organisme d’autorégulation si aucune autre autorisation ne couvre déjà l’activité. Le dessin Stripe évite que le compte de Bissabi encaisse le prix du cours pour le reverser. Ce n’est pas une dispense écrite par la FINMA pour ce projet. À faire confirmer avant le premier franc.

### Bissabi Drinks - BA peut-elle recevoir les dons ?

Non, pas comme une œuvre. C’est une entreprise individuelle. Un versement reçu par elle est une recette de l’entreprise, ou un cadeau au titulaire. Ce n’est pas un don déductible pour la personne qui donne, et Apple ne l’approuvera pas comme organisation sans but lucratif.

Pour que le don soit clair, il faut une **fondation ou une association reconnue d’utilité publique**, partenaire, qui encaisse en son nom. Zikru affiche la cause, le lien, et le fait que le reçu fiscal vient de cette partenaire, pas de Bissabi. Le label [ZEWO](https://zewo.ch) n’est pas une loi, mais c’est le repère que les donneurs en Suisse connaissent. La liste des institutions exonérées se vérifie auprès du canton et de l’administration fédérale des contributions.

Tant que cette partenaire n’est pas choisie, `donations.enabled` reste faux. Aucun nom de cause n’est inventé ici.

## Annexe technique

Branche : `cursor/v3-groups-teaching-quran-5f31`, au-dessus de `cursor/premium-lifetime-iap-2f4e` (PR 10, elle-même au-dessus de la PR 9). Aucun texte Warsh, aucun secret, aucun encaissement.

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
- Paiements enseignants et dons, éteints : `supabase/migrations/20261110150000_paiements_config.sql`. `teaching.payments_enabled` et `donations.enabled` sont faux. `teaching.commission_bps` vaut 500 (5 % du montant reçu après la commission du magasin ; pour Stripe, 5 % du prix du cours). Non appliquée.
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
