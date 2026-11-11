import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { approvedOnly, type ContentItem } from './content';
import { emitClicks } from './community/clicks';
import { tasbihStore, useData } from './data';
import { withFatiha } from './fatiha';
import { useSettings } from './settings';
import { useZikrs } from './zikrs';
import type { Zikr } from './zikr';
import { watchNative } from './watch-bridge';
import { buildCatalog, sessionsFromPayload, sessionsPayload, type WatchMeta } from './watch-sync';

/**
 * Envoie à la montre la liste du jour et la composition courante, et range les séances
 * qu’elle renvoie. Le compteur n’est pas Premium : aucun droit n’est consulté ici.
 * Hors iOS, `watchNative` est nul et ce hook ne fait rien.
 */
function pickComposition(zikrs: Zikr[], activeId: string): Zikr | null {
  const current = zikrs.find((z) => z.items.some((it) => it.id === activeId || `${z.name} · ${it.label}` === activeId));
  if (current?.items.length) return current;
  const filled = zikrs.filter((z) => z.items.some((it) => it.ar.trim()));
  filled.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return filled[0] ?? null;
}

function todayOf(content: ContentItem[], activeId: string, target: number) {
  return approvedOnly(content)
    .filter((c) => c.arabic.trim())
    .map((c) => ({
      id: c.id,
      ar: c.arabic,
      label: c.transliteration?.trim() || c.arabic,
      goal: c.id === activeId ? Math.max(0, target) : c.defaultCount && c.defaultCount > 0 ? c.defaultCount : 33,
    }));
}

export function useWatchSync() {
  const native = watchNative;
  const { s, ready: settingsReady } = useSettings();
  const { content, tasbih, ready: dataReady } = useData();
  const { zikrs, ready: zikrReady } = useZikrs();
  const latest = useRef({ s, content, tasbih, zikrs });
  useEffect(() => {
    latest.current = { s, content, tasbih, zikrs };
  });

  useEffect(() => {
    if (!native) return;
    return native.subscribe((json) => {
      const sessions = sessionsFromPayload(json);
      if (!sessions.length) return;
      const r = tasbihStore.mergeWatch(sessions);
      if (r.added > 0) emitClicks(r.added, 'watch');
    });
  }, [native]);

  useEffect(() => {
    if (!native || !settingsReady || !dataReady || !zikrReady) return;
    let dead = false;
    const send = () => {
      if (dead) return;
      const phone = tasbihStore.notePhone(Date.now());
      if (!phone) return;
      const cur = latest.current;
      const meta = (tasbihStore.doc().watch ?? null) as WatchMeta | null;
      const comp = pickComposition(cur.zikrs, cur.tasbih.dhikrId);
      const items = comp ? withFatiha(comp.items, cur.s.fatihaFirst !== false) : [];
      const catalog = buildCatalog({
        lang: cur.s.lang,
        today: todayOf(cur.content, cur.tasbih.dhikrId, cur.tasbih.target),
        composition: items.map((it) => ({ id: it.id, ar: it.ar, label: it.label, goal: it.reps, alias: comp ? `${comp.name} · ${it.label}` : undefined })),
        compositionTitle: comp?.name ?? '',
        activeId: cur.tasbih.dhikrId,
        phone,
        applied: meta?.applied ?? {},
        epochs: meta?.epochs ?? {},
        now: Date.now(),
      });
      native.pushContext(JSON.stringify(catalog));
      native.transferSessions(sessionsPayload([phone]));
    };
    const timer = setTimeout(send, 700);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') send();
    });
    return () => {
      dead = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [native, settingsReady, dataReady, zikrReady, tasbih, content, zikrs, s.lang, s.fatihaFirst]);
}
