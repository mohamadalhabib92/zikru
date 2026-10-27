import { env } from './config';

/**
 * Supabase (communautés Famille / Proches). Le cœur de l'app (prières, qibla,
 * tasbih, contenu approuvé) ne dépend JAMAIS du réseau.
 * L'URL et la clé « publishable » sont publiques par conception (protégées par RLS) ;
 * elles peuvent être remplacées via EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * Aucune clé service_role n'est jamais embarquée dans le client.
 */
const DEFAULT_URL = 'https://wzcrghubbxelyxcspldk.supabase.co';
const DEFAULT_KEY = 'sb_publishable_a9Ne_e_Bv-hzgDqPwd9BEQ_tv68nojb';

export const SUPABASE_URL = env('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_URL);
export const SUPABASE_ANON_KEY = env('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY);
export const backendConfigured = SUPABASE_URL.configured && SUPABASE_ANON_KEY.configured;

/** URL publique de la PWA (liens d'invitation et redirection des liens magiques sur le web). */
export const PWA_URL = 'https://mohamadalhabib92.github.io/zikru/';

/** Synchronisation « douce » : jamais bloquante (les contributions passent par src/lib/community/sync.tsx). */
export async function softSync(_payload: unknown): Promise<'skipped' | 'ok' | 'error'> {
  return backendConfigured ? 'ok' : 'skipped';
}
