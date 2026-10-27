import { supabase } from './supabase';

/**
 * El Ghaly Bilal — coach comportemental islamique (IA).
 * Passe par la fonction Edge Supabase « bilal » : la clé du modèle reste côté serveur
 * (secret AI_API_KEY). Sans clé configurée → « bientôt disponible ».
 */
export type ChatMsg = { role: 'user' | 'assistant'; content: string };
export class BilalError extends Error {
  constructor(public code: 'not_configured' | 'auth' | 'quota' | 'offline' | 'error', msg?: string) {
    super(msg ?? code);
  }
}

export async function askBilal(body: { mode: 'chat'; messages: ChatMsg[] } | { mode: 'reflection'; period: string }): Promise<string> {
  if (!supabase) throw new BilalError('not_configured');
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) throw new BilalError('auth');
  try {
    const { data, error } = await supabase.functions.invoke('bilal', { body });
    if (error) {
      let code: BilalError['code'] = 'error';
      try {
        // FunctionsHttpError : le corps JSON contient { error: code }
        const ctx = (error as { context?: Response }).context;
        const j = ctx ? await ctx.json() : null;
        if (j?.error === 'not_configured' || j?.error === 'quota' || j?.error === 'auth') code = j.error;
      } catch {}
      if (error.name === 'FunctionsFetchError') code = 'offline';
      throw new BilalError(code);
    }
    const text = (data as { text?: string })?.text?.trim();
    if (!text) throw new BilalError('error');
    return text;
  } catch (e) {
    if (e instanceof BilalError) throw e;
    throw new BilalError('offline');
  }
}

export function bilalErrorFr(e: unknown): string {
  const c = e instanceof BilalError ? e.code : 'error';
  return {
    not_configured: 'El Ghaly Bilal sera bientôt disponible, inch’Allah. En attendant, voici des réflexions préparées pour vous.',
    auth: 'Connectez-vous (Communauté → Se connecter) pour discuter avec Bilal.',
    quota: 'Vous avez atteint la limite de messages pour aujourd’hui. Revenez demain, inch’Allah.',
    offline: 'Pas de connexion : réessayez plus tard.',
    error: 'Bilal n’a pas pu répondre. Réessayez dans un instant.',
  }[c];
}
