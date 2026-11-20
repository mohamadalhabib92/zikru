/**
 * Règles du téléchargement automatique de la récitation (module pur, sans réseau).
 * Un seul récitateur à la fois : celui choisi dans le lecteur (Alafasy par défaut).
 * Wi-Fi seulement, sauf si l’utilisateur autorise le réseau mobile.
 * On laisse au moins 200 Mo libres. La sourate ouverte passe devant les autres.
 */
export const AUDIO_FREE_FLOOR = 200_000_000;

export type NetKind = 'wifi' | 'cellular' | 'none' | 'unknown';
export type DownloadHold = 'ok' | 'wifi' | 'offline' | 'disk';

export function downloadHold(opts: { wifiOnly: boolean; net: NetKind; free: number | null }): DownloadHold {
  if (opts.free != null && opts.free < AUDIO_FREE_FLOOR) return 'disk';
  if (opts.net === 'none') return 'offline';
  if (opts.wifiOnly && opts.net !== 'wifi') return 'wifi';
  return 'ok';
}

/** Prochaine sourate à prendre : celle qui est ouverte, sinon la première incomplète. */
export function nextSurahToFetch(done: (s: number) => boolean, priority: number | null): number | null {
  if (priority != null && priority >= 1 && priority <= 114 && !done(priority)) return priority;
  for (let s = 1; s <= 114; s++) if (!done(s)) return s;
  return null;
}

/**
 * File automatique : uniquement le récitateur choisi. Les autres récitateurs ne sont ni téléchargés ni retirés.
 * L’ordre reste : sourate prioritaire, puis 1..114, sans les sourates déjà complètes.
 */
export function reciterDownloadPlan(selected: string, done: (s: number) => boolean, priority: number | null): { rid: string; surahs: number[] } {
  return { rid: selected, surahs: autoOrder(done, priority) };
}

export function autoOrder(done: (s: number) => boolean, priority: number | null): number[] {
  const first = nextSurahToFetch(done, priority);
  if (first == null) return [];
  const rest: number[] = [];
  for (let s = 1; s <= 114; s++) if (s !== first && !done(s)) rest.push(s);
  return [first, ...rest];
}
