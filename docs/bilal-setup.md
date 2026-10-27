# El Ghaly Bilal — configuration (IA)

Bilal passe par la fonction Edge Supabase `bilal` (projet `wzcrghubbxelyxcspldk`).
La clé du modèle n'est **jamais** dans l'app : elle reste dans les secrets Supabase.

Tant qu'aucune clé n'est configurée, la fonction répond `503 {"error":"not_configured"}` :
- le chat affiche « Bientôt disponible, inch'Allah » ;
- la carte « Réflexion » de l'accueil utilise les textes préparés (src/lib/reflections.ts).

## Activer
Supabase → Project Settings → Edge Functions → **Secrets** :

| Secret | Valeur |
| --- | --- |
| `AI_API_KEY` | votre clé (Anthropic ou OpenAI), ex. `YOUR_AI_API_KEY` |
| `AI_PROVIDER` | optionnel : `anthropic` (défaut) ou `openai` |
| `AI_MODEL` | optionnel : défaut `claude-sonnet-4-5` (Anthropic) / `gpt-4o-mini` (OpenAI) |

Aucune reconstruction de l'app n'est nécessaire.

## Sécurité
- `verify_jwt = false`, mais la fonction vérifie l'utilisateur (`auth.getUser`) : connexion obligatoire.
- Quota : 30 requêtes / utilisateur / jour (table `bilal_usage`, RPC `bilal_consume()`), sans clé service_role.
- Prompt système : pas de fatwa, pas de hadith inventé, renvoi vers imam / muqaddam / secours (112, 144, 143).
- Source : `supabase/functions/bilal/index.ts`.
