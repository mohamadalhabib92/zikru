/**
 * Paiement Premium dans le navigateur.
 * Le drapeau ouvre seulement l’explication. Ce module n’appelle pas Stripe,
 * n’envoie pas de carte, et ne débloque pas Premium.
 */

export type CheckoutEnv = {
  flag?: string;
  publishableKey?: string;
};

export type CheckoutReason = 'off' | 'no-key' | 'placeholder' | 'secret-key' | 'not-wired';

export type CheckoutStatus = {
  /** L’écran web peut expliquer le paiement. */
  enabled: boolean;
  /** Un débit est possible. Toujours faux dans ce code. */
  chargeable: false;
  reason: CheckoutReason;
};

const PLACEHOLDER = /your_|changeme|placeholder|todo|xxx|pk_test_your|pk_live_your/i;

export function readPublicCheckoutEnv(env: Record<string, string | undefined> = process.env): CheckoutEnv {
  return {
    flag: env.EXPO_PUBLIC_WEB_CHECKOUT,
    publishableKey: env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  };
}

export function webCheckoutStatus(env: CheckoutEnv = readPublicCheckoutEnv()): CheckoutStatus {
  if (env.flag !== '1') return { enabled: false, chargeable: false, reason: 'off' };
  const key = (env.publishableKey ?? '').trim();
  if (!key) return { enabled: true, chargeable: false, reason: 'no-key' };
  if (PLACEHOLDER.test(key)) return { enabled: true, chargeable: false, reason: 'placeholder' };
  if (key.startsWith('sk_') || key.startsWith('rk_')) return { enabled: true, chargeable: false, reason: 'secret-key' };
  return { enabled: true, chargeable: false, reason: 'not-wired' };
}

/** Vrai si une clé secrète ou une clé live est écrite dans un texte. */
export function sourceHasStripeSecret(text: string): boolean {
  return /(?:sk|rk)_live_[A-Za-z0-9]{8,}/.test(text) || /pk_live_[A-Za-z0-9]{8,}/.test(text);
}
