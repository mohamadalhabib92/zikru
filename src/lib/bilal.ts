import { supabase } from './supabase';

/**
 * El Ghaly Bilal — coach comportemental islamique (IA).
 * Passe par la fonction Edge Supabase « bilal » : la clé du modèle reste côté serveur
 * (secret AI_API_KEY). Sans clé configurée → « bientôt disponible ».
 */
import { BilalError, codeFromResponse } from './bilal-errors';
export { BilalError, bilalErrorFr, codeFromResponse } from './bilal-errors';
export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export async function askBilal(body: { mode: 'chat'; messages: ChatMsg[] } | { mode: 'reflection'; period: string }): Promise<string> {
  if (!supabase) throw new BilalError('not_configured');
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) throw new BilalError('auth');
  try {
    const { data, error } = await supabase.functions.invoke('bilal', { body });
    if (error) {
      let code: BilalError['code'] = 'error';
      try {
        // FunctionsHttpError : le corps JSON contient { error: code } ; 402/529… → « indisponible », jamais bloquant.
        const ctx = (error as { context?: Response }).context;
        const j = ctx ? await ctx.json().catch(() => null) : null;
        code = codeFromResponse(ctx?.status, j);
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
