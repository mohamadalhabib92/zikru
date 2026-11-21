# Zikru — scorecard A+ → A++

Référence : Muslim Pro, Quran Pro, Athan Pro, Dudal, Quran Majeed, Tarteel.
Branche lue : `release/next` (TestFlight interne 1.0.30, le numéro de build reste celui d’EAS).
Documents déjà dans le dépôt : `docs/AUDIT.md`, `docs/accessibility-pass6.md`, `docs/contraste-aa.md`, `docs/platforms-plan.md`, `RELEASE.md`. Il n’y a pas de `docs/v2-gap-analysis.md`.

Notes sur 10. « Après » = ce que cette passe change, sans prétendre égaler les leaders sur les sujets qui attendent une décision.

| Axe | Avant | Après | Écart qui compte encore |
|---|---:|---:|---|
| Fiabilité | 8,3 | 8,7 | Pas d’essai réel sur iPhone (crash, GPS, adhan au verrouillage). |
| Démarrage | 7,2 | 8,4 | Le premier écran n’attend plus la police arabe. Reste à mesurer sur un téléphone froid. |
| Hors ligne | 8,6 | 8,8 | Horaires, qibla, Coran embarqué. La météo et l’adhan complet restent en ligne, avec un message et un nouvel essai. |
| Accessibilité | 8,0 | 8,4 | Contraste déjà mesuré. VoiceOver réel et Dynamic Type à 200 % sur appareil : pas faits ici. |
| Langues FR / EN / AR / DE / IT | 7,8 | 8,2 | FR, EN, AR solides. Allemand présent, marqué non relu. Italien : catalogue écrit, pas branché. |
| Premier lancement | 8,2 | 8,5 | Le refus de position explique maintenant quoi faire. |
| Thème Verre | 8,3 | 8,6 | Boutons, pastilles actives et segments ont le même relief. Quelques écrans anciens gardent des boutons plats. |
| Rappels / adhan | 8,4 | 8,7 | Plan local ≤ 64, son court embarqué. Un échec de lecture peut être retenté. L’alarme exacte Android et le web fermé restent fragiles. |
| Confidentialité | 9,0 | 9,0 | Position arrondie, consentement météo, rien de nouveau envoyé. |
| Montre et télé | 7,0 | 7,0 | Le code est là. La parité « comme le téléphone » est un choix de produit, pas un polissage. |

Moyenne avant : **8,1**. Après cette passe : **8,4**. Le cran A++ (au niveau des leaders sur l’adhan fiable téléphone éteint, la récitation suivie à la voix, et l’arabe relu) n’est pas un polissage : il est dans la liste « décision » plus bas.

## Ce qui a été poli ici

Chaque point est un **safe polish** : pas de nouvelle fonction payante, pas de changement du fond religieux, pas de clé de stockage renommée.

1. **Démarrage** — safe polish. — l’app ne reste plus blanche jusqu’à 8 secondes en attendant Amiri. La police arabe arrive ensuite ; en attendant, c’est la police du téléphone. Pendant le chargement de la langue, on voit « Zikru » et « Chargement », annoncé aux lecteurs d’écran.
2. **Lieu illisible** — des coordonnées cassées (stockage abîmé) ne ferment plus l’app. Les horaires retombent sur Lausanne, marqué exemple. La clé de réglages n’est pas réécrite.
3. **Position** — refus et absence de signal ne sont plus le même message muet. Le bouton s’arrête au bout de 12 secondes. La ville déjà choisie reste.
4. **Adhan** — si la voix n’est pas prête, ou si le fichier / le réseau échoue, le créneau de 20 secondes n’est plus brûlé : on peut réessayer. Deux ouvertures de la même notification ne lancent toujours pas deux lectures.
5. **Nombres et dates** — les totaux (qibla, tasbih, parcours, groupes) suivent la langue. L’arabe garde les chiffres 0–9, comme les horaires. L’historique du tasbih ne découpe plus une date suisse.
6. **Boussole** — Ouest = O en français et en italien, W en anglais, Ost/West en allemand. La phrase « tournez » est lue par VoiceOver et se met à jour.
7. **Horaires** — chaque case du jour a un libellé (nom, heure, état). Les grands titres grandissent avec Dynamic Type jusqu’à environ 200 %, puis passent à la ligne au lieu de se chevaucher.
8. **Erreur** — l’écran « Zikru a rencontré une erreur » est traduit (FR / EN / AR / DE), annoncé comme alerte, avec un bouton « Réessayer » assez grand.
9. **Arabe (RTL)** — le chevron des listes et de l’accueil pointe vers le bord de lecture.
10. **Verre** — les pastilles choisies et les segments choisis ont le même relief que les boutons. Tous les boutons (pas seulement le thème Verre) ont un léger retour haptique sur iPhone.
11. **Météo** — hors ligne, on peut retenter sans quitter l’accueil. Rien n’est demandé sans le consentement déjà en place.

## Décisions pour Mohamed (pas faites ici)

Classées par l’effet sur la comparaison avec les leaders. Une ligne chacune.

1. **Adhan téléphone verrouillé** — mesurer sur un iPhone si le son court suffit, puis seulement décider d’une alarme exacte Android (formulaire Google) et d’un son plus long. *needs Mohamed's decision*
2. **Brancher l’italien (et les autres langues β déjà écrites)** — les fichiers existent, marqués « à relire », mais l’app retombe encore souvent sur le français. Les afficher changerait l’interface vue par qui choisit Italiano. *needs Mohamed's decision*
3. **Récitation suivie à la voix (type Tarteel)** — nouvelle fonction, donc Premium si on la fait ; le contenu audio et le modèle restent à choisir. *needs Mohamed's decision*
4. **Relecture humaine DE + IT, et des textes marqués « à vérifier »** — ne pas les présenter comme relus. Le fond religieux ne se corrige pas dans une passe technique. *needs Mohamed's decision*
5. **Passe VoiceOver / Dynamic Type sur un iPhone à 200 %** — le code est préparé ; seul l’appareil tranche les cas qui restent (ordre de lecture du Coran, mushaf). *needs Mohamed's decision*
6. **Widgets et écran verrouillé au niveau d’Athan Pro** — le pont existe ; le dessin et les complications montre sont un produit. *needs Mohamed's decision*
7. **Un seul Premium vérifié sur le serveur** (reçu Apple, Play, Stripe web) — aujourd’hui le droit vit surtout sur l’appareil. Touche l’argent et les règles Apple. *needs Mohamed's decision*
8. **Apple TV et montre : jusqu’où aller** — compteur montre et discussion restent gratuits. Étendre l’écoute, la qibla ou les groupes sur la télé est un nouveau périmètre. *needs Mohamed's decision*
9. **Page vitrine du site** — `main` publie la PWA. Une page d’accueil marketing est un contenu, pas un correctif, et ne doit pas lier l’app iPhone vers un prix web. *needs Mohamed's decision*
10. **Heure de la mosquée saisie par l’utilisateur** — déjà possible. Annoncer « horaire officiel de telle mosquée » demanderait une source et un responsable. *needs Mohamed's decision*
