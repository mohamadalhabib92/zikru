# Accessibilité — passe 6 (01.11.2026)

Mesures faites sur la PWA (build web), Chrome 156, axe-core, routes principales en clair et en sombre. Les vérifications VoiceOver / TalkBack réelles sur téléphone **restent à faire** (pas d'appareil disponible ici).

| Point | Avant | Après |
|---|---|---|
| Interrupteurs / segments annonçant leur état (`aria-checked`) | absent sur 14 composants (tijani, prières, planner, connexion, kit Segmented/Toggle, habitudes, bien-être, onboarding, gratitude, réglages du lecteur, barre audio) | présent partout |
| Contraste AA texte (axe `color-contrast`) | échecs : vert wird clair, verts en sombre, compte à rebours du hero, boutons zikr, cartes du'as / fiqh | corrigé (`wirdGreen` clair #287048, sombre #45A86C, `green` sombre #2EAC7E, compte à rebours #E2C171, couleurs de texte des boutons calculées) |
| Interactif imbriqué (axe `nested-interactive`) dans la lecture du Coran | verset entier pressable contenant des boutons | le verset n'est plus un bouton ; pastille « Verset {n}. Actions » |
| Réduction des animations | ignorée par Skeleton, FadeIn, tasbih | respectée (`useReduceMotion` dans `ui/ds.tsx`) |
| Dynamic Type | tailles via le kit (`allowFontScaling` par défaut) | inchangé — à vérifier sur appareil à 200 % |

Reste signalé par axe : les boutons **désactivés** du tasbih (contraste faible). WCAG 1.4.3 exempte les composants inactifs ; conservé volontairement.

Restes connus : couleurs encore codées en dur dans quelques écrans anciens (voir `docs/contraste-aa.md`), pas de test VoiceOver réel, pas d'audit de l'ordre du focus clavier sur toutes les feuilles modales.
