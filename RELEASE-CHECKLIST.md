# Ce qu’il reste avant de publier 1.0.30

Rien ici n’est fait par le code. Ce sont des essais sur de vrais appareils et des pièces à poser dans App Store Connect ou Play Console. Ne pas fusionner, ne pas pousser `main`, ne pas changer les certificats ni le groupe d’apps.

La version marketing reste **1.0.30**. Les numéros de build viennent d’EAS (remote).

## iPhone et iPad

- Captures : iPhone 6,9 pouces (1320 × 2868 ou 1290 × 2796), 3 à 10 images. iPad 13 pouces (2064 × 2752 ou 2048 × 2732), 3 à 10 images. L’iPad est obligatoire parce que `supportsTablet` est vrai.
- Adhan téléphone verrouillé : programmer un rappel, verrouiller l’écran, attendre le créneau. Le son court déjà dans l’app doit partir. Déverrouiller : pas de deuxième lecture du même créneau. Couper le mode silencieux une fois, le laisser une fois.
- Reprise des données 1.0.29 : installer 1.0.30 par-dessus un TestFlight 1.0.29 qui a déjà un lieu, un compteur, des favoris et un achat Premium. Rien ne repart à zéro. Restaurer les achats depuis l’écran Premium. Exporter les données, puis les relire. Noter le résultat (captures avant / après).
- Compte démo pour la révision si la Communauté est visible. Contact révision (nom, téléphone, e-mail).

## Mac

- Pas un projet à part. C’est l’app iPad sur Mac Apple Silicon, même fiche `6773032754`, même achat Premium. Vérifier dans App Store Connect que « Disponible sur les Mac Apple Silicon » est coché.
- Ouvrir l’app sur un Mac Apple Silicon : horaires, Coran, compteur. Le Bluetooth de la bague et la boussole dépendent du Mac : le noter, sans le promettre.

## Apple Watch

Même fiche, app embarquée. Captures de la montre dans l’onglet Apple Watch. Les dix points de `docs/apple-watch.md` :

1. Icône, logo validé, fond sombre.
2. +1 au toucher et à la couronne, une vibration par pas (une rafale de plus de 3 pas ne vibre qu’une fois).
3. Vibration plus forte au 33 (ou à la cible), encore plus à l’objectif.
4. Zikr du jour et étape de la composition : arabe lisible, voyelles, aligné à droite.
5. Téléphone en anglais puis en français : les libellés suivent, le zikr reste en arabe.
6. Toujours allumé : le nombre et l’arabe restent, le texte d’aide disparaît, rien ne clignote.
7. Lien coupé, compter, rouvrir l’iPhone : le total augmente une fois, pas deux.
8. Compter sur l’iPhone : la montre suit, sans recompter ses propres taps.
9. Remise à zéro sur l’iPhone : l’affichage repart, les taps déjà faits ne sont pas comptés deux fois.
10. Complication sur un cadran : compte et part du jour, le toucher ouvre le compteur.

## Apple TV

- Même fiche `6773032754`, profil `production-tv`, pas une deuxième app. Captures tvOS à fournir dans cette fiche.
- Sur une vraie télé : accueil, Coran (liste et lecture, bouton Retour), Aqida, horaires, dhikr, discussion. Les boutons montrent leur texte. Menu revient en arrière. Le Coran et l’Aqida s’ouvrent sans achat.

## Android

- Compte Play Console pas ouvert. Pas de fiche, pas d’achat, pas de `.aab` public tant que ce compte n’existe pas.
- Quand il existera : captures téléphone, adhan sur un téléphone verrouillé, et la même preuve de reprise des données locales.

## Web

- `main` déploie la PWA. Ne pas y pousser pour cette passe. La page confidentialité 1.0.30 doit correspondre à `src/lib/privacy-policy.ts` (`npm run privacy:html`).
