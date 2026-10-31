import type { ShortcutId } from './shortcuts';

/** Web : ni Siri ni actions rapides d’icône. */
export const shortcutsNative = false;
export function useShortcuts(_titles: Record<ShortcutId, string>): void {}
