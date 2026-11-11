import { useSyncExternalStore } from 'react';
import { autoOrder, downloadHold, type DownloadHold, type NetKind } from './audio-auto';
import { addVerse, entry, isComplete, isLocal, mapLimit, removeReciter, removeSurah, type DlManifest, type SizeTable } from './audio-dl-core';
import { deleteReciter, deleteSurah, freeSpace, localUri, saveVerse } from './audio-store';
import { ayahCount, ayahFallbackUrl, ayahUrl, reciterById } from './recitation';
import { shared } from './shared-state';

/**
 * Téléchargements de récitation pour l’écoute hors ligne, par récitateur et par sourate.
 * - Le manifeste (versets présents, octets) est local à l’appareil ; aucune donnée envoyée.
 * - La taille est mesurée AVANT téléchargement (en-tête Content-Length, requêtes HEAD).
 * - Les versets sont enregistrés dans l’ordre : une sourate interrompue reprend où elle s’était arrêtée.
 * Conditions d’utilisation des fichiers audio EveryAyah : à confirmer (YOUR_QURAN_TRANSLATIONS_LICENSES / registre des sources).
 */
export const dlManifest = shared<DlManifest>('quran-audio-dl', {});
export const dlSizes = shared<SizeTable>('quran-audio-sizes', {});

/** URL à lire : fichier local s’il est téléchargé (iOS/Android), sinon l’URL d’origine (servie par le cache sur la PWA). */
export function playableUrl(rid: string, s: number, a: number): string {
  if (isLocal(dlManifest.get(), rid, s, a)) {
    const u = localUri(rid, s, a);
    if (u) return u;
  }
  return ayahUrl(reciterById(rid), s, a);
}

