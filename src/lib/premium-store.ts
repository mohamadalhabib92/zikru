/**
 * Store web : pas d’achat. Le droit déjà en cache (antériorité) n’est pas effacé.
 */
import type { StoreCheck, StoreListener } from './premium-logic';

export type { StoreListener };

const unknown = (): StoreCheck => ({ online: true, owned: null, platform: 'ios', now: Date.now() });

export const premiumStore = {
  /** Aucun paiement dans le navigateur. */
  payments: false,
  loadPrice: async (): Promise<string | null> => null,
  reverify: async (): Promise<StoreCheck> => unknown(),
  restore: async (): Promise<StoreCheck> => unknown(),
  purchase: async (): Promise<void> => {},
  subscribe: (_listener: StoreListener): (() => void) => () => {},
};
