# P1 — Groupes, compteur temps réel et dédoublonnage (brouillon NON appliqué)

> Statut au 28.10.2026 : code de référence, testé hors production. Rien ici n'est appliqué à la
> base Supabase de production ni branché dans l'app. Voir `../architecture.md` §8.

## Contenu

| Fichier | Rôle |
|---|---|
| `sql/20261029120000_p1_groupes_compteur.sql` | Migration : invitations hachées et expirantes, appareils, événements de compteur dédoublonnés `(device_id, seq, goal_id)`, ingestion par lots, limites de débit, diffusion Realtime privée, sessions planifiées, RLS, droits. |
| `sql/tests/00_supabase_stubs.sql` | Bouchons minimaux de Supabase (rôles, `auth.uid()`, schéma `realtime`) pour tester hors Supabase. |
| `sql/tests/p1_groupes_test.sql` | Tests SQL (ASSERT) : invitations, mineurs, détournement d'appareil, idempotence, cadence, confidentialité, RLS Realtime, départ, suppression de compte. |
| `sql/tests/run-pglite.mjs` | Lance stubs → migrations existantes → migration P1 → tests dans PGlite (Postgres WASM). |
| `client/counterQueue.ts` | Logique pure de la file hors-ligne (seq monotone, lots, accusés, fusion des totaux). |
| `client/useGroupCounter.ts` | Hook React Native : file persistée, envoi périodique / à la reconnexion, Realtime privé. |
| `client/useGroup.ts` | Hook React Native : groupe, membres, invitations, rôles, partage, départ, sessions planifiées. |
| `client/__tests__/counterQueue.test.ts` | Tests jest (dont un test de propriété : pertes et renvois aléatoires ⇒ total exact). |

## Lancer les tests (hors du dépôt, rien n'est installé dans l'app)

```bash
mkdir -p /tmp/p1 && cd /tmp/p1
npm init -y >/dev/null
npm i @electric-sql/pglite jest ts-jest typescript @types/jest @jest/globals
cp /workspace/apps/zikru/docs/p1-groups/sql/tests/run-pglite.mjs .
ZIKRU=/workspace/apps/zikru P1_DIR=/workspace/apps/zikru/docs/p1-groups/sql node run-pglite.mjs
rm -rf client && cp -r /workspace/apps/zikru/docs/p1-groups/client client
npx jest --rootDir client -c client/jest.config.cjs
```

Résultat au 28.10.2026 : tests SQL tous verts (PGlite) ; jest 11/11 verts ; `useGroup.ts` et
`useGroupCounter.ts` passent `tsc --strict` contre les dépendances de l'app (avec une
déclaration provisoire pour `expo-crypto`).

## Intégration plus tard (après revue, sur une branche)

1. Relire la migration, puis la copier dans `supabase/migrations/` et l'appliquer d'abord sur une
   branche Supabase / un projet de préproduction, jamais directement en production.
2. Lancer les advisors Supabase (sécurité + performance) après application.
3. `npx expo install expo-crypto` (dépendance manquante, utilisée pour l'UUID de l'appareil).
4. Copier `client/*.ts` dans `src/lib/groups/` ; ajuster l'import `../supabase` si besoin.
5. Remplacer l'appel d'incrément actuel du compteur (chemin de synchronisation existant) par
   `recordTaps(...)` / `useGroupCounter(goalId).tap()`.
6. Appeler `flushAndResetOnSignOut()` avant la déconnexion.
7. Ajouter les tests jest au `npm test` de l'app.

## Limites connues (honnêtes)

- Les comptes saisis à l'écran ne sont pas « prouvés » : le serveur borne la cadence et dédoublonne,
  il ne peut pas savoir si quelqu'un a vraiment récité. Seule la bague (P5) apporte une preuve
  matérielle des appuis, pas de la récitation.
- Les limites de débit SQL suffisent au lancement ; à forte charge, les déplacer vers une
  passerelle (Edge Function + stockage clé-valeur).
- Le plafond de 50 membres par cercle reste celui de la base actuelle (question ouverte).
