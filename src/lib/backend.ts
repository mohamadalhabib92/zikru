import { env } from './config';

/**
 * Supabase (communautés Famille / Proches). Le cœur de l'app (prières, qibla,
 * tasbih, contenu approuvé) ne dépend JAMAIS du réseau.
 * L'URL et la clé anon (publique, protégée par RLS) viennent uniquement des variables
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Aucune valeur réelle dans le dépôt.
 * Aucune clé service_role n'est jamais embarquée dans le client.
 */
// Aucune URL ni clé dans le dépôt. YOUR_* ou vide = mode local, sans appel réseau.
export const SUPABASE_URL = env('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = env('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
export const backendConfigured = SUPABASE_URL.configured && SUPABASE_ANON_KEY.configured;

/** URL publique de la PWA (liens d'invitation et redirection des liens magiques sur le web). */
export const PWA_URL = 'https://mohamadalhabib92.github.io/zikru/';

/** Synchronisation « douce » : jamais bloquante (les contributions passent par src/lib/community/sync.tsx). */
export async function softSync(_payload: unknown): Promise<'skipped' | 'ok' | 'error'> {
  return backendConfigured ? 'ok' : 'skipped';
}
