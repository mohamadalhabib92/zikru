/**
 * Erreurs de l'assistant Bilal (module pur, testé par scripts/test-pass1.mjs).
 * Règle (brief §0/§16) : une API payante en panne, sans crédit (402) ou surchargée (529) ne bloque JAMAIS le cœur
 * de l'app — Bilal affiche un message calme et les écrans retombent sur le contenu préparé hors-ligne.
 */
export type BilalCode = 'not_configured' | 'auth' | 'quota' | 'offline' | 'unavailable' | 'error';
export class BilalError extends Error {
  constructor(public code: BilalCode, msg?: string) {
    super(msg ?? code);
  }
}

const KNOWN: BilalCode[] = ['not_configured', 'auth', 'quota', 'unavailable'];
/** Statut HTTP + corps JSON de la fonction Edge → code d'erreur affichable. */
export function codeFromResponse(status: number | undefined, body: unknown): BilalCode {
  const e = (body as { error?: unknown } | null)?.error;
  if (typeof e === 'string' && (KNOWN as string[]).includes(e)) return e as BilalCode;
  if (e === 'upstream') return 'unavailable';
  if (status === 401) return 'auth';
  if (status === 429) return 'quota';
  if (status === 402 || status === 502 || status === 503 || status === 504 || status === 529) return 'unavailable';
  return 'error';
}

export function bilalErrorFr(e: unknown): string {
  const c: BilalCode = e instanceof BilalError ? e.code : 'error';
  return {
    not_configured: 'El Ghaly Bilal sera bientôt disponible, inch’Allah. En attendant, voici des réflexions préparées pour vous.',
    auth: 'Connectez-vous (Communauté → Se connecter) pour discuter avec Bilal.',
    quota: 'Vous avez atteint la limite de messages pour aujourd’hui. Revenez demain, inch’Allah.',
    offline: 'Pas de connexion : réessayez plus tard.',
    unavailable: 'Bilal est momentanément indisponible. Tout le reste de Zikru fonctionne normalement, hors-ligne.',
    error: 'Bilal n’a pas pu répondre. Réessayez dans un instant.',
  }[c];
}
