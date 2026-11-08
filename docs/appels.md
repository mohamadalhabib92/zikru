# Appels de groupe v1 (audio / vidéo) — branche `appels`

État : **code prêt, rien d'activé**. Migration `20261102100000_appels.sql` **non appliquée**, Edge Function `call-token` **non déployée**, aucun secret posé, aucun compte LiveKit. Les builds actuels (dont le build 61) affichent « Bientôt disponible » et ne plantent pas.

## Choix v1 (validés par Mohamed)

- Appels audio et vidéo dans les familles et les cercles.
- Notification simple « appel en cours » (push Expo), **sans CallKit / VoIP** : pas de sonnerie plein écran.
- Mineurs : audio dans la famille ; vidéo seulement avec l'accord d'un parent ; jamais dans les cercles (règle serveur existante).
- Libellé exact : « chiffré en transit, pas encore de bout en bout ». Jamais d'enregistrement.

## Architecture

| Élément | Rôle |
|---|---|
| `supabase/migrations/20261102100000_appels.sql` | Réglages `app_config` (`calls.enabled` = false), `call_rights`, `call_join` (droits, paires, limite de débit ZKR01, journal), `call_moderate`, `call_push_recipients` (clé service seule), consentement vidéo `allow_video_calls`. |
| `supabase/functions/call-token/` | Vérifie le compte (jeton de la personne, jamais la clé service pour les droits), lit les présents dans la salle LiveKit, appelle `call_join`, signe un jeton LiveKit court (`calls.token_ttl_s`, 600 s), coupe un micro / retire une personne pour l'hôte. `livekit.ts` = noyau pur testé. |
| `src/lib/calls/` | `core.ts` (états d'écran, motifs), `api.ts` (RPC + fonction), `support.ts` (module natif présent ?). |
| `src/components/call/` + `src/app/call.tsx` | Écran d'appel chargé à la demande (seule route qui charge les SDK LiveKit / WebRTC). |
| `CallCard` (`src/components/community/parts.tsx`) | Carte dans l'écran famille / cercle. |
| Écran famille | Interrupteur parent « Vidéo pendant les appels de famille » pour chaque enfant ayant un compte (visible seulement quand les appels sont ouverts). |

Isolement : prière, Coran, dhikr, discussion, etc. n'importent rien des appels (`scripts/test-calls.mjs` le vérifie). Sans la migration, sans la fonction, ou sans module natif, la carte affiche « Bientôt disponible ».

## Règles côté serveur

- Seuls les membres du groupe ; compte suspendu → refus ; limite 30 entrées / heure / personne.
- À l'entrée, la base vérifie chaque paire avec les personnes déjà présentes (blocage dans les deux sens ; règles enfant / invité de la discussion). Course possible entre deux entrées simultanées : documentée, acceptée en v1.
- Jeton : micro toujours, caméra seulement si `calls.video` et (adulte ou accord parental). Jamais `roomAdmin`, jamais `roomRecord`, pas de données, pas de partage d'écran.
- Hôtes : fondateur / modérateurs d'un cercle, parents d'une famille. Modération uniquement via la fonction (tracée).
- Plafond : `calls.max_participants` (12). **Pas de plafond de durée en v1** : LiveKit renouvelle le jeton des personnes connectées ; le coût est tenu par le plafond de personnes, la limite de débit, l'interrupteur et les limites du projet LiveKit.

## Limites connues (v1)

- Un enfant sans accord vidéo ne publie pas de vidéo (garanti par le jeton) ; ne pas **recevoir** de vidéo est appliqué par l'app (abonnement manuel), pas par LiveKit.
- Bloquer quelqu'un pendant un appel : masqué et coupé immédiatement chez soi ; le serveur empêche ensuite la co-présence aux entrées suivantes.
- Pas de sonnerie native (CallKit / ConnectionService) : notification simple seulement.

## Activation (chaque étape demande l'accord explicite de Mohamed)

1. **Mohamed** crée le projet LiveKit Cloud (région UE de préférence), conclut le contrat de sous-traitance.
2. Secrets de la fonction (tableau de bord Supabase › Edge Functions › Secrets) : `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (exemples dans le code : `YOUR_LIVEKIT_URL`, `YOUR_LIVEKIT_API_KEY`, `YOUR_LIVEKIT_API_SECRET`) ; `EXPO_ACCESS_TOKEN` facultatif pour la notification.
3. Accord → appliquer la migration `20261102100000_appels.sql`.
4. Accord → déployer `call-token` (`supabase functions deploy call-token`).
5. Accord → build de développement (`EXPO_NO_CAPABILITY_SYNC=1`) : les plugins `@livekit/react-native-expo-plugin` et `@config-plugins/react-native-webrtc` ajoutent du code natif, micro et caméra. **Ne pas fusionner `appels` dans une version avant ce test.**
6. Tests sur deux appareils, puis `update public.app_config set value = 'true' where key = 'calls.enabled';` (et `calls.push` si voulu).
7. Mettre à jour la date de la politique de confidentialité et la publier ; décider s'il faut redemander le consentement (voir DPIA § 7).

## Tests

`npm test` (inclut `scripts/test-calls.mjs` et `supabase/tests/appels_test.sql`), `npm run typecheck`, `node scripts/test-i18n.mjs`.
