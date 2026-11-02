# Zikru v2 — analyse des écarts (spécification v2 + addendum « Five Star »)

Branche : `v2-ecarts`, créée depuis `programme-groupe` (branche la plus complète), avec fusion de `main` (7bc7cdf, politique LiveKit / serveurs UE).
Date : 2 novembre 2026. Aucune publication, aucun build EAS, aucune migration appliquée.

Légende : **FAIT** = déjà fait (preuve) · **PARTIEL** · **MANQUANT** · **NE PAS FAIRE** (raison) · **AJOUTÉ** = manquant/partiel, implémenté sur `v2-ecarts` (commit).

## §1 Core à préserver
| Exigence | Statut | Preuve |
|---|---|---|
| Onglets Accueil · Prières · Lire · Tasbih · Plus | FAIT | `src/app/(tabs)/{index,prayers,read,tasbih,more}.tsx` |
| Écrans existants (quran, kahf, dhikr, zikrs + OCR, tijani, duas, names, hadiths, fiqh, sahw, abjad, qibla, planner, habits, journey, songs, search, sources, validation, content-admin, bilal, ring, ble-diag, community, circle, family, live, join, privacy, settings, onboarding, auth, auth-callback, config, audit) | FAIT | `src/app/*`, `src/app/quran/*`, `src/app/zikrs/*`, `modules/zikru-ocr` |
| Compteur durable append-only, historique par séance | FAIT | `scripts/test-tasbih-log.mjs`, `test-tasbih-history.mjs` |
| Une seule source hégirienne | FAIT | `src/lib/hijri*`, `scripts/test-hijri.mjs` ; le nouveau calendrier réutilise cette source (078aef8) |
| Cibles ≥ 44 pt | FAIT | `src/ui/kit.tsx`, `docs/accessibility-pass6.md` |
| Workflow draft → in_review → approved, badge « Source à compléter » | FAIT | `content-admin.tsx`, `validation.tsx`, `scripts/test-sources.mjs` |
| Hadiths (provenance, grading), fiqh 4 écoles, sahw par école, Validation, Sources | FAIT | `scripts/verify-hadith`, `verify-fiqh`, `test-fiqh.mjs`, `sources.tsx` |
| Tijāniyya avec ouverture al-Fātiḥa, muqaṭṭaʿāt | FAIT | `tijani.tsx`, `test-fatiha.mjs`, `test-nuraniyya.mjs` |
| Bague : liste blanche, sauts > 10, anti-doublon, Simulation | FAIT | `scripts/test-ble.mjs`, `ble-diag.tsx` |
| Communautés : plafond serveur, parental, signalement, blocage, invitations hachées, rétention | FAIT | `supabase/migrations/20261027220000_*`, `20261030120000_moderation_retention.sql` |
| Consentements, météo arrondie, aucun géocodage tiers | FAIT | `src/lib/privacy.ts`, `scripts/test-privacy.mjs` |
| Langues FR/EN/AR + CI bloquante | FAIT | `scripts/test-i18n.mjs`, `i18n/required.txt` |
| DE | PARTIEL | `i18n/de/*` (β, ≥ 99 %), relecture humaine manquante |
| de-CH, Pulaar, Wolof | NE PAS FAIRE | traduction et validation par un locuteur natif nécessaires (règle §13) |
| Core sans API payante (402/529 non bloquants) | FAIT | `scripts/test-pass1.mjs`, Bilal isolé |
| Identité (couleurs, Amiri / Amiri Quran) | FAIT | `src/ui/theme.ts`, `assets/fonts` |

