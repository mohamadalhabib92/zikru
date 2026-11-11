# Apple Watch

Ce texte est pour Mohamed. Il dit ce qui a été ajouté, ce qu’il doit faire avant une publication, et ce qui n’a pas pu être vérifié ici.

Rien dans cette étape n’a lancé un build EAS, une soumission, ni une installation sur une montre.

## Ce que c’est

Une app montre native, en SwiftUI, embarquée dans l’app iPhone. Elle n’est pas une deuxième fiche App Store. Elle part avec Zikru quand on installe l’iPhone, sur la montre appairée.

Le compteur est le cœur de l’app. Il est gratuit. Aucun écran de la montre, ni la synchro, ne consulte Premium.

Sur la montre :

- on touche l’écran, ou on tourne la Digital Crown vers l’avant, pour compter (la couronne en arrière ne retire rien) ;
- chaque appui vibre (un clic) ; un tour (33, 99, 100, ou la cible du zikr si elle est plus courte ; 33 si la cible est plus longue) vibre plus fort ; l’objectif vibre encore plus fort ;
- on choisit les zikrs du jour (le contenu approuvé du téléphone) ou la composition courante ;
- sans iPhone à portée, le compte reste sur la montre ;
- au retour du lien, les comptes partent dans les deux sens ;
- une complication (WidgetKit) montre la progression du jour ; la toucher ouvre le compteur.

Le fond est `#181818`, l’accent est la crème `#F7F4EE`. L’icône est le logo déjà validé (`assets/icon.png`). L’arabe vocalisé est grand et de droite à gauche. Les boutons suivent la langue du téléphone : anglais si la langue est l’anglais, français sinon (y compris si le téléphone est en arabe).

## Identifiants

L’app iPhone reste `com.vibecode.zikru-76mpdv` (dans `app.json`).

| Cible | Identifiant |
|---|---|
| App montre | `com.vibecode.zikru-76mpdv.watchkitapp` |
| Complication | `com.vibecode.zikru-76mpdv.watchkitapp.widget` |
| Groupe partagé montre ↔ complication | `group.com.vibecode.zikru-76mpdv.watch` |

L’équipe de signature est `Y9XF9RY2BU`, la même que la soumission déjà notée dans `eas.json`. Le plugin la pose sur la config iOS s’il n’y en a pas déjà une.

`eas.json` n’a pas été modifié. Les profils restent en identifiants gérés par EAS (c’est le défaut : on n’a pas mis `credentialsSource: local`).

## Comment c’est branché

- `@bacons/apple-targets` (dossier `targets/`) ajoute la cible montre et la complication au projet Xcode au moment du prebuild. EAS rebuild le natif à chaque build : on ne versionne pas `ios/`.
- Le plugin déclare les deux cibles dans la config que EAS lit avant le build : `extra.eas.build.experimental.ios.appExtensions`. On l’a vérifié avec `npx expo config` : les deux identifiants et le groupe d’apps y sont.
- L’iPhone parle à la montre par un petit module local, `modules/zikru-watch` (WatchConnectivity). Le JavaScript est dans `src/lib/use-watch-sync.ts`. Il envoie la liste et reçoit les séances. Sur Android et sur le web, ce pont n’existe pas : l’app ne change pas.
- La fusion des comptes est dans `src/lib/watch-sync.ts`. Elle est testée par `scripts/test-watch-merge.mjs`. Une séance a un identifiant stable et un total (pas un delta). La relire ne compte pas une deuxième fois. Un total plus petit, arrivé en retard, ne retire rien. Les appuis faits sur le téléphone ne sont pas réappliqués quand la montre les renvoie.

## Ce que Mohamed doit faire

### 1. Laisser EAS créer les profils

App Store Connect n’a pas besoin d’une nouvelle fiche. L’app montre est embarquée dans la fiche iOS déjà là (`ascAppId` `6773032754`). Ce n’est pas une app « watch only » : celle-là, elle, aurait sa propre fiche. Ici le binaire iPhone contient la montre (`WKCompanionAppBundleIdentifier` pointe vers `com.vibecode.zikru-76mpdv`).

En revanche, la signature, oui, a besoin de neuf. Chaque cible a son propre profil de provisionnement. La doc Expo « iOS App Extensions » le dit : EAS ne peut préparer les certificats qu’en connaissant les cibles avant le build. C’est le rôle de la liste `appExtensions` que le plugin remplit.

Au prochain `eas build -p ios` (profil `preview` ou `production`, compte Apple de l’équipe `Y9XF9RY2BU`) :

