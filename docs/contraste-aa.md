# Contraste WCAG AA mesuré (Passe 1, 31.10.2026)

Généré par `node scripts/test-contrast.mjs --table` à partir des jetons réels de `src/ui/theme.ts`. Seuils : texte 4,5:1, icônes 3:1.

L’or d’identité #D9B65C est réservé aux bordures, icônes décoratives et au texte sur fond sombre (hero). Sur fond clair, le texte or utilise `brand.goldDeep` / `theme.accent` = #7A5C12 (≥ 5,1:1).

| Schéma | Couple texte / fond | Couleurs | Rapport | Seuil | |
|---|---|---|---|---|---|
| clair | theme.text / theme.bg | #15211C / #F7F4EE | 15.11:1 | 4.5 | OK |
| clair | theme.text / theme.surface | #15211C / #FFFFFF | 16.59:1 | 4.5 | OK |
| clair | theme.text / theme.surfaceAlt | #15211C / #F0ECE3 | 14.07:1 | 4.5 | OK |
| clair | theme.muted / theme.bg | #5C6A63 / #F7F4EE | 5.17:1 | 4.5 | OK |
| clair | theme.muted / theme.surface | #5C6A63 / #FFFFFF | 5.68:1 | 4.5 | OK |
| clair | theme.muted / theme.surfaceAlt | #5C6A63 / #F0ECE3 | 4.82:1 | 4.5 | OK |
| clair | theme.primary / theme.bg | #0E6B4F / #F7F4EE | 5.91:1 | 4.5 | OK |
| clair | theme.primary / theme.surface | #0E6B4F / #FFFFFF | 6.49:1 | 4.5 | OK |
| clair | theme.primary / theme.surfaceAlt | #0E6B4F / #F0ECE3 | 5.51:1 | 4.5 | OK |
| clair | theme.accent / theme.bg | #7A5C12 / #F7F4EE | 5.68:1 | 4.5 | OK |
| clair | theme.accent / theme.surface | #7A5C12 / #FFFFFF | 6.24:1 | 4.5 | OK |
| clair | theme.accent / theme.surfaceAlt | #7A5C12 / #F0ECE3 | 5.29:1 | 4.5 | OK |
| clair | theme.danger / theme.bg | #B42318 / #F7F4EE | 5.99:1 | 4.5 | OK |
| clair | theme.danger / theme.surface | #B42318 / #FFFFFF | 6.57:1 | 4.5 | OK |
| clair | theme.danger / theme.surfaceAlt | #B42318 / #F0ECE3 | 5.58:1 | 4.5 | OK |
| clair | theme.success / theme.bg | #177245 / #F7F4EE | 5.42:1 | 4.5 | OK |
| clair | theme.success / theme.surface | #177245 / #FFFFFF | 5.95:1 | 4.5 | OK |
| clair | theme.success / theme.surfaceAlt | #177245 / #F0ECE3 | 5.05:1 | 4.5 | OK |
| clair | theme.warning / theme.bg | #8A5A00 / #F7F4EE | 5.40:1 | 4.5 | OK |
| clair | theme.warning / theme.surface | #8A5A00 / #FFFFFF | 5.93:1 | 4.5 | OK |
| clair | theme.warning / theme.surfaceAlt | #8A5A00 / #F0ECE3 | 5.03:1 | 4.5 | OK |
| clair | theme.info / theme.bg | #1F5FA8 / #F7F4EE | 5.87:1 | 4.5 | OK |
| clair | theme.info / theme.surface | #1F5FA8 / #FFFFFF | 6.44:1 | 4.5 | OK |
| clair | theme.info / theme.surfaceAlt | #1F5FA8 / #F0ECE3 | 5.46:1 | 4.5 | OK |
| clair | theme.danger / theme.dangerBg | #B42318 / #FDECEA | 5.75:1 | 4.5 | OK |
| clair | theme.success / theme.successBg | #177245 / #E3F3E9 | 5.17:1 | 4.5 | OK |
| clair | theme.warning / theme.warningBg | #8A5A00 / #FBF0D5 | 5.23:1 | 4.5 | OK |
| clair | theme.info / theme.infoBg | #1F5FA8 / #E7EFF9 | 5.55:1 | 4.5 | OK |
| clair | theme.onPrimary / theme.primary | #FFFFFF / #0E6B4F | 6.49:1 | 4.5 | OK |
| clair | brand.ink / brand.cream | #15211C / #F7F4EE | 15.11:1 | 4.5 | OK |
| clair | brand.ink / brand.paper | #15211C / #FFFFFF | 16.59:1 | 4.5 | OK |
| clair | brand.inkMuted / brand.cream | #5C6A63 / #F7F4EE | 5.17:1 | 4.5 | OK |
| clair | brand.inkMuted / brand.paper | #5C6A63 / #FFFFFF | 5.68:1 | 4.5 | OK |
| clair | brand.goldDeep / brand.cream | #7A5C12 / #F7F4EE | 5.68:1 | 4.5 | OK |
| clair | brand.goldDeep / brand.paper | #7A5C12 / #FFFFFF | 6.24:1 | 4.5 | OK |
| clair | brand.green / brand.cream | #0E6B4F / #F7F4EE | 5.91:1 | 4.5 | OK |
| clair | brand.green / brand.paper | #0E6B4F / #FFFFFF | 6.49:1 | 4.5 | OK |
| clair | brand.brownSoft / brand.cream | #4F7466 / #F7F4EE | 4.76:1 | 4.5 | OK |
| clair | brand.brownSoft / brand.paper | #4F7466 / #FFFFFF | 5.22:1 | 4.5 | OK |
| clair | brand.rust / brand.cream | #A3501E / #F7F4EE | 5.14:1 | 4.5 | OK |
| clair | brand.rust / brand.paper | #A3501E / #FFFFFF | 5.64:1 | 4.5 | OK |
| clair | brand.purple / brand.cream | #4B3FA8 / #F7F4EE | 7.43:1 | 4.5 | OK |
| clair | brand.purple / brand.paper | #4B3FA8 / #FFFFFF | 8.15:1 | 4.5 | OK |
| clair | brand.brown / brand.cream | #0F3D30 / #F7F4EE | 11.05:1 | 4.5 | OK |
| clair | brand.brown / brand.paper | #0F3D30 / #FFFFFF | 12.14:1 | 4.5 | OK |
| clair | brand.goldDeep / brand.goldSoft | #7A5C12 / #FBF3DC | 5.63:1 | 4.5 | OK |
| clair | brand.green / brand.greenTint | #0E6B4F / #E6F2EC | 5.65:1 | 4.5 | OK |
| clair | brand.heroText / brand.hero | #FBF7EE / #0F3D30 | 11.35:1 | 4.5 | OK |
| clair | brand.heroText / brand.greenDeep | #FBF7EE / #0A3F30 | 11.12:1 | 4.5 | OK |
| clair | brand.heroMuted / brand.hero | #BFD3C9 / #0F3D30 | 7.73:1 | 4.5 | OK |
| clair | brand.heroMuted / brand.greenDeep | #BFD3C9 / #0A3F30 | 7.57:1 | 4.5 | OK |
| clair | brand.gold / brand.hero | #D9B65C / #0F3D30 | 6.24:1 | 4.5 | OK |
| clair | brand.gold / brand.greenDeep | #D9B65C / #0A3F30 | 6.11:1 | 4.5 | OK |
| clair | brand.onGreen / brand.green | #FFFFFF / #0E6B4F | 6.49:1 | 4.5 | OK |
| clair | onColor(green) / brand.green (Pill active) | #FFFFFF / #0E6B4F | 6.49:1 | 4.5 | OK |
| clair | onColor(goldDeep) / brand.goldDeep (Pill active) | #FFFFFF / #7A5C12 | 6.24:1 | 4.5 | OK |
| clair | onColor(blue) / brand.blue (Pill active) | #FFFFFF / #2A6FB8 | 5.17:1 | 4.5 | OK |
| clair | onColor(violet) / brand.violet (Pill active) | #FFFFFF / #7A4FC8 | 5.56:1 | 4.5 | OK |
| clair | onColor(rust) / brand.rust (Pill active) | #FFFFFF / #A3501E | 5.64:1 | 4.5 | OK |
| clair | onColor(purple) / brand.purple (Pill active) | #FFFFFF / #4B3FA8 | 8.15:1 | 4.5 | OK |
| clair | brand.teal (icône) / brand.paper | #2F8F76 / #FFFFFF | 3.95:1 | 3 | OK |
| clair | brand.blue (icône) / brand.paper | #2A6FB8 / #FFFFFF | 5.17:1 | 3 | OK |
| clair | brand.violet (icône) / brand.paper | #7A4FC8 / #FFFFFF | 5.56:1 | 3 | OK |
| clair | brand.indigo (icône) / brand.paper | #4338CA / #FFFFFF | 7.90:1 | 3 | OK |
| clair | brand.wirdGreen (icône) / brand.paper | #2F7D4F / #FFFFFF | 5.04:1 | 3 | OK |
| clair | brand.goldDeep (icône) / brand.paper | #7A5C12 / #FFFFFF | 6.24:1 | 3 | OK |
| clair | brand.rust (icône) / brand.paper | #A3501E / #FFFFFF | 5.64:1 | 3 | OK |
| clair | brand.purple (icône) / brand.paper | #4B3FA8 / #FFFFFF | 8.15:1 | 3 | OK |
| sombre | theme.text / theme.bg | #ECE7DC / #0A1210 | 15.39:1 | 4.5 | OK |
| sombre | theme.text / theme.surface | #ECE7DC / #121D19 | 14.01:1 | 4.5 | OK |
| sombre | theme.text / theme.surfaceAlt | #ECE7DC / #1A2823 | 12.42:1 | 4.5 | OK |
| sombre | theme.muted / theme.bg | #A0AEA7 / #0A1210 | 8.23:1 | 4.5 | OK |
| sombre | theme.muted / theme.surface | #A0AEA7 / #121D19 | 7.49:1 | 4.5 | OK |
| sombre | theme.muted / theme.surfaceAlt | #A0AEA7 / #1A2823 | 6.64:1 | 4.5 | OK |
| sombre | theme.primary / theme.bg | #3DBE8B / #0A1210 | 8.07:1 | 4.5 | OK |
| sombre | theme.primary / theme.surface | #3DBE8B / #121D19 | 7.35:1 | 4.5 | OK |
| sombre | theme.primary / theme.surfaceAlt | #3DBE8B / #1A2823 | 6.51:1 | 4.5 | OK |
| sombre | theme.accent / theme.bg | #D9B65C / #0A1210 | 9.75:1 | 4.5 | OK |
| sombre | theme.accent / theme.surface | #D9B65C / #121D19 | 8.88:1 | 4.5 | OK |
| sombre | theme.accent / theme.surfaceAlt | #D9B65C / #1A2823 | 7.87:1 | 4.5 | OK |
| sombre | theme.danger / theme.bg | #F0806E / #0A1210 | 7.24:1 | 4.5 | OK |
| sombre | theme.danger / theme.surface | #F0806E / #121D19 | 6.60:1 | 4.5 | OK |
| sombre | theme.danger / theme.surfaceAlt | #F0806E / #1A2823 | 5.85:1 | 4.5 | OK |
| sombre | theme.success / theme.bg | #6FD09A / #0A1210 | 10.09:1 | 4.5 | OK |
| sombre | theme.success / theme.surface | #6FD09A / #121D19 | 9.19:1 | 4.5 | OK |
| sombre | theme.success / theme.surfaceAlt | #6FD09A / #1A2823 | 8.14:1 | 4.5 | OK |
| sombre | theme.warning / theme.bg | #E8BE62 / #0A1210 | 10.82:1 | 4.5 | OK |
| sombre | theme.warning / theme.surface | #E8BE62 / #121D19 | 9.85:1 | 4.5 | OK |
| sombre | theme.warning / theme.surfaceAlt | #E8BE62 / #1A2823 | 8.73:1 | 4.5 | OK |
| sombre | theme.info / theme.bg | #8DB9E6 / #0A1210 | 9.23:1 | 4.5 | OK |
| sombre | theme.info / theme.surface | #8DB9E6 / #121D19 | 8.40:1 | 4.5 | OK |
| sombre | theme.info / theme.surfaceAlt | #8DB9E6 / #1A2823 | 7.45:1 | 4.5 | OK |
| sombre | theme.danger / theme.dangerBg | #F0806E / #3A1D19 | 5.85:1 | 4.5 | OK |
| sombre | theme.success / theme.successBg | #6FD09A / #15301F | 7.57:1 | 4.5 | OK |
| sombre | theme.warning / theme.warningBg | #E8BE62 / #352A12 | 8.03:1 | 4.5 | OK |
| sombre | theme.info / theme.infoBg | #8DB9E6 / #142536 | 7.58:1 | 4.5 | OK |
| sombre | theme.onPrimary / theme.primary | #03140D / #3DBE8B | 8.05:1 | 4.5 | OK |
| sombre | brand.ink / brand.cream | #ECE7DC / #0A1210 | 15.39:1 | 4.5 | OK |
| sombre | brand.ink / brand.paper | #ECE7DC / #121D19 | 14.01:1 | 4.5 | OK |
| sombre | brand.inkMuted / brand.cream | #A0AEA7 / #0A1210 | 8.23:1 | 4.5 | OK |
| sombre | brand.inkMuted / brand.paper | #A0AEA7 / #121D19 | 7.49:1 | 4.5 | OK |
| sombre | brand.goldDeep / brand.cream | #D9B65C / #0A1210 | 9.75:1 | 4.5 | OK |
| sombre | brand.goldDeep / brand.paper | #D9B65C / #121D19 | 8.88:1 | 4.5 | OK |
| sombre | brand.green / brand.cream | #26A074 / #0A1210 | 5.75:1 | 4.5 | OK |
| sombre | brand.green / brand.paper | #26A074 / #121D19 | 5.23:1 | 4.5 | OK |
| sombre | brand.brownSoft / brand.cream | #8DB0A2 / #0A1210 | 8.01:1 | 4.5 | OK |
| sombre | brand.brownSoft / brand.paper | #8DB0A2 / #121D19 | 7.29:1 | 4.5 | OK |
| sombre | brand.rust / brand.cream | #D07A45 / #0A1210 | 5.92:1 | 4.5 | OK |
| sombre | brand.rust / brand.paper | #D07A45 / #121D19 | 5.39:1 | 4.5 | OK |
| sombre | brand.purple / brand.cream | #A49BF5 / #0A1210 | 7.76:1 | 4.5 | OK |
| sombre | brand.purple / brand.paper | #A49BF5 / #121D19 | 7.06:1 | 4.5 | OK |
| sombre | brand.brown / brand.cream | #9CC2B2 / #0A1210 | 9.73:1 | 4.5 | OK |
| sombre | brand.brown / brand.paper | #9CC2B2 / #121D19 | 8.86:1 | 4.5 | OK |
| sombre | brand.goldDeep / brand.goldSoft | #D9B65C / #2A2414 | 7.93:1 | 4.5 | OK |
| sombre | brand.green / brand.greenTint | #26A074 / #13291F | 4.66:1 | 4.5 | OK |
| sombre | brand.heroText / brand.hero | #F4EFE4 / #103428 | 11.86:1 | 4.5 | OK |
| sombre | brand.heroText / brand.greenDeep | #F4EFE4 / #0F3A2C | 11.02:1 | 4.5 | OK |
| sombre | brand.heroMuted / brand.hero | #A9C3B7 / #103428 | 7.24:1 | 4.5 | OK |
| sombre | brand.heroMuted / brand.greenDeep | #A9C3B7 / #0F3A2C | 6.73:1 | 4.5 | OK |
| sombre | brand.gold / brand.hero | #D9B65C / #103428 | 6.99:1 | 4.5 | OK |
| sombre | brand.gold / brand.greenDeep | #D9B65C / #0F3A2C | 6.50:1 | 4.5 | OK |
| sombre | brand.onGreen / brand.green | #03140D / #26A074 | 5.73:1 | 4.5 | OK |
| sombre | onColor(green) / brand.green (Pill active) | #03140D / #26A074 | 5.73:1 | 4.5 | OK |
| sombre | onColor(goldDeep) / brand.goldDeep (Pill active) | #03140D / #D9B65C | 9.73:1 | 4.5 | OK |
| sombre | onColor(blue) / brand.blue (Pill active) | #03140D / #4D8FD6 | 5.60:1 | 4.5 | OK |
| sombre | onColor(violet) / brand.violet (Pill active) | #03140D / #9B7BE0 | 5.68:1 | 4.5 | OK |
| sombre | onColor(rust) / brand.rust (Pill active) | #03140D / #D07A45 | 5.90:1 | 4.5 | OK |
| sombre | onColor(purple) / brand.purple (Pill active) | #03140D / #A49BF5 | 7.74:1 | 4.5 | OK |
| sombre | brand.teal (icône) / brand.paper | #3FA88B / #121D19 | 5.91:1 | 3 | OK |
| sombre | brand.blue (icône) / brand.paper | #4D8FD6 / #121D19 | 5.11:1 | 3 | OK |
| sombre | brand.violet (icône) / brand.paper | #9B7BE0 / #121D19 | 5.19:1 | 3 | OK |
| sombre | brand.indigo (icône) / brand.paper | #8B83F0 / #121D19 | 5.43:1 | 3 | OK |
| sombre | brand.wirdGreen (icône) / brand.paper | #3C9A62 / #121D19 | 4.93:1 | 3 | OK |
| sombre | brand.goldDeep (icône) / brand.paper | #D9B65C / #121D19 | 8.88:1 | 3 | OK |
| sombre | brand.rust (icône) / brand.paper | #D07A45 / #121D19 | 5.39:1 | 3 | OK |
| sombre | brand.purple (icône) / brand.paper | #A49BF5 / #121D19 | 7.06:1 | 3 | OK |
