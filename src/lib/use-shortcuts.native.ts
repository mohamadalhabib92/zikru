import { requireOptionalNativeModule } from 'expo';
import * as AppIntents from 'expo-app-intents';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { freshInvocations, pathForShortcut, SHORTCUTS, type ShortcutId } from './shortcuts';

/**
 * Actions rapides (appui long sur l’icône, iOS et Android) et phrases Siri (iOS, App Intents).
 * Les deux modules natifs sont optionnels : sur un binaire qui ne les contient pas, tout est sans effet.
 */
type QuickActions = {
  takePending(): string | null;
  setItems(items: { id: string; title: string; icon: string; path: string }[]): Promise<void>;
  addListener(event: 'onAction', fn: (e: { id: string }) => void): { remove(): void };
};
const qa = requireOptionalNativeModule<QuickActions>('ZikruQuickActions');
export const shortcutsNative = !!qa || AppIntents.isAvailable();

export function useShortcuts(titles: Record<ShortcutId, string>): void {
  const seen = useRef(new Set<string>());
  const go = useCallback((id: unknown) => {
    const p = pathForShortcut(id);
    if (p) setTimeout(() => router.push(p as never), 300);
  }, []);
  const key = SHORTCUTS.map((s) => titles[s.id]).join('|');

  // Titres traduits dans la langue de l’app (mis à jour quand la langue change).
  useEffect(() => {
    if (!qa) return;
    qa.setItems(SHORTCUTS.map((s) => ({ id: s.id, title: titles[s.id], icon: s.icon, path: s.path }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Action choisie avant le démarrage (à froid) ou pendant que l’app tourne.
  useEffect(() => {
    if (!qa) return;
    const first = qa.takePending();
    if (first) go(first);
    const sub = qa.addListener('onAction', (e) => {
      qa.takePending();
      go(e?.id);
    });
    return () => sub.remove();
  }, [go]);

  // Siri / Raccourcis : livraison « au moins une fois », donc dédoublonnage par identifiant.
  AppIntents.useAppIntents(async (pending) => {
    for (const inv of freshInvocations(pending, seen.current)) {
      if (inv.name === 'open') go((inv.params as { action?: unknown } | undefined)?.action);
      await AppIntents.removePendingInvocationAsync(inv.id).catch(() => {});
    }
  });
}
