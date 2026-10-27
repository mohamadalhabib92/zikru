import { env } from './config';

/**
 * Supabase (optionnel). Le cœur de l'app (prières, qibla, tasbih, contenu approuvé)
 * ne dépend JAMAIS du réseau ni d'une API payante. Sans configuration, l'écran
 * « Configuration manquante » l'explique ; aucune clé n'est inventée.
 */
export const SUPABASE_URL = env('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = env('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
export const backendConfigured = SUPABASE_URL.configured && SUPABASE_ANON_KEY.configured;

/** Synchronisation « douce » : jamais bloquante, ignorée hors-ligne ou sans configuration. */
export async function softSync(_payload: unknown): Promise<'skipped' | 'ok' | 'error'> {
  if (!backendConfigured) return 'skipped';
  // À brancher après mise en place de l'authentification Supabase (tables dans supabase/schema.sql).
  return 'skipped';
}