## §2 Design system
| Exigence | Statut | Preuve |
|---|---|---|
| Tokens centralisés, clair/sombre système | FAIT | `src/ui/theme.ts` |
| Contraste AA, or foncé pour le texte | FAIT | `docs/contraste-aa.md`, `scripts/test-contrast.mjs` |
| Taille arabe réglable 18–40 pt | AJOUTÉ | minimum passé de 20 à 18, maximum 52 conservé (42bb403) |
| Dynamic Type 200 % | PARTIEL | `docs/accessibility-pass6.md` ; pas de vérification sur appareil |
| Skeletons, empty states, erreurs « Réessayer » | FAIT / AJOUTÉ | `src/ui/ds.tsx` ; écran d'erreur traduit avec « Réessayer » (2ed9afd) |
| Haptique tasbih, « Réduire les animations » | FAIT | `(tabs)/tasbih.tsx`, `src/ui/ds.tsx` |
| Session de prière plein écran, mini-lecteur persistant | FAIT | `src/components/quran/AudioBar.tsx` |

## §3 Prières
| Exigence | Statut | Preuve |
|---|---|---|
| Méthodes MWL, UOIF, Umm al-Qura, ISNA, Égypte, Karachi, Diyanet ; madhab asr ; hautes latitudes ; ± minutes | FAIT | `src/lib/prayer.ts`, `src/components/PrayerOptions.tsx` |
| Méthode par défaut Suisse = `YOUR_DEFAULT_PRAYER_METHOD` | FAIT | `src/lib/app-placeholders.ts` (décision de Mohamed attendue) |
| « Vérifie avec ta mosquée » + horaires de la mosquée prioritaires | FAIT | `(tabs)/prayers.tsx`, `PrayerOptions.tsx` |
| Passé / actuel / prochain, compte à rebours, « prié » local | FAIT | `(tabs)/prayers.tsx` |
| Pré-alerte, replanification glissante (64), test 7 jours | FAIT | `scripts/test-notify.mjs` |
| Choix du son de l'adhan | PARTIEL | son système seulement ; des fichiers adhan nécessitent des droits audio (reporté) |
| Sourdine automatique au lieu de prière | NE PAS FAIRE | iOS ne permet pas à une app de couper la sonnerie |
| Mode dispense discret | FAIT | `settings.tsx`, `src/lib/goals.ts` |
| Qibla boussole, calibration, hors ligne | FAIT | `src/app/qibla.tsx` |
| Qibla carte + alerte d'interférence magnétique | MANQUANT | carte : tuiles hors ligne et licence à décider ; alerte : seuil à valider sur appareil |
| Hégirien Umm al-Qura + décalage ±1–2 j | FAIT | réglage du décalage existant |
| Événements (Ramadan, Aïd, Achoura, Mawlid selon l'école, jours blancs), lundi/jeudi | AJOUTÉ | `src/lib/hijri-events.ts`, `src/app/calendar.tsx`, tests (078aef8) ; Mawlid désactivé par défaut ; jeûnes badgés « Source à compléter » |

## §4 Coran
| Exigence | Statut | Preuve |
|---|---|---|
| Mushaf page par page + lecture par verset | FAIT | `quran/mushaf.tsx`, `quran/[n].tsx` |
| Traductions/tafsirs sous licence, `YOUR_QURAN_TRANSLATIONS_LICENSES` | FAIT | `src/lib/quran-licenses.ts` (licences à fournir par Mohamed) |
| Lecture continue, A-B ×N, vitesse, minuterie, hors ligne avec taille | FAIT | `AudioBar.tsx`, `src/lib/sleep-timer.ts`, `quran/downloads.tsx`, `test-recitation-queue.mjs`, `test-quran-pass3.mjs` |
| Surlignage verset | FAIT | `quran/[n].tsx` |
| Surlignage mot à mot | NE PAS FAIRE | aucune donnée de synchro mot à mot sous licence (condition de la spécification) |
| Signets étiquetés, dernière lecture, khatma 30 j / Ramadan / perso | FAIT | `quran/bookmarks.tsx`, `quran/khatma.tsx`, `test-khatma.mjs` |
| Hifz masquer, coup d'œil, SM-2 | FAIT | `quran/hifz*.tsx`, `test-srs.mjs` |
| Mutashabihat | NE PAS FAIRE | aucune donnée sourcée disponible |
| Détection IA de récitation | NE PAS FAIRE | Phase 3 |
| Recherche sans diacritiques + translittération + traduction, partage image | FAIT | `src/lib/quran-nav.ts`, `search.tsx`, `src/lib/verse-image.native.ts` |

## §5 Dhikr, tasbih, wird, du'as
| Exigence | Statut | Preuve |
|---|---|---|
| Tasbih (objectifs, enchaînement, historique, widget) | FAIT | `(tabs)/tasbih.tsx`, `widgets/` |
| Zikrs personnels : OCR local, rapprochement Tanzil, « non vérifié » | FAIT | `zikrs/import.tsx`, `test-quran-match.mjs`, `test-zikr.mjs` (texte OCR jamais modifié) |
| Adhkar matin/soir/après prière/coucher, sourcés, hors ligne | FAIT | `src/app/adhkar.tsx` |
| Tijāniyya wird/wazifa/haylala liés aux prières | FAIT | `tijani.tsx` ; validation par un muqaddam : `YOUR_SCHOLAR_VALIDATOR_NAME` (TODO Mohamed) |
| Kahf du vendredi avec rappel | FAIT | `kahf.tsx` |
| 99 noms, sens sourcé | FAIT | `names.tsx` |
| 99 noms, audio | MANQUANT | audio sous licence requis (reporté) |

## §6 Contenu sourcé et validation
| Exigence | Statut | Preuve |
|---|---|---|
| Champs source, grading, validatedBy, validatedAt, école ; badge jamais masqué | FAIT | `test-sources.mjs` |
| Validation : file in_review, fiche PDF/CSV, journal, rôle `scholar` côté serveur | FAIT | `validation.tsx`, `scripts/review-sheet.mjs`, migrations des rôles |
| 18 références des Sunan non gradées restent marquées | FAIT | `scripts/verify-hadith` |
| Sources & Méthodologie | FAIT | `sources.tsx` |
| Bilal : sources, refus des fatwas, consentement, quota, repli calme | FAIT | `supabase/functions/bilal`, `docs/bilal-setup.md` |

## §7 Habitudes
| Exigence | Statut | Preuve |
|---|---|---|
| Objectifs, série douce (2 jours de grâce), dispense neutre, aucun classement | FAIT | `src/lib/goals.ts`, `goals.tsx` |
| Jalons sobres, récapitulatif hebdomadaire privé | FAIT | `goals.tsx` |
| Planner et journey reliés | FAIT | `planner.tsx`, `journey.tsx` |

## §8 Widgets, notifications, raccourcis
| Exigence | Statut | Preuve |
|---|---|---|
| Widgets iOS/Android hors ligne (App Group) | FAIT | `widgets/ios`, `widgets/android`, `src/lib/widget-*.ts` |
| Live Activity Ramadan / prochaine prière | FAIT | `src/lib/widget-sync.ts`, `WidgetSettings.tsx` (à vérifier sur appareil après un build) |
| Raccourcis Siri + actions rapides | FAIT | `app-intents/`, `modules/zikru-quick-actions`, `src/lib/use-shortcuts*.ts` |
| Centre de notifications par type, heures calmes | FAIT | `src/components/NotifSettings.tsx` |
| Apple Watch | NE PAS FAIRE | Phase 3 |

## §9 Ramadan
| Exigence | Statut | Preuve |
|---|---|---|
| Activation auto + confirmation manuelle, suhur/iftar, du'a, 30 juz, tarawih, 10 nuits, zakat al-fitr (montant saisi), carte de partage | FAIT | `src/app/ramadan.tsx`, `src/components/ramadan/*`, `test-ramadan.mjs` |

## §10 Communautés
| Exigence | Statut | Preuve |
|---|---|---|
| Cercles, familles, live Realtime, encouragements, signalement, blocage | FAIT | `circle/`, `family/`, `live/`, migrations |
| Anti-spam/insultes serveur FR/EN/AR, limite de débit, nom affiché validé | FAIT | `20261030110000_messagerie_securite.sql`, `20261030120000_moderation_retention.sql` |
| « Messages : Aucun » via la RLS, purge selon la rétention | FAIT | migrations + tests PGlite |
| Libellé « chiffré en transit, pas encore de bout en bout » | FAIT | conservé à l'identique |
| E2EE | NE PAS FAIRE | Phase 3 |
| Appels de groupe | FAIT | `call.tsx`, `supabase/functions/call-token`, `docs/appels.md` (comportement inchangé) |

## §11 Bague
| Exigence | Statut | Preuve |
|---|---|---|
| RingService, ble-diag, appairage par identifiant, Simulation visible | FAIT | `ring.tsx`, `ble-diag.tsx`, `test-ble.mjs` ; le reste est en Phase 3 |

## §12 Sécurité et données
| Exigence | Statut | Preuve |
|---|---|---|
| Local-first, compte optionnel | FAIT | |
| Consentement exprès avant synchro (nLPD) | FAIT | `src/lib/privacy.ts` |
| RLS 100 %, rôles SECURITY DEFINER avec search_path, aucune service_role dans le bundle | FAIT | `supabase/migrations/*`, tests PGlite |
| Session PKCE sans course au démarrage | FAIT | `test-auth-link.mjs` |
| Edge functions : clés côté serveur, quota, journal sans contenu | FAIT | `supabase/functions/*` |
| Export JSON + suppression de compte + suppression locale | FAIT | `settings.tsx` (DataExportItem) |
| Export CSV | AJOUTÉ | historique du tasbih en CSV, avec garde anti-formule (7562db5) |
| Politique FR/EN/AR alignée | FAIT / AJOUTÉ | LiveKit, serveurs UE (03628f6) ; `POLICY_UPDATED` inchangé, nouveau consentement à décider |
| Tests SQL des policies | FAIT | tests PGlite existants (aucune nouvelle table dans v2-ecarts) |

## §13 Accessibilité, i18n, performance, résilience
| Exigence | Statut | Preuve |
|---|---|---|
| Annonce du tasbih tous les 10 | AJOUTÉ | `tasbihAnnouncement` dans `tasbih-core.ts`, test (db7ca40) |
| VoiceOver prières et Coran (`ar`) | FAIT | `docs/accessibility-pass6.md` |
| FR/EN/AR 100 % | FAIT | `test-i18n.mjs` (nouvel écran `calendar.tsx` couvert) |
| Chiffres arabes-indiens en option | MANQUANT | ne touche que l'affichage, mais concerne beaucoup d'écrans ; reporté pour éviter une régression |
| PWA ≤ 1,5 Mo | PARTIEL | ~2,69 Mo mesurés ; il faut un sous-ensemble des polices arabes et un découpage par route |
| Démarrage < 2 s, tasbih < 16 ms | PARTIEL | pas de mesure sur iPhone 12 dans ce dépôt |
| Hors ligne + contenus téléchargés listés avec taille et suppression | FAIT | `quran/downloads.tsx` |
| ErrorBoundary par onglet | AJOUTÉ | `TabErrorBoundary` sur les 5 onglets (2ed9afd) |
| Réessai réseau exponentiel | AJOUTÉ | `src/lib/net.ts` (Kahf, météo ; lectures seulement), tests (d53a52a) |
| Mode dégradé sans Supabase | FAIT | `config.tsx` |
| Lint sans erreur | PARTIEL | 45 erreurs (47 avant v2-ecarts), toutes antérieures : règles react-compiler et `import/namespace` sur `reminders.native.ts` ; refactor risqué, non fait |
| Tests unitaires + CI | FAIT | `npm test` vert |

## §14 Store
| Exigence | Statut | Preuve |
|---|---|---|
| Bundle conservé, `store/ios-metadata.md` | FAIT | inchangé |
| Captures 6,7"/6,1" FR/EN/AR | MANQUANT | nécessitent un build et un appareil ou simulateur |
| Permission strings FR/EN/AR | FAIT | `app.json`, `locales/` |
| UGC 1.2, 5.1.1 | FAIT | |
| Catégorie, classement d'âge | PARTIEL | TODO Mohamed |
| Aucune soumission | FAIT | |

## §15 Variables
| Exigence | Statut | Preuve |
|---|---|---|
| Placeholders YOUR_*, aucun EXPO_PUBLIC_EXAMPLE_* | FAIT | `src/lib/app-placeholders.ts`, `.env.example` ; `YOUR_SENTRY_DSN` ajouté en commentaire (2ed9afd) |

## Addendum « Five Star »
| Exigence | Statut | Preuve |
|---|---|---|
| 1. Error boundary global | FAIT | `AppErrorBoundary.tsx` |
| 1. Boundaries par onglet, écran d'erreur traduit | AJOUTÉ | 2ed9afd |
| 1. Aucun « Loading » infini (timeout + repli) | AJOUTÉ | message après 8 s, sans avancer sans les données (1df0e74) |
| 1. Sentry (`YOUR_SENTRY_DSN`, désactivé si absent) | PARTIEL | point d'accroche `src/lib/crash-report.ts` (console seulement, placeholder ignoré). Le SDK n'est pas installé : il faut d'abord adapter la politique et le consentement |
| 2. Listes virtualisées, aucun appel réseau bloquant au démarrage | FAIT | FlatList, chargement local d'abord |
| 2. Démarrage < 2 s | PARTIEL | non mesuré |
| 3. Onboarding ≤ 3 écrans | PARTIEL | 6 étapes (langue, madhab, lieu, notifications, BLE, fin) ; regroupement proposé mais non fait (changement UX à valider) |
| 3. Permissions au moment utile avec explication | FAIT | `onboarding.tsx`, `qibla.tsx` |
| 4. Design system, dark mode, skeletons | FAIT | §2 |
| 5. WCAG 2.2 AA | FAIT / PARTIEL | §2 et §13 |
| 6. FR puis DE, IT, EN ; formats suisses | PARTIEL | DE β ; IT manquant (traduction humaine nécessaire) |
| 7. nLPD, confidentialité, suppression, RLS, aucune clé secrète | FAIT | §12 |
| 7. CGU accessibles dans l'app | MANQUANT | texte juridique à fournir et valider ; aucun texte inventé |
| 8. Demande d'avis native, après réussite, 1×/90 j, jamais après une erreur | AJOUTÉ | `src/lib/review-policy.ts`, `review-store.ts`, tests (ecc755b) ; **nouveau build natif nécessaire** |
| 8. Lien support `YOUR_SUPPORT_EMAIL` | FAIT | `app-placeholders.ts` |
| 9. Store listing FR/DE/IT/EN | PARTIEL | FR/EN/AR dans `store/ios-metadata.md` ; DE/IT à faire relire |
| 10. Tests, typecheck, lint, checklist | FAIT / PARTIEL | tests et tsc verts ; lint, voir §13 |

## Totaux (lignes du tableau ; « FAIT / x » est compté en FAIT)
- FAIT : 85
- AJOUTÉ (sur v2-ecarts) : 9 lignes, plus 2 lignes FAIT / AJOUTÉ (écran d'erreur, politique LiveKit)
- PARTIEL : 12
- MANQUANT : 5 (qibla carte et interférence, audio des 99 noms, chiffres arabes-indiens, captures store, CGU)
- NE PAS FAIRE : 7

## Reporté, décision de Mohamed nécessaire
- Nouveau consentement après la mise à jour LiveKit (`POLICY_UPDATED` inchangé).
- SDK Sentry : impact sur la confidentialité et le consentement.
- Build natif pour `expo-store-review` (aucun build EAS lancé).
- CGU (texte juridique), traductions IT, relecture DE et relecture des chaînes AR de `i18n/ui-22-v2.tsv`.
- Droits audio : adhan, 99 noms.
- Validation savante :
  - références des jeûnes surérogatoires (lundi/jeudi, jours blancs, Achoura) ;
  - jours exclus des suggestions ;
  - Mawlid ;
  - nom du validateur.
- Licences des traductions du Coran, méthode de prière par défaut.
- PWA ≤ 1,5 Mo (sous-ensemble des polices).
- Onboarding en 3 écrans.
- Aucune migration ajoutée.
