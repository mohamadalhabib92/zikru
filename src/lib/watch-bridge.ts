/**
 * Pont vers la montre. Sur le web et Android il n’existe pas : l’app continue sans lui.
 * iOS : `watch-bridge.ios.ts`.
 */
export type WatchNative = {
  supported(): boolean;
  pushContext(json: string): void;
  transferSessions(json: string): void;
  subscribe(onJson: (json: string) => void): () => void;
};

export const watchNative: WatchNative | null = null;
