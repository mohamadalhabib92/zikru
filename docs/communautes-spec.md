# Spec Communautés Zikru (Mohamed, 27.10.2026)
Cercles concentriques : 1 Famille (Usra), 2 Proches (Ahbab, ≤50), 3 Communauté locale (Halqa/Jama'a, 1 modérateur/100), 4 Réseau régional/thématique (orgs vérifiées), 5 Oumma mondiale (compteur agrégé anonyme, total + nb pays).
Famille : privé, invitation, rôles Parent admin (1-2)/Adulte/Enfant/Grand-parent invité ; comptes enfants gérés (contenu âge, pas de messagerie hors famille, contrôle parental temps/contacts/communautés) ; wird familial, objectifs communs, zikr du soir ensemble à distance (bague ou app), mode enfant doux sans comparaison, calendrier spirituel familial, encouragements privés sans compteurs publics ; multi-familles.
Proches : invitation ou lien limité, fondateur+modérateur, règlement accepté, objectifs, sessions live, messagerie chiffrée.
Locale : mosquée/zawiya/asso ; page avec horaires présentiel/distance ; rôles Fondateur, Guide (imam, muqaddim, enseignant), Modérateurs, Membres ; langues, mixité, âge min, visibilité privée/sur demande/publique.
Régionale : regroupe communautés, création orgs vérifiées, zikr collectif simultané agrégé.
Mondiale : Laylat al-Qadr, Mawlid, Achoura, du'a catastrophes ; organisé par Zikru/orgs vérifiées, modération renforcée.
Passerelles : famille rejoint en un geste (contribution au nom de la famille ou anonyme) ; session niveau supérieur suivie depuis niveau inférieur ; partage par cercle rien/participation/compteur ; accueil « Ma famille », « Mes cercles », « Mes communautés », « Événements ».
Sécurité : Famille découverte jamais/vérif aucune/messagerie chiffrée/mineurs gérés parent ; Proches jamais/aucune/entre adultes/mineurs si parent présent ; Locale optionnelle/recommandée/limitée guide↔membre/groupes jeunesse encadrés ; Régionale oui/obligatoire/non/événements encadrés ; Mondiale oui/obligatoire Zikru/non/participation anonyme.
Modèle : Family, FamilyMember, ParentalControl, Circle, Community, Network, GlobalEvent, CircleLink, SharingPreference, AggregatedCounter.

---

## Implémentation v1.0.15 — niveaux 1 Famille et 2 Proches (27.10.2026)

Backend : Supabase (projet `wzcrghubbxelyxcspldk`, eu-central-2). Migrations dans `supabase/migrations/2026102722*`.
Le client n'utilise que la clé publique (publishable) ; aucune clé service_role dans l'app.

### Tables (toutes avec RLS)
| Table | Contenu | Accès (RLS) |
|---|---|---|
| `profiles` | nom affiché, `is_minor` (créé par trigger à l'inscription) | soi-même ; nom visible par les membres d'une famille/d'un cercle commun — jamais un mineur hors de sa famille |
| `families` | nom, wird familial | membres ; modification par les parents |
| `family_members` | rôle `parent/adult/child/guest`, enfants gérés sans compte (`user_id` nul) | membres de la famille ; gestion par les parents ; un enfant ne peut pas quitter seul |
| `parental_controls` | messagerie `none/parents/family`, minutes/jour, niveau de contenu | parents (écriture), l'enfant concerné (lecture) |
| `circles` / `circle_members` | ≤ 50 membres, fondateur/modérateur/membre, règlement à accepter | membres uniquement ; adultes uniquement |
| `invitations` | code de 10 caractères, rôle, nb d'utilisations, expiration | créateur/admins ; aperçu et acceptation via RPC `preview_invitation` / `accept_invitation` |
| `shared_goals` / `goal_contributions` / `aggregated_counters` | objectifs communs, contributions idempotentes (`client_id`), totaux agrégés | membres du cercle/de la famille ; contributions masquées selon le partage |
| `zikr_sessions` / `zikr_session_counts` | zikr en direct (Realtime) | membres ; fin de session par le lanceur ou un responsable |
| `family_calendar_events` | calendrier spirituel | famille ; écriture par adultes |
| `encouragements` | messages privés | expéditeur, destinataire, parents d'un enfant ; restriction `messaging` appliquée |
| `sharing_preferences` | par cercle : `nothing/participation/count` | soi-même |

Fonctions `SECURITY DEFINER` uniquement dans le schéma `private` (non exposé) ; les RPC publiques sont des enveloppes `SECURITY INVOKER`. `anon` n'a aucun droit. Advisors sécurité : 0 alerte.

### App
- Connexion par code e-mail (OTP, sans mot de passe). Sign in with Apple : non activé (à faire plus tard : provider Apple dans Supabase + module natif).
- Communauté → « Ma famille », « Mes cercles », « Rejoindre avec un code », compte (nom, déconnexion, suppression du compte).
- Famille : membres et rôles, enfants gérés, contrôle parental, wird, objectifs, calendrier, zikr en direct, encouragements, mode enfant (grand bouton doux, aucune comparaison).
- Proches : membres, modérateurs, règlement, objectifs, invitations, zikr en direct, encouragements.
- Les dhikr du tasbih (écran, bague, compteur Bluetooth) alimentent les objectifs liés, en file hors-ligne, selon le partage choisi.
- Les « groupes locaux » sans compte restent disponibles hors-ligne.

### Écarts connus / à venir
- Mineurs : pas de cercles Proches en v1 (spec : « si parent présent ») — à ouvrir plus tard.
- Messagerie : chiffrée en transit (TLS) + RLS, pas de chiffrement de bout en bout.
- Limite de temps parentale : affichée à l'enfant, pas encore bloquante.
- Niveaux 3 Locale, 4 Régionale, 5 Oumma : les colonnes `scope_type` (`family`/`circle`, déjà `community`/`network`/`global` pour `aggregated_counters`) des objectifs, sessions, invitations et préférences sont prévues pour s'étendre à `community`/`network`/`global`.
