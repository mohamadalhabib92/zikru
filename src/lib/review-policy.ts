/**
 * v2 — Quand proposer la note de l'App Store / Play Store (logique pure, testée par scripts/test-review.mjs).
 * Règles : seulement juste après un moment de réussite (étape atteinte), au plus une fois tous les 90 jours,
 * jamais dans les 24 h qui suivent une erreur, jamais pendant le premier jour d'usage. Aucun avis n'est
 * rédigé ni affiché par l'app : c'est le système (iOS / Android) qui montre sa propre fenêtre.
 */
export type ReviewState = { firstSeenAt?: number; lastAskAt?: number; lastErrorAt?: number; asks: number };
export const REVIEW_INIT: ReviewState = { asks: 0 };
export const REVIEW_GAP_DAYS = 90;
export const ERROR_COOLDOWN_H = 24;
export const MIN_AGE_DAYS = 1;
const DAY = 86_400_000;

export function normalizeReview(v: unknown): ReviewState {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
  return { firstSeenAt: num(o.firstSeenAt), lastAskAt: num(o.lastAskAt), lastErrorAt: num(o.lastErrorAt), asks: num(o.asks) ?? 0 };
}

/** Faut-il proposer la note maintenant (appelé seulement après un moment de réussite) ? */
export function shouldAskReview(s: ReviewState, now: number): boolean {
  if (!s.firstSeenAt || now - s.firstSeenAt < MIN_AGE_DAYS * DAY) return false;
  if (s.lastAskAt && now - s.lastAskAt < REVIEW_GAP_DAYS * DAY) return false;
  if (s.lastErrorAt && now - s.lastErrorAt < ERROR_COOLDOWN_H * 3_600_000) return false;
  return true;
}
