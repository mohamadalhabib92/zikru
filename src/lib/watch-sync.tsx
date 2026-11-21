import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { approvedOnly } from './content';
import { tasbihStore, useData } from './data';
import { DICTS } from './i18n';
import { FARD_KEYS } from './notify-plan';
import { AR_NAMES, PRAYER_KEYS } from './prayer';
import { useSettings } from './settings';
import { loadJSON, saveJSON } from './storage';
import { applyClicks, switchDhikr } from './tasbih-core';
import { buildWatchSnapshot, parseClick, type WatchClick, type WatchSnapshot } from './watch-snapshot';

type NativeStatus = { supported?: boolean; paired?: boolean; installed?: boolean; reachable?: boolean };
type Native = {
  status(): NativeStatus;
  activate(): void;
  push(json: string): void;
  addListener(event: 'clicks', cb: (e: { json?: string }) => void): { remove(): void };
};

const native: Native | null = Platform.OS === 'ios' ? requireOptionalNativeModule<Native>('ZikruWatch') : null;

export type WatchLink = { supported: boolean; paired: boolean; installed: boolean; reachable: boolean; received: number };

let link: WatchLink = { supported: false, paired: false, installed: false, reachable: false, received: 0 };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const seen = new Set<string>();
let seenReady = false;
const SEEN_KEY = 'watch-clicks';
const SEEN_MAX = 400;

function remember(ids: string[]) {
  for (const id of ids) seen.add(id);
  while (seen.size > SEEN_MAX) {
    const first = seen.values().next().value;
    if (first === undefined) break;
    seen.delete(first);
  }
  void saveJSON(SEEN_KEY, [...seen]);
}

async function ensureSeen() {
  if (seenReady) return;
  const stored = await loadJSON<string[]>(SEEN_KEY, []);
  if (Array.isArray(stored)) for (const id of stored) if (typeof id === 'string') seen.add(id);
  seenReady = true;
}

function applyOne(c: WatchClick) {
  tasbihStore.set((t) => {
    const base = t.dhikrId === c.dhikrId ? t : switchDhikr(t, c.dhikrId, c.target);
    return applyClicks(base, c.delta, 'manuel').next;
  });
}

async function ingest(raw: unknown) {
  await ensureSeen();
  const clicks = (Array.isArray(raw) ? raw : [raw]).map(parseClick).filter((c): c is WatchClick => !!c && !seen.has(c.id));
  if (!clicks.length) return;
  for (const c of clicks) applyOne(c);
  remember(clicks.map((c) => c.id));
  link = { ...link, received: link.received + clicks.length };
  emit();
}

function readStatus() {
  if (!native) {
    link = { ...link, supported: false, paired: false, installed: false, reachable: false };
    emit();
    return;
  }
  try {
    const s = native.status();
    link = {
      ...link,
      supported: !!s.supported,
      paired: !!s.paired,
      installed: !!s.installed,
      reachable: !!s.reachable,
    };
  } catch {
    link = { ...link, supported: false };
  }
  emit();
}

export function useWatchLink(): WatchLink {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => link,
    () => link,
  );
}

function snapshotOf(s: ReturnType<typeof useSettings>['s'], content: ReturnType<typeof useData>['content'], now: Date): WatchSnapshot {
  const dict = DICTS[s.lang] ?? DICTS.fr;
  const names = Object.fromEntries(PRAYER_KEYS.map((k) => [k, dict[k]])) as WatchSnapshot['names'];
  const cues = s.notif.adhan === false ? [] : FARD_KEYS.filter((k) => s.notif.prayers[k]);
  return buildWatchSnapshot({
    now,
    place: s.place,
    method: s.method,
    madhab: s.madhab,
    names,
    ar: AR_NAMES,
    cues,
    dhikrs: approvedOnly(content).map((i) => ({
      id: i.id,
      ar: i.arabic,
      tr: i.transliteration,
      target: i.defaultCount && i.defaultCount > 0 ? i.defaultCount : 33,
      source: i.source,
      example: i.seedExample === true,
    })),
  });
}

/** Pousse les horaires vers la montre et reçoit les appuis. Aucun rendu. */
export function WatchSync() {
  const { s, ready } = useSettings();
  const { content, ready: dataReady } = useData();
  const sig = JSON.stringify({
    place: s.place,
    method: s.method,
    madhab: s.madhab,
    lang: s.lang,
    adhan: s.notif.adhan,
    prayers: s.notif.prayers,
    dhikr: approvedOnly(content).map((i) => [i.id, i.arabic, i.defaultCount, i.seedExample]),
  });

  useEffect(() => {
    if (!native) return;
    try {
      native.activate();
    } catch {
      // Expo Go, ou build antérieur au module.
    }
    readStatus();
    const sub = native.addListener('clicks', (e) => {
      if (!e?.json) return;
      try {
        const parsed = JSON.parse(e.json) as unknown;
        void ingest(parsed);
      } catch {
        // charge illisible : on ignore
      }
    });
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') readStatus();
    });
    return () => {
      sub.remove();
      app.remove();
    };
  }, []);

  useEffect(() => {
    if (!native || !ready || !dataReady) return;
    const now = new Date();
    const json = JSON.stringify(snapshotOf(s, content, now));
    const id = setTimeout(() => {
      try {
        native.push(json);
        readStatus();
      } catch {
        // montre absente : le prochain passage au premier plan réessaie
      }
    }, 400);
    return () => clearTimeout(id);
    // sig résume les champs qui changent les heures ; `s` et `content` sont lus dedans.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ready, dataReady]);

  return null;
}
