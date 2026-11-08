import { Directory, File, Paths } from 'expo-file-system';
import { verseFile } from './audio-dl-core';

/**
 * Stockage hors ligne de la récitation (iOS/Android) : Documents/audio/<récitateur>/SSSAAA.mp3.
 * Les fichiers restent sur l’appareil (jamais envoyés) et sont supprimables depuis « Téléchargements ».
 */
const root = () => new Directory(Paths.document, 'audio');
const dirOf = (rid: string, make = false) => {
  const r = root();
  if (make && !r.exists) r.create();
  const d = new Directory(r, rid.replace(/[^\w-]/g, '_'));
  if (make && !d.exists) d.create();
  return d;
};
const fileOf = (rid: string, s: number, a: number, make = false) => new File(dirOf(rid, make), verseFile(s, a));

export const AUDIO_STORE = 'files' as const;

/** Télécharge un verset ; renvoie sa taille en octets. */
export async function saveVerse(rid: string, s: number, a: number, url: string): Promise<number> {
  const f = await File.downloadFileAsync(url, fileOf(rid, s, a, true), { idempotent: true });
  const size = f.size ?? 0;
  if (size < 512) {
    try {
      f.delete();
    } catch {}
    throw new Error('fichier audio invalide');
  }
  return size;
}

/** URI locale du verset s’il est présent sur l’appareil. */
export function localUri(rid: string, s: number, a: number): string | null {
  try {
    const f = fileOf(rid, s, a);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}

export async function deleteSurah(rid: string, s: number, total: number, _folder?: string): Promise<void> {
  for (let a = 1; a <= total; a++) {
    try {
      const f = fileOf(rid, s, a);
      if (f.exists) f.delete();
    } catch {}
  }
}

export async function deleteReciter(rid: string, _folder?: string): Promise<void> {
  try {
    const d = dirOf(rid);
    if (d.exists) d.delete();
  } catch {}
}

/** Espace libre sur l’appareil (octets), ou null. */
export async function freeSpace(): Promise<number | null> {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return null;
  }
}
