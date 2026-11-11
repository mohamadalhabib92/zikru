import { requireOptionalNativeModule } from 'expo';
import type { WatchNative } from './watch-bridge';

type Native = {
  supported(): boolean;
  pushContext(json: string): void;
  transferSessions(json: string): void;
  takePending(): string[];
  addListener(event: 'onPayload', fn: (e: { json?: string }) => void): { remove(): void };
};

const native = requireOptionalNativeModule<Native>('ZikruWatch');

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Module local `modules/zikru-watch`. Absent d’un binaire construit avant cette cible : tout est sans effet. */
export const watchNative: WatchNative | null = native
  ? {
      supported: () => safe(() => native.supported(), false),
      pushContext: (json) => safe(() => native.pushContext(json), undefined),
      transferSessions: (json) => safe(() => native.transferSessions(json), undefined),
      subscribe(onJson) {
        const sub = native.addListener('onPayload', (e) => {
          if (typeof e?.json === 'string' && e.json) onJson(e.json);
        });
        for (const json of safe(() => native.takePending(), [])) if (json) onJson(json);
        return () => sub.remove();
      },
    }
  : null;
