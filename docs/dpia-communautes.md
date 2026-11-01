# Analyse d'impact (DPIA) — Communautés Zikru : projet

Projet du 30.10.2026, à relire avant publication. Cadre : nLPD suisse (art. 22) et RGPD (art. 35) pour les utilisateurs de l'UE. Une analyse d'impact se justifie ici parce que des mineurs sont concernés et que la pratique religieuse peut révéler des convictions religieuses (données sensibles, nLPD art. 5 let. c ; RGPD art. 9).

## 1. Description du traitement

| Élément | Contenu |
|---|---|
| Finalité | Pratiquer le dhikr à plusieurs (famille, cercle de proches), suivre des objectifs communs, s'encourager |
| Personnes concernées | Titulaires de compte, membres invités, enfants gérés par un parent |
| Données | E-mail (connexion), nom affiché par groupe, rôle, appartenance aux groupes, compteurs de dhikr partagés selon le mode choisi, encouragements (texte court, sans liens), sessions en direct, invitations (code haché), signalements (avec une copie du contenu), blocages, compteurs anti-abus, suspensions |
| Hébergement | Supabase (projet `wzcrghubbxelyxcspldk`) ; région : voir le tableau de bord |
| Accès | Membres du groupe concerné uniquement (RLS). L'équipe Zikru (rôle service) seulement pour la modération et le support |
| Pas de | Publicité, revente, profilage, découverte publique des groupes, géolocalisation |

## 2. Nécessité et proportionnalité

- Groupes sur invitation seulement, jamais listés publiquement ; 4 personnes par cercle en version gratuite.
- Partage des compteurs au choix de chacun : rien, participation, compteur.
- Encouragements limités en longueur, sans liens, avec une limite de débit.
- Conservation limitée, purge automatique chaque jour :

| Donnée | Durée (clé `retention.*`) |
|---|---|
| Encouragements | 365 jours |
| Sessions en direct terminées et leurs compteurs | 90 jours ; une session « en direct » est close d'office après 24 h |
| Invitations expirées ou révoquées | 30 jours |
| Signalements traités | 365 jours après traitement (ceux qui sont ouverts restent) |
| Compteurs anti-abus | 2 jours |
| Suspensions échues | 30 jours |
| Compte supprimé | Données du compte effacées en cascade ; dans les signalements, l'auteur est anonymisé |

## 3. Risques et mesures

| Risque | Gravité | Mesures en place |
|---|---|---|
| Contact d'un adulte malveillant avec un enfant | Élevée | Enfants seulement dans une famille, jamais dans un cercle ; messagerie enfant « Parents seulement » par défaut, « Aucun » bloque envoi et réception ; invités ↔ enfants interdits ; les parents voient les échanges de l'enfant ; signalement `child_safety` |
| Harcèlement, spam | Moyenne | Blocage réciproque côté serveur, signalement, filtre de termes, pas de liens, limites de débit, suspension |
| Accès non autorisé aux messages | Élevée | RLS par groupe, TLS, codes d'invitation hachés à durée et usages limités, essais de code limités. **Pas de chiffrement de bout en bout** : le serveur peut lire les messages (E2EE prévu, voir architecture §1.4) |
| Révélation des convictions religieuses | Moyenne | Aucune découverte publique, groupes sur invitation, nom affiché libre par groupe |
| Usurpation de nom dans un groupe | Faible | Noms uniques par cercle, nom en direct posé par le serveur |
| Conservation excessive | Faible | Durées ci-dessus, purge pg_cron `zikru-purge-expired` |
| Détournement de la modération | Faible | Copie figée lisible par l'équipe seulement ; la personne signalée ne voit rien |

## 4. Droits des personnes

Accès et export : section Compte. Effacement : suppression du compte. Rectification : changer son nom dans chaque groupe. Contact : mohamadalhabib@live.com (provisoire).

## 5. Points ouverts

- Durées de conservation à valider.
- Qui traite les signalements, et dans quel délai ; aucune alerte e-mail pour l'instant.
- Plafond pour les familles (aujourd'hui la limite familiale existante, pas le plafond de 4).
- Relecture de la liste des termes filtrés (fr/en/ar).
- Chiffrement de bout en bout : calendrier.
- Région d'hébergement et sous-traitants (Supabase, e-mail de connexion) à documenter dans la politique de confidentialité.
- Activer la protection contre les mots de passe divulgués dans Supabase Auth (alerte du conseiller de sécurité).

## 6. Mise à jour Passe 5 — discussion de groupe (01.11.2026, projet)

- **Nouvelle donnée** : texte des messages de groupe (cercles, familles), auteur, date, réponse citée. Finalité : échange entre proches. Pas de publicité, pas de revente, pas de profilage.
- **Sécurité** : chiffré en transit (TLS), stocké chez Supabase avec RLS ; **pas encore de bout en bout** (dit tel quel dans l'app).
- **Mineurs** : réglage parental par défaut « Parents », appliqué côté serveur ; liens refusés dans les familles ; invités sans accès aux messages des enfants.
- **Conservation** : 365 jours, puis effacement automatique ; suppression du compte → suppression de ses messages.
- **Modération** : signalement avec instantané, blocage, suppression pour tous tracée.
- **Point ouvert (juridique, Mohamed)** : la politique de confidentialité ne mentionne pas encore les messages de groupe ; à mettre à jour avant l'activation en production.

## 7. Mise à jour — appels de groupe v1 (01.11.2026, projet, non activé)

- **Nouveau flux** : son et image en temps réel, identifiant de compte, nom affiché et adresse IP transmis à **LiveKit Inc. (États-Unis, sous-traitant)**. Région des serveurs à choisir à la création du compte LiveKit (de préférence UE / Suisse) ; contrat de sous-traitance et clauses types à conclure avant l'activation.
- **Sécurité** : chiffré en transit (TLS / DTLS-SRTP), **pas encore de bout en bout** (libellé exact dans l'app). Jamais d'enregistrement (aucun droit `roomRecord`, aucun Egress), pas de partage d'écran, pas de données dans l'appel.
- **Données Zikru** : `private.call_joins` (personne, groupe, heure, vidéo oui/non) pour la limite de débit et le délai entre notifications ; effacé après 30 jours et avec le compte. Actions d'hôte (couper un micro, retirer) tracées dans `private.moderation_actions`.
- **Mineurs** : appels seulement dans la famille, mêmes paires que la discussion (réglage « Parents » / « Aucun », jamais un invité) ; jamais dans les cercles (règle serveur existante) ; vidéo seulement avec l'accord d'un parent (`allow_video_calls`, défaut non). Sans accord : le jeton n'autorise pas la caméra ; la réception de vidéo est coupée côté app (limite documentée).
- **Points ouverts** : faut-il redemander le consentement « compte » à l'ouverture des appels (nouveau sous-traitant) ? Date de mise à jour de la politique à fixer à la publication. Conditions de conservation des journaux LiveKit à vérifier dans son contrat.
