/** Deux codes différents. Ne pas les mélanger. */

/**
 * Code envoyé par e-mail (Supabase `verifyOtp`, type `email`).
 * Le projet est à 8 chiffres ; on accepte 6 à 8 pour suivre le réglage sans le figer.
 */
export const EMAIL_OTP_MIN = 6;
export const EMAIL_OTP_MAX = 8;
/** Code d’invitation créé sur l’iPhone (`private.gen_code` : 10 caractères). */
export const INVITE_CODE_LENGTH = 10;

/** Chiffres seuls, espaces retirés, au plus 8. */
export function emailOtpDigits(raw: string): string {
  return raw.trim().replace(/\D/g, '').slice(0, EMAIL_OTP_MAX);
}

/** Assez long pour être envoyé à Supabase, pas plus que le maximum du champ. */
export function emailOtpAccepted(raw: string): boolean {
  const n = emailOtpDigits(raw).length;
  return n >= EMAIL_OTP_MIN && n <= EMAIL_OTP_MAX;
}

/** Code famille : majuscules, lettres et chiffres, 10 maximum. */
export function inviteCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, INVITE_CODE_LENGTH);
}

/** Vrai si la saisie ressemble au code famille (des lettres), pas au code e-mail. */
export function looksLikeInviteCode(raw: string): boolean {
  const compact = raw.replace(/\s/g, '');
  return /[A-Za-z]/.test(compact) && compact.replace(/[^A-Za-z0-9]/g, '').length >= 8;
}
