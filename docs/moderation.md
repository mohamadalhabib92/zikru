# Modération des communautés (familles et cercles)

État au 30.10.2026. Le traitement se fait à la main par l'équipe Zikru, dans le tableau de bord Supabase (éditeur SQL, rôle service). Aucune donnée de signalement n'est lisible par les autres membres.

## Ce que voit l'utilisateur

- **Signaler** : messages, membres, cercles, sessions en direct. Motifs : spam, harcèlement, haine, contenu sexuel, violence, danger pour soi (`self_harm`), usurpation, sécurité d'un enfant (`child_safety`), autre. Une précision libre (1000 caractères). L'app propose de bloquer l'auteur en même temps.
- Pour `self_harm` et `child_safety`, l'app affiche les numéros d'urgence (112, police 117, Pro Juventute 147 pour les jeunes en Suisse). Le signalement ne remplace pas un appel.
- **Bloquer** : réciproque et imposé par le serveur. Ni l'un ni l'autre ne peut écrire à l'autre, et les messages déjà échangés disparaissent des deux côtés. La personne bloquée n'est pas prévenue. Le blocage ne masque pas les compteurs des sessions en direct ni la liste des membres (limite connue).
- **Contact** : `moderation.contact_email` dans `app_config` (actuellement mohamadalhabib@live.com), affiché dans l'onglet Communautés et sur chaque cercle.

## File d'attente

```sql
-- Signalements ouverts, du plus ancien au plus récent (snapshot = copie figée du contenu au moment du signalement)
select * from private.moderation_queue;

-- Prendre en charge
update public.reports set status = 'reviewing' where id = '<report_id>';

-- Clore : 'actioned' (mesure prise) ou 'dismissed' (rien à faire)
update public.reports set status = 'actioned', resolution = 'message supprimé, avertissement', handled_at = now() where id = '<report_id>';
```

Les signalements en double (même personne, même cible, signalement encore ouvert) sont fusionnés. Limite : 20 signalements et 50 blocages par jour et par personne (`rate.report`, `rate.block`).

## Mesures possibles

```sql
-- Supprimer un message signalé
delete from public.encouragements where id = '<target_id>';

-- Suspendre un compte (ne peut plus écrire, créer, inviter, rejoindre ni lancer de session)
insert into private.user_suspensions (user_id, until, reason) values ('<user_id>', now() + interval '7 days', 'harcèlement — signalement <report_id>')
on conflict (user_id) do update set until = excluded.until, reason = excluded.reason;
-- Sans échéance : until = null. Lever : delete from private.user_suspensions where user_id = '<user_id>';

-- Retirer quelqu'un d'un cercle
delete from public.circle_members where circle_id = '<circle_id>' and user_id = '<user_id>';
```

Pour `child_safety` : conserver le snapshot, ne rien supprimer avant d'avoir décidé s'il faut le transmettre aux autorités (en Suisse : fedpol / police cantonale), puis suspendre le compte.

## Filtre de contenu de base

Il s'applique aux encouragements, aux noms (cercles, familles, membres) et aux titres de session. Le texte est normalisé : minuscules, accents latins retirés, espaces compactés. Un terme n'est reconnu que s'il forme un mot entier.

```sql
select * from private.blocked_terms order by lang, term;          -- liste de départ courte, à relire
insert into private.blocked_terms (term, lang, note) values ('exemple', 'fr', 'raison');
delete from private.blocked_terms where term = 'exemple';
update public.app_config set value = 'false' where key = 'filter.enabled';   -- couper le filtre
update public.app_config set value = '"minors"' where key = 'filter.links';  -- liens refusés seulement si un mineur est concerné ("all" | "minors" | "off")
```

## Réglages (`public.app_config`, sans publier l'app)

| Clé | Défaut | Rôle |
|---|---|---|
| `limits.free.max_group_members_created` | (absent → `plan_limits` = 4) | Personnes par cercle créé par un compte gratuit, créateur inclus |
| `max_group_members_hard` | 500 | Plafond technique absolu |
| `rate.message` / `rate.message_burst` | 30/h, 6/min | Encouragements |
| `rate.session_create` | 6/h | Sessions en direct |
| `rate.invite_create` / `rate.invite_attempt` | 20/h, 30/h | Invitations créées / essais de code |
| `live.max_rate` / `live.burst` | 15/s, 200 | Garde-fou du compteur en direct |
| `retention.*` | voir DPIA | Durées de conservation (purge quotidienne `zikru-purge-expired`, 03:15 UTC) |
| `moderation.contact_email` | mohamadalhabib@live.com | Contact affiché |

Format d'un débit : `{"max": n, "window_s": s}`.

## Ce qui manque

- Pas d'alerte e-mail à l'arrivée d'un signalement : il faut consulter la file régulièrement. Délai cible à fixer.
- Pas d'outil de modération dans l'app ; les fondateurs et modérateurs de cercle peuvent seulement retirer un membre.
