/**
 * v2 — Point unique de signalement des erreurs.
 *
 * État actuel : RIEN ne quitte l'appareil. L'erreur est seulement écrite dans la console (journal local).
 * Un service de suivi (ex. Sentry, EXPO_PUBLIC_SENTRY_DSN=YOUR_SENTRY_DSN) ne sera branché qu'après accord
 * de Mohamed, mise à jour de la politique de confidentialité et de la fiche App Privacy, et consentement
 * explicite de l'utilisateur. Le SDK n'est volontairement pas installé.
 */
export type CrashContext = { where: string };
type Sink = (error: unknown, ctx: CrashContext) => void;

let sink: Sink | null = null;
let count = 0;

/** Branche un récepteur (tests, futur service sur consentement). `null` = débranché. */
export function setCrashSink(s: Sink | null): void {
  sink = s;
}

/** DSN configuré ET non fictif (jamais vrai tant que .env contient YOUR_SENTRY_DSN ou rien). */
export function crashServiceConfigured(dsn: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN): boolean {
  return !!dsn && !dsn.startsWith('YOUR_') && /^https:\/\//.test(dsn);
}

/** Signale une erreur : console locale + récepteur éventuel. Ne lève jamais d'exception. */
export function reportError(error: unknown, ctx: CrashContext): void {
  count++;
  try {
    console.error('[Zikru] erreur interceptée (' + ctx.where + ')', error);
  } catch {}
  try {
    sink?.(error, ctx);
  } catch {}
}

export const reportedCount = () => count;
