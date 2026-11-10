/**
 * StoreKit / Play Billing via expo-iap (SDK Expo 58).
 * Le reçu n’est pas envoyé à un serveur : StoreKit confirme l’achat sur l’appareil.
 * Aucune clé secrète ici.
 */
import { Platform } from 'react-native';
import {
  endConnection,
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Purchase,
} from 'expo-iap';
import { PREMIUM_PRODUCT_ID, type StoreCheck, type StoreListener, type StorePlatform } from './premium-logic';

const platform = (): StorePlatform => (Platform.OS === 'android' ? 'android' : 'ios');

let connected = false;
let listener: StoreListener | null = null;
let purchaseWait: { resolve: () => void; reject: (error: unknown) => void } | null = null;

async function connect(): Promise<boolean> {
  if (connected) return true;
  try {
    await initConnection();
    connected = true;
    return true;
  } catch {
    connected = false;
    return false;
  }
}

function matches(p: Purchase): boolean {
  return p.productId === PREMIUM_PRODUCT_ID || (p.ids ?? []).includes(PREMIUM_PRODUCT_ID);
}

async function checkFromList(list: Purchase[], online: boolean): Promise<StoreCheck> {
  const hit = list.find(matches);
  if (!hit) return { online, owned: online ? false : null, platform: platform(), now: Date.now() };
  if (hit.purchaseState === 'pending') return { online, owned: null, platform: platform(), now: Date.now() };
  await finishTransaction({ purchase: hit, isConsumable: false }).catch(() => {});
  return { online: true, owned: true, transactionId: hit.id, platform: platform(), now: Date.now() };
}

async function readOwned(): Promise<StoreCheck> {
  if (!(await connect())) return { online: false, owned: null, platform: platform(), now: Date.now() };
  try {
    const list = await getAvailablePurchases();
    return checkFromList(list ?? [], true);
  } catch {
    return { online: false, owned: null, platform: platform(), now: Date.now() };
  }
}

function codeOf(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const c = (error as { code?: string }).code;
  return typeof c === 'string' ? c : null;
}

export const premiumStore = {
  payments: true,
  loadPrice: async (): Promise<string | null> => {
    if (!(await connect())) return null;
    try {
      const products = await fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'in-app' });
      const hit = (products ?? []).find((p) => p.id === PREMIUM_PRODUCT_ID);
      const price = hit?.displayPrice?.trim();
      return price || null;
    } catch {
      return null;
    }
  },
  reverify: readOwned,
  restore: async (): Promise<StoreCheck> => {
    if (!(await connect())) return { online: false, owned: null, platform: platform(), now: Date.now() };
    try {
      await restorePurchases();
    } catch (error) {
      listener?.onCode(codeOf(error));
      return { online: false, owned: null, platform: platform(), now: Date.now() };
    }
    return readOwned();
  },
  purchase: async (): Promise<void> => {
    if (!(await connect())) {
      listener?.onCode(ErrorCode.NetworkError);
      throw new Error(ErrorCode.NetworkError);
    }
    await new Promise<void>((resolve, reject) => {
      purchaseWait = {
        resolve: () => {
          purchaseWait = null;
          resolve();
        },
        reject: (error) => {
          purchaseWait = null;
          reject(error);
        },
      };
      void requestPurchase({
        type: 'in-app',
        request: {
          apple: { sku: PREMIUM_PRODUCT_ID },
          google: { skus: [PREMIUM_PRODUCT_ID] },
        },
      }).catch((error: unknown) => {
        if (codeOf(error) === ErrorCode.AlreadyOwned) {
          void readOwned().then((check) => {
            listener?.onCheck(check);
            purchaseWait?.resolve();
          });
          return;
        }
        listener?.onCode(codeOf(error));
        purchaseWait?.reject(error);
      });
    });
  },
  subscribe: (next: StoreListener): (() => void) => {
    listener = next;
    const updated = purchaseUpdatedListener((purchase) => {
      if (!matches(purchase)) return;
      if (purchase.purchaseState === 'pending') {
        listener?.onCode(ErrorCode.Pending);
        // Ask to Buy : on ne bloque pas l’attente. Le droit reste inconnu jusqu’à l’approbation.
        purchaseWait?.resolve();
        purchaseWait = null;
        return;
      }
      void finishTransaction({ purchase, isConsumable: false })
        .catch(() => {})
        .finally(() => {
          listener?.onCheck({
            online: true,
            owned: true,
            transactionId: purchase.id,
            platform: platform(),
            now: Date.now(),
          });
          purchaseWait?.resolve();
        });
    });
    const failed = purchaseErrorListener((error) => {
      listener?.onCode(error.code ?? null);
      if (error.code === ErrorCode.AlreadyOwned) {
        void readOwned().then((check) => {
          listener?.onCheck(check);
          purchaseWait?.resolve();
        });
        return;
      }
      purchaseWait?.reject(error);
    });
    return () => {
      updated.remove();
      failed.remove();
      listener = null;
      void endConnection().catch(() => {
        connected = false;
      });
      connected = false;
    };
  },
};
