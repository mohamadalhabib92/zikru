# Zikru — Audit Phase 0

> Le code Vibecode d'origine n'était pas accessible depuis l'environnement de reconstruction : l'application a été **réécrite de zéro** à partir de la spécification. Cet audit liste les risques identifiés dans la spec / l'ancienne version et la façon dont la nouvelle base les traite.

| # | Problème | Correctif |
|---|----------|-----------|
| 1 | Date hégirienne incohérente selon les écrans (plusieurs conversions) | **Source unique** `src/lib/hijri.ts` (calendrier tabulaire civil, époque JDN 1948440) + décalage utilisateur ±2 j. 11 auto-tests (`npm test`) : limites 29/30 jours, années abondantes, passage d'année, aller-retour JDN, continuité 1440–1460 AH. |
| 2 | Boutons inactifs / cibles trop petites | Kit UI commun : hauteur ≥ 48 pt (44 pt pour les petits), `IconButton` 44×44, états `disabled` / `loading`, `accessibilityRole` + labels. |
| 3 | Erreurs 402 / API payantes sur le chemin principal | Aucun appel réseau requis : horaires via `adhan` (local), qibla calculée localement, contenu embarqué. Supabase optionnel derrière `YOUR_*`. |
| 4 | Compteur tasbih perdu à la fermeture | Écriture à chaque incrément (AsyncStorage / localStorage), sessions historisées. |
| 5 | Audio Bilal absent → crash | `AudioPlayer` affiche « fichier audio manquant » si aucune source ; lecture protégée par try/catch. |
| 6 | Bluetooth « simulé » présenté comme réel | Interface `RingService` + `MockRingService`, badge **Simulation** partout. |
| 7 | Traductions religieuses non validées | Workflow `draft → in_review → approved` ; seul `approved` est affiché ; traductions vides = « en attente de validation ». Contenus d'amorçage marqués **Exemple**. |
| 8 | Configuration manquante = écran blanc | Écran « Configuration manquante » explicite + `.env.example`. |
| 9 | RTL arabe | `direction: rtl` appliqué à la racine quand la langue est l'arabe ; textes arabes avec diacritiques. |

## Écarts connus (à traiter ensuite)
- MMKV non utilisé (nécessite un build natif, incompatible PWA) → AsyncStorage.
- Notifications d'adhan non implémentées (expo-notifications + build natif).
- Fichier audio d'adhan non fourni (droits à obtenir) → `EXPO_PUBLIC_ADHAN_AUDIO_URL`.
- Pulaar et Wolof : repli français en attendant des traductions validées.
- Synchronisation Supabase : schéma + RLS fournis (`supabase/schema.sql`), client de synchro à brancher après authentification.
- Horaires affichés dans le fuseau de l'appareil (une ville lointaine choisie manuellement s'affiche à l'heure locale de l'appareil).
