# Branche `release/next`

Cette branche rassemble le travail ouvert compatible pour le prochain TestFlight. Elle ne doit pas être fusionnée dans `main` sans accord explicite.

`main` déploie le site et la PWA (workflow « Deploy PWA to GitHub Pages », uniquement sur `main`). Un merge ici publierait aussi la politique 1.0.30, les thèmes Verre et les cibles montre / Apple TV sur ce déploiement.

Les autres branches ouvertes ne sont pas supprimées.

## Contrôles automatiques

À chaque push et à chaque pull request, GitHub Actions (`.github/workflows/pr-checks.yml`) enchaîne, sans secret et sans EAS :

1. `npm ci`
2. `npx tsc --noEmit`
3. `npm test`
4. `npx expo export -p web` (vérifie que l’app web s’exporte ; rien n’est publié)

## Envoyer un build sur TestFlight

À lancer depuis un poste où Expo et App Store Connect sont déjà connectés. Ne pas envoyer la version en revue App Store (`eas submit` ne fait que déposer le binaire dans TestFlight).

Les certificats, le groupe d’apps, les identifiants de bundle et les profils de provisionnement ne se règlent pas dans cette branche : `eas.json` garde `appVersionSource: remote` et `production.autoIncrement: true`. Le compteur iOS vient du projet Expo, pas d’une réécriture locale.

Version marketing actuelle : `1.0.30`. `app.json` indique `ios.buildNumber` **86** (au-dessus du TestFlight 85). Ce numéro local n’est pas la source tant que le compteur distant est actif.

```bash
git fetch origin release/next
git checkout release/next

# iPhone
eas build -p ios --profile production --non-interactive
eas submit -p ios --profile production --latest --non-interactive

# Apple TV (projet Expo zikru-tv, compteur séparé de l’iPhone)
eas build -p ios --profile production-tv --non-interactive
eas submit -p ios --profile production-tv --latest --non-interactive
```

`EXPO_TV=1` (posé par le profil `production-tv`) force le slug `zikru-tv`. Ne pas lancer ces commandes depuis `main`.
