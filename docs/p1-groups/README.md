# P1 — Groupes, compteur temps réel et dédoublonnage (brouillon NON appliqué)

> Statut au 29.10.2026 : code de référence, testé hors production. Rien ici n'est appliqué à la
> base Supabase de production ni branché dans l'app. Voir `../architecture.md` §7 (droits) et §9 (code).
> Prérequis : les correctifs P0 sont terminés et validés, et la migration P1a (`../entitlements/`)
> est appliquée juste avant celle-ci.

## Contenu

| Fichier | Rôle |
|---|---|
| `sql/20261029120000_p1_groupes_compteur.sql` | Migration : invitations hachées et expirantes, appareils, événements de compteur dédoublonnés `(device_id, seq, goal_id)`, ingestion par lots, limites de débit, diffusion Realtime privée, sessions planifiées, RLS, droits. |
| `sql/tests/00_supabase_stubs.sql` | Bouchons minimaux de Supabase (rôles, `auth.uid()`, schéma `realtime`) pour tester hors Supabase. |
| `sql/tests/p1_groupes_test.sql` | Tests SQL (ASSERT) : invitations, mineurs, détournement d'appareil, idempotence, cadence, confidentialité, RLS Realtime, départ, suppression de compte. |
| `sql/tests/run-pglite.mjs` | Pour chaque suite (P1, puis P1a), dans une base PGlite neuve (Postgres WASM) : stubs → migrations existantes → P1a → P1 → tests. |
| `client/counterQueue.ts` | Logique pure de la file hors-ligne (seq monotone, lots, accusés, fusion des totaux). |
| `client/useGroupCounter.ts` | Hook React Native : file persistée, envoi périodique / à la reconnexion, Realtime privé. |
| `client/useGroup.ts` | Hook React Native : groupe, membres, capacité (`group_capacity`, jamais une constante), invitations, rôles, partage, départ, sessions planifiées ; erreurs avec leur code (`GroupError`, `ZKG01` = groupe complet). |
| `client/__tests__/counterQueue.test.ts` | Tests jest (dont un test de propriété : pertes et renvois aléatoires ⇒ total exact). |

## Lancer les tests (hors du dépôt, rien n'est installé dans l'app)

```bash
mkdir -p /tmp/p1 && cd /tmp/p1
npm init -y >/dev/null
npm i @electric-sql/pglite jest ts-jest typescript @types/jest @jest/globals
cp /workspace/apps/zikru/docs/p1-groups/sql/tests/run-pglite.mjs .
ZIKRU=/workspace/apps/zikru P1_DIR=/workspace/apps/zikru/docs/p1-groups/sql node run-pglite.mjs
rm -rf client ent && cp -r /workspace/apps/zikru/docs/p1-groups/client client
cp -r /workspace/apps/zikru/docs/entitlements/client ent
npx jest --rootDir client -c client/jest.config.cjs
npx jest --rootDir ent -c ent/jest.config.cjs
```

Résultat au 29.10.2026 : suites SQL P1 et P1a vertes (PGlite) ; jest 11/11 + 6/6 verts ; `useGroup.ts`,
`useGroupCounter.ts` et `useEntitlements.ts` passent `tsc --strict` contre les dépendances de l'app (avec une
déclaration provisoire pour `expo-crypto`).

## Intégration plus tard (après revue, sur une branche)

1. Relire la migration, puis la copier dans `supabase/migrations/` et l'appliquer d'abord sur une
   branche Supabase / un projet de préproduction, jamais directement en production.
2. Lancer les advisors Supabase (sécurité + performance) après application.
3. `npx expo install expo-crypto` (dépendance manquante, utilisée pour l'UUID de l'appareil).
4. Copier `client/*.ts` dans `src/lib/groups/` et `../entitlements/client/*.ts` dans `src/lib/entitlements/` ;
   ajuster l'import `../supabase` si besoin.
5. Remplacer l'appel d'incrément actuel du compteur (chemin de synchronisation existant) par
   `recordTaps(...)` / `useGroupCounter(goalId).tap()`.
6. Appeler `flushAndResetOnSignOut()` avant la déconnexion.
7. Ajouter les tests jest au `npm test` de l'app.
8. Écrans existants à corriger (code de l'app, pas dans ce dossier) : `src/app/circle/[id].tsx` affiche
   `max_members ?? 50` et `src/lib/community/api.ts` traduit l'erreur « complet » en « 50 membres
   maximum ». Remplacer par `capacity` (`group_capacity`) et par `limitMessage(limitErrorFrom(error))`.

## Limites connues (honnêtes)

- Les comptes saisis à l'écran ne sont pas « prouvés » : le serveur borne la cadence et dédoublonne,
  il ne peut pas savoir si quelqu'un a vraiment récité. Seule la bague (P5) apporte une preuve
  matérielle des appuis, pas de la récitation.
- Les limites de débit SQL suffisent au lancement ; à forte charge, les déplacer vers une
  passerelle (Edge Function + stockage clé-valeur).
- Groupes gratuits : 4 membres, créateur inclus, réglables en base sans nouvelle version
  (`plan_limits` / `app_config`, voir `../entitlements/README.md`). Baisser la limite ne retire personne.
- La concurrence (deux entrées simultanées sur la dernière place) repose sur le verrou `for update`
  de la ligne du groupe ; PGlite n'ayant qu'une connexion, ce cas est raisonné, pas testé en parallèle.
