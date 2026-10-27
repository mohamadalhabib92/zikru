# Zikru — Prière · Qibla · Tasbih

Application de compagnon spirituel (Expo / React Native + PWA) : horaires de prière calculés **hors-ligne**, boussole de qibla, compteur de tasbih persistant, dhikr sourcés, calendrier hégirien unifié. Interface en français par défaut (EN, DE, DE-CH, AR ; Pulaar et Wolof en attente).

## Démarrer
```bash
npm install
npx expo start          # puis « w » pour le web, ou scanner le QR code avec Expo Go
npm test                # auto-tests du calendrier hégirien
npx tsc --noEmit        # vérification TypeScript
```

## Build web (PWA)
```bash
npm run build:web       # expo export -p web + service worker, 404.html, .nojekyll → dist/
```
L'app est servie sous `/zikru` (`experiments.baseUrl` dans `app.json`). Le workflow `.github/workflows/pages.yml` publie `dist/` sur GitHub Pages à chaque push sur `main` (activer *Settings → Pages → Source : GitHub Actions*). Installable sur iPhone (Safari → Partager → « Sur l'écran d'accueil ») et Android (Chrome → « Installer l'application »).

## Configuration (optionnelle)
Copier `.env.example` vers `.env` et remplacer les valeurs `YOUR_*` :

| Variable | Rôle |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Projet Supabase (synchronisation) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé publique anon Supabase |
| `EXPO_PUBLIC_ADHAN_AUDIO_URL` | Fichier audio d'adhan dont vous détenez les droits |

Sans ces valeurs, tout le cœur de l'app fonctionne en local et l'écran **Configuration manquante** l'indique clairement. Schéma SQL + RLS : `supabase/schema.sql`.

## Structure
- `src/lib/hijri.ts` — source unique de la date hégirienne (+ `scripts/test-hijri.mjs`)
- `src/lib/prayer.ts` — horaires (`adhan`), qibla, distance à la Kaaba
- `src/lib/content.ts` — contenus et workflow d'approbation
- `src/lib/ring.ts` — interface anneau BLE + simulation
- `src/app/` — écrans (expo-router)
- `docs/AUDIT.md` — audit Phase 0 et écarts connus

## Contenu
Les dhikr fournis sont des **exemples** marqués comme tels, à faire valider par un référent. Aucune traduction religieuse n'est générée par l'app.
