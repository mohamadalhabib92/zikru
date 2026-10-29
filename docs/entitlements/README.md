# P1a — Droits gratuit / premium côté serveur (brouillon NON appliqué)

> Statut au 29.10.2026 : code de référence, testé hors production. Rien n'est appliqué à la base de
> production ni branché dans l'app. Aucun paiement n'est actif. Voir `../architecture.md` §7.

Décision : Zikru est gratuite. Les groupes gratuits ont 4 membres au maximum, créateur inclus. Cette
limite se change sur le serveur, sans publier l'app. Le premium (plus tard) ajoute des fonctions et
n'en retire aucune.

## Contenu

| Fichier | Rôle |
|---|---|
| `sql/20261029110000_p1a_droits.sql` | Tables `plans`, `plan_limits`, `app_config`, `user_entitlements` ; résolution des droits ; limite de membres appliquée par le déclencheur `circle_members_guard` (verrou du groupe, code `ZKG01`) ; `max_groups_created` (`ZKG02`) ; RPC `get_my_entitlements()`, `group_capacity()` ; `bilal_consume()` lit le quota du plan. À appliquer avant la migration P1. |
| `sql/tests/p1a_droits_test.sql` | 4e membre accepté, 5e refusé (`ZKG01`), hausse par `app_config` puis par `plan_limits`, priorité d'`app_config`, antériorité (baisse et fin de premium), premium manuel, droits storekit inertes tant que `payments_enabled` = false, quota Bilal, limite de groupes créés, cloisonnement. |
| `client/entitlements.ts` | Logique pure : lecture et validation de la réponse, cache par compte, défaut sûr, codes d'erreur. |
| `client/useEntitlements.ts` | Hook React Native : cache AsyncStorage, relecture au démarrage, au premier plan et après 6 h. |
| `client/__tests__/entitlements.test.ts` | Tests jest (6). |

Les tests SQL sont lancés par `../p1-groups/sql/tests/run-pglite.mjs` (voir `../p1-groups/README.md`).

## Règles

- Le serveur est seul juge. Le client n'affiche qu'une indication et ne code aucune limite en dur.
- Limite effective = surcharge `app_config` `limits.<plan>.<clé>` > `plan_limits` du plan > plan par défaut.
  La valeur JSON `null` signifie « illimité ».
- Le plan qui compte pour un groupe est celui de son propriétaire (fondateur actuel, sinon créateur), au moment de l'entrée.
- Antériorité : la limite n'est vérifiée qu'à l'entrée d'un nouveau membre ; on ne retire jamais personne.
- Paiements : les sources 'storekit' et 'play' sont ignorées tant que `app_config.payments_enabled` = false.
  Seuls 'manual' et 'promo' comptent. Le client ne peut ni écrire ses droits ni lire `app_config`.

## Modifier une limite en production (après application)

```sql
insert into public.app_config (key, value) values ('limits.free.max_group_members_created', '6')
  on conflict (key) do update set value = excluded.value;
```

Les clients voient la nouvelle valeur à leur prochaine lecture de `get_my_entitlements()`. Le serveur
l'applique immédiatement.