// ——— File d’attente des téléchargements (en mémoire) ———
export type DlJob = { rid: string; s: number };
export type DlState = { active: (DlJob & { a: number; total: number }) | null; queue: DlJob[]; error: string | null; measuring: string | null; hold: DownloadHold };
let st: DlState = { active: null, queue: [], error: null, measuring: null, hold: 'ok' };
const subs = new Set<() => void>();
const set = (p: Partial<DlState>) => {
  st = { ...st, ...p };
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const useDownloads = () => useSyncExternalStore(subscribe, () => st, () => st);
let cancelled = false;
let running = false;
let yieldAfterBatch = false;
let openSurah: number | null = null;
let gate: { wifiOnly: boolean; net: NetKind; free: number | null } = { wifiOnly: true, net: 'unknown', free: null };

export function setDownloadGate(next: { wifiOnly: boolean; net: NetKind; free: number | null }) {
  gate = next;
  const hold = downloadHold(gate);
  set({ hold });
  if (hold === 'ok' && st.queue.length) void pump();
}

/** La sourate affichée passe devant le reste. Une sourate déjà en cours se termine par le lot actuel, puis cède la place. */
export function preferSurah(rid: string, s: number) {
  openSurah = s;
  const known = (entry(dlManifest.get(), rid, s)?.v ?? 0) >= ayahCount(s);
  if (known) return;
  if (st.active?.rid === rid && st.active.s === s) return;
  if (st.active) yieldAfterBatch = true;
  const rest = st.queue.filter((j) => !(j.rid === rid && j.s === s));
  set({ queue: [{ rid, s }, ...rest], error: null, hold: downloadHold(gate) });
  if (downloadHold(gate) === 'ok') void pump();
}

/** Met en file le récitateur choisi : sourate ouverte d’abord, puis le reste. Ne fait rien hors Wi-Fi ou sans place. */
export async function ensureReciterDownload(rid: string) {
  await dlManifest.load();
  const free = await freeSpace();
  gate = { ...gate, free };
  const hold = downloadHold(gate);
  set({ hold });
  if (hold !== 'ok') return;
  const m = dlManifest.get();
  const order = autoOrder((s) => isComplete(entry(m, rid, s)), openSurah);
  queueDownload(rid, order);
}

async function fetchVerse(rid: string, s: number, a: number): Promise<number> {
  const r = reciterById(rid);
  try {
    return await saveVerse(rid, s, a, ayahUrl(r, s, a));
  } catch (e) {
    const fb = ayahFallbackUrl(r, s, a);
    if (!fb) throw e;
    // l’URL de secours est enregistrée sous la clé principale (même fichier MP3, autre miroir)
    return await saveVerse(rid, s, a, fb).catch(() => {
      throw e;
    });
  }
}

async function runSurah(job: DlJob) {
  const total = ayahCount(job.s);
  await dlManifest.load();
  let a = (entry(dlManifest.get(), job.rid, job.s)?.v ?? 0) + 1;
  while (a <= total && !cancelled) {
    if (yieldAfterBatch) {
      yieldAfterBatch = false;
      const rest = st.queue.filter((j) => !(j.rid === job.rid && j.s === job.s));
      set({ queue: [...rest, job] });
      break;
    }
    const hold = downloadHold({ ...gate, free: await freeSpace() });
    if (hold !== 'ok') {
      const rest = st.queue.filter((j) => !(j.rid === job.rid && j.s === job.s));
      set({ hold, queue: [job, ...rest] });
      cancelled = true;
      break;
    }
    // lots de 4 en parallèle, enregistrés ensuite dans l’ordre
    const batch = Array.from({ length: Math.min(4, total - a + 1) }, (_, i) => a + i);
    set({ active: { ...job, a, total } });
    const sizes = await mapLimit(batch, 4, (v) => fetchVerse(job.rid, job.s, v));
    dlManifest.set((m) => sizes.reduce((acc, b, i) => addVerse(acc, job.rid, job.s, batch[i], total, b, Date.now()), m));
    a += batch.length;
  }
}

async function pump() {
  if (running) return;
  running = true;
  cancelled = false;
  try {
    while (st.queue.length && !cancelled) {
      const [job, ...rest] = st.queue;
      set({ queue: rest, error: null });
      try {
        await runSurah(job);
      } catch (e) {
        set({ error: `${job.s}: ${e instanceof Error ? e.message : String(e)}` });
        cancelled = true;
      }
    }
  } finally {
    running = false;
    const stopped = cancelled;
    cancelled = false;
    set({ active: null, ...(stopped && downloadHold(gate) === 'ok' ? { queue: [] } : {}) });
    if (!stopped && st.queue.length && downloadHold(gate) === 'ok') void pump();
  }
}

/** Ajoute des sourates à la file (doublons et sourates complètes ignorés). */
export function queueDownload(rid: string, surahs: number[]) {
  const m = dlManifest.get();
  const known = new Set([...(st.active ? [`${st.active.rid}:${st.active.s}`] : []), ...st.queue.map((j) => `${j.rid}:${j.s}`)]);
  const add = surahs.filter((s) => !known.has(`${rid}:${s}`) && (entry(m, rid, s)?.v ?? 0) < ayahCount(s)).map((s) => ({ rid, s }));
  if (!add.length) return;
  set({ queue: [...st.queue, ...add], error: null });
  void pump();
}

export function cancelDownloads() {
  cancelled = true;
  set({ queue: [] });
}

export async function deleteDownloadedSurah(rid: string, s: number) {
  if (st.active?.rid === rid && st.active.s === s) cancelDownloads();
  set({ queue: st.queue.filter((j) => !(j.rid === rid && j.s === s)) });
  await deleteSurah(rid, s, ayahCount(s), reciterById(rid).folder);
  dlManifest.set((m) => removeSurah(m, rid, s));
}

export async function deleteDownloadedReciter(rid: string) {
  if (st.active?.rid === rid || st.queue.some((j) => j.rid === rid)) cancelDownloads();
  await deleteReciter(rid, reciterById(rid).folder);
  dlManifest.set((m) => removeReciter(m, rid));
}

// ——— Mesure des tailles (HEAD Content-Length) ———
async function headSize(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const n = Number(r.headers.get('content-length'));
    return r.ok && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Mesure la taille de chaque sourate (somme des versets) ; les résultats sont mémorisés. */
export async function measureSurahs(rid: string, surahs: number[], onProgress?: (done: number, total: number) => void) {
  await dlSizes.load();
  const todo = surahs.filter((s) => dlSizes.get()[rid]?.[s] == null);
  if (!todo.length || st.measuring) return;
  const r = reciterById(rid);
  set({ measuring: rid });
  let done = 0;
  try {
    for (const s of todo) {
      const n = ayahCount(s);
      const sizes = await mapLimit(Array.from({ length: n }, (_, i) => i + 1), 6, (a) => headSize(ayahUrl(r, s, a)));
      if (sizes.every((x) => x != null)) {
        const bytes = (sizes as number[]).reduce((x, y) => x + y, 0);
        dlSizes.set((t) => ({ ...t, [rid]: { ...(t[rid] ?? {}), [s]: bytes } }));
      }
      onProgress?.(++done, todo.length);
    }
  } finally {
    set({ measuring: null });
  }
}
