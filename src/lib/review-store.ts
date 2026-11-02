import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';
import { normalizeReview, REVIEW_INIT, shouldAskReview, type ReviewState } from './review-policy';
import { shared } from './shared-state';

/** Nouvelle clé locale « review-prompt » (aucune clé existante modifiée) ; jamais synchronisée. */
export const reviewState = shared<ReviewState>('review-prompt', REVIEW_INIT, normalizeReview);

/** Première ouverture connue (pour ne jamais demander le premier jour). */
export function noteAppSeen(now = Date.now()): void {
  if (!reviewState.get().firstSeenAt) reviewState.set((s) => (s.firstSeenAt ? s : { ...s, firstSeenAt: now }));
}

/** Une erreur vient d'être signalée : pas de demande de note dans les 24 h. */
export function noteAppError(now = Date.now()): void {
  reviewState.set((s) => ({ ...s, lastErrorAt: now }));
}

/** Après un moment de réussite : ouvre la fenêtre native de notation si la politique le permet (iOS / Android). */
export async function maybeAskReview(now = Date.now()): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    await reviewState.load();
    if (!shouldAskReview(reviewState.get(), now)) return false;
    if (!(await StoreReview.isAvailableAsync())) return false;
    reviewState.set((s) => ({ ...s, lastAskAt: now, asks: s.asks + 1 }));
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