1. Garder les identifiants gérés par EAS. Ne pas passer `credentialsSource` à `local` d’avance.
2. Si EAS demande de se connecter à Apple, c’est pour créer les App ID `…watchkitapp` et `…watchkitapp.widget`, le groupe `group.com.vibecode.zikru-76mpdv.watch`, et un profil pour chaque cible. Accepter.
3. Si le build s’arrête parce que le groupe d’apps n’existe pas : le créer dans Certificates, Identifiers & Profiles (App Groups), puis relancer le build pour que EAS reprenne les profils.

Il est déjà arrivé que EAS ne signe pas une cible montre tout seul (discussion eas-cli nº 2578, 2024 ; en 2025 certains projets repassaient). Si la signature de `ZikruWatch` échoue encore après ça, le repli est un `credentials.json` local, une entrée par cible, comme dans la doc Expo « Using local credentials » (projet à plusieurs cibles). On n’a pas préparé ce fichier : les secrets ne vont pas dans le dépôt.

### 2. Essayer sur une vraie montre

Cette machine est un Linux sans Xcode. Le Swift n’a pas été compilé. Un `tsc` vert et les tests JavaScript verts ne veulent pas dire que la montre se lance. Il faut un build EAS, un iPhone appairé, et une Apple Watch.

À vérifier, dans cet ordre :

1. L’icône sur la montre est le logo validé, fond sombre.
2. Toucher compte +1, la couronne vers l’avant aussi, avec une vibration à chaque pas (une rafale de couronne de plus de 3 pas ne vibre qu’une fois, pour la batterie).
3. Au 33 (ou à la cible du zikr) la vibration est plus forte ; à l’objectif, encore plus.
4. Choisir un zikr du jour, puis une étape de la composition courante. L’arabe est lisible, avec les voyelles, aligné à droite.
5. Passer le téléphone en anglais : les libellés de la montre passent en anglais. Repasser en français : ils redeviennent français. Le zikr reste en arabe.
6. Mode toujours allumé : le nombre et l’arabe restent, le texte d’aide disparaît, rien ne clignote.
7. Couper le lien (mode avion sur la montre, ou iPhone éteint), compter, rouvrir Zikru sur l’iPhone : le total augmente une fois. Rouvrir encore : il n’augmente plus.
8. Compter sur l’iPhone : la montre suit, sans ajouter ses propres taps une deuxième fois.
9. Remettre à zéro sur l’iPhone : le compte affiché repart. Les taps déjà faits restent dans le total, ils ne sont pas comptés deux fois.
10. Poser la complication sur un cadran. Elle montre le compte et la part du jour. La toucher ouvre le compteur.

La complication ne se réveille pas toute seule chaque minute. L’app montre lui demande de se rafraîchir, au plus toutes les quelques secondes pendant qu’on compte. C’est voulu, pour la batterie.

### 3. Au moment de soumettre

Même fiche, même achat Premium, même identifiant. Dans la version, onglet Apple Watch des captures : Apple demande des captures de la montre quand le binaire en contient une. Ce n’est pas une deuxième app. Le texte de la fiche peut dire que le compteur existe sur la montre.

Le prix Premium ne change pas. Le compteur de la montre n’est pas un achat.

## Ce qui a été regardé ici, et ce qui ne l’a pas été

Sur cette machine (Linux, pas de Xcode) :

- `npx tsc --noEmit` passe.
- `npm test` passe, y compris `scripts/test-watch-merge.mjs`.
- `npx expo config` montre les deux cibles et le groupe d’apps dans `appExtensions`.
- `npx expo prebuild -p ios --no-install` a produit un projet Xcode (dossier `ios/`, non versionné). Dedans : la cible `ZikruWatch` est embarquée (`Embed Watch Content`), la complication est embarquée dans la montre, l’identifiant est `com.vibecode.zikru-76mpdv.watchkitapp`, le compagnon est l’app iPhone, la version marketing est `1.0.30`, le numéro de build est `69`, watchOS minimum `10.0`, équipe `Y9XF9RY2BU`.

Ça ne compile pas le Swift. Aucun binaire, aucun simulateur, aucune montre. Le premier `eas build -p ios` reste obligatoire avant de dire que l’app montre fonctionne.

## Fichiers

- `targets/watch/` — app SwiftUI, WatchConnectivity, couronne, vibrations, hors-ligne.
- `targets/watch-widget/` — complication WidgetKit.
- `modules/zikru-watch/` — pont iPhone.
- `src/lib/watch-sync.ts` — fusion des séances (testée).
- `src/lib/use-watch-sync.ts` — envoi de la liste, réception des comptes.
- `plugins/with-watch-version.js` — aligne la version marketing de la montre.
- `app.config.js` — plugin `@bacons/apple-targets` et équipe Apple.
