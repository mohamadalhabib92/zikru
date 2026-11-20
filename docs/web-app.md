# Zikru dans le navigateur

Branche issue de `cursor/apple-watch-c4bc` (PR 13, tête `50ade8a`), la ligne iPhone la plus avancée ouverte : ʿaqīda d’Ibn ʿĀshir, matn d’al-Akhdarī, défilement du Coran, bague, montre, Mac. La PR 15 (Apple TV) part d’un commit plus ancien de cette branche et n’a pas ces quatre derniers commits iPhone. Ce document ne décrit pas un déploiement : **`main` publie la PWA**. Ne pas y merger cette branche.

Le même code Expo sert l’iPhone et le web (`react-native-web`). Rien ici n’efface un compte, un zikr, un groupe ou le cache Premium. Aucune migration Supabase et aucune Edge Function ne sont déployées.

## Lancer en local

```bash
npm install
npx expo start --web
```

Puis ouvrir l’adresse affichée (souvent `http://localhost:8081`). La langue se change dans Réglages. `?` ouvre les raccourcis clavier (inactifs dans un champ de saisie). `g` puis `h` `p` `t` `l` `m` `a` `f` `c` `d` va à l’accueil, aux prières, au tasbih, au Coran, à Plus, aux adhkar, au fiqh, à la communauté, à la discussion. Sur une sourate, `j` / `k` changent de verset et `p` lance ou met en pause. Les flèches et l’espace restent au défilement.

Build installable (service worker, hors-ligne) :

```bash
npm run build:web
npx serve dist
```

L’app exportée vit sous `/zikru` (`experiments.baseUrl`). Le worker ne s’enregistre pas sur `localhost` pendant `expo start` : l’écoute audio hors ligne et le cache d’installation se vérifient sur le build servi, ou sur un hôte qui n’est pas localhost.

`npm test` et `npx tsc --noEmit` couvrent aussi la logique iPhone, montre et Premium. Il n’y a pas de projet Xcode dans le dépôt (`ios/` est généré).

## Paiement web (fermé)

Créer un zikr ou un groupe reste Premium, comme sur l’iPhone. La discussion, rejoindre un groupe et le compteur de la montre restent gratuits. Le navigateur ne débite rien.

| Variable | Rôle |
| --- | --- |
| `EXPO_PUBLIC_WEB_CHECKOUT` | `1` pour afficher que le chemin est préparé. Toute autre valeur, ou l’absence : l’écran dit que l’achat se fait dans l’app iPhone. |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Réservée. Une clé `sk_` ou `rk_` est refusée. Une clé publique ne rend pas l’achat possible : ce code n’appelle pas Stripe. |

Pour un vrai paiement, plus tard, hors de ce dépôt :

1. Produit Stripe « paiement unique », même promesse que `ch.mohamadba.zikru.premium.lifetime` (à vie, pas un abonnement).
2. Checkout côté serveur (Edge Function ou équivalent), clé secrète seulement là, jamais dans l’app ni dans git.
3. Webhook signé qui écrit le droit déjà prévu (le cache local `premium-entitlement-v1` ne doit pas être inventé par le client).
4. Clé publiable `pk_` seulement, via la variable ci-dessus, après revue. Pas de clé live dans le dépôt.
5. Laisser le drapeau à `1` seulement quand ces quatre points répondent. Tant que `chargeable` vaut faux dans `src/lib/web-checkout.ts`, le bouton d’achat iOS ne s’affiche pas sur le web.

## Hors du navigateur

- **Apple Watch** : pas de WatchConnectivity. Le compteur de la montre reste dans l’app iPhone, gratuit. Le web le dit dans Réglages.
- **Santé (HealthKit)** : ce dépôt n’a pas de module HealthKit. Le web le dit, et ne lit aucune donnée de santé.
- **Bague** : facultative. Web Bluetooth seulement après un appui sur Rechercher, dans Chrome ou Edge. Safari et iOS dans le navigateur ne l’offrent pas. Pas de scan en arrière-plan. Les anneaux clavier restent écoutés seulement quand la page est au premier plan.
- **OCR photo, widgets, vibrations** : iPhone (ou Mac pour une partie). Le web ne les imite pas.

## Matrice iPhone / web

| Fonction | iPhone | Web | Pourquoi |
| --- | --- | --- | --- |
| Coran, défilement fluide (liste virtualisée, texte uthmani) | fait | fait | Même lecteur. `j` / `k` en plus sur une sourate. La colonne reste étroite pour ne pas fausser les hauteurs estimées. |
| Coran hors ligne | fait | fait | Le texte uthmani est dans l’application. Le service worker du build précache les fichiers exportés. L’audio téléchargé a son propre cache. |
| Adhkar, duʿāʾ, tasbih, objectifs | fait | fait | Compteur au clic ou au clavier. |
| Horaires, qibla, hégire | fait | fait | Calcul sur l’appareil. La boussole web dépend du capteur du navigateur. |
| Adhan | fait | partiel | La voix choisie se joue avec le bouton. L’appel automatique peut être bloqué tant que la page n’a pas reçu un geste, ou si les notifications sont refusées. |
| Fiqh des quatre écoles | fait | fait | Mêmes textes sourcés, mêmes drapeaux « à relire ». |
| ʿAqīda Ibn ʿĀshir (Murshid, vers 6 à 40) | fait | fait | Guiding Helper 2005, non altéré. La lecture à voix haute est Premium, comme sur l’iPhone. Le texte se lit sans achat. |
| Matn al-Akhdarī vocalisé | fait | fait | Même `assets/fiqh/akhdari.json`. |
| Mukhtaṣar Khalīl | pas inclus | pas inclus | Aucune édition vocalisée dont la licence est claire n’est dans le dépôt. Le texte classique est du domaine public ; une vocalisation moderne ne l’est pas forcément. On n’en invente pas. |
| Groupes (créer) | Premium | Premium | Même droit local. Rejoindre ou demander à rejoindre reste gratuit. |
| Discussion | gratuit | fait | Même écran. Entrée envoie, Maj+Entrée va à la ligne. |
| Appels et lecture partagée | Premium | partiel | Même écran, WebRTC du navigateur (`livekit-client`) si le serveur d’appels est configuré. Micro et caméra seulement après accord. Le texte synchronisé est le même code que l’iPhone (Hafs Tanzil). Sans serveur, l’appel ne s’ouvre pas. |
| Langues de l’app | fait | fait | Les mêmes catalogues. Arabe, ourdou et persan : `dir=rtl` et barre latérale à droite à partir de 1024 px. Les langues « à relire » le restent. |
| Premium | achat Apple | partiel | Pas de débit web. Antériorité locale conservée. Voir le tableau des variables. |
| Montre | fait, gratuit | impossible | Pas de lien montre dans un navigateur. |
| Bague Bluetooth | fait | partiel, facultatif | Web Bluetooth sur geste, Chrome / Edge. Jamais obligatoire. |
| HealthKit | absent du code | impossible | Rien à brancher. Le réglage web le dit. |
| Photo / OCR d’un zikr | iOS | impossible | Vision est sur l’appareil. Le collage de texte reste possible. |
| PWA installable | — | fait | `public/manifest.json`, icônes, `npm run build:web`. Orientation libre pour le bureau. |
| Raccourcis | Siri / actions d’icône, et touches sur Mac | fait | `?` et la liste dans Plus. |
| Apple TV | autre branche (PR 15) | — | Non fusionnée ici. Ce diff ne touche pas au profil `production-tv`. |
