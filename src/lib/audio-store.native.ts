import { Directory, File, Paths } from 'expo-file-system';
import { verseFile } from './audio-dl-core';

/**
 * Récitation hors ligne : Cache/quran-audio/<récitateur>/SSSAAA.mp3.
 * Le dossier Cache n’entre pas dans la sauvegarde iCloud ni iTunes (fichiers re-téléchargeables, règle Apple).
 * Une copie déjà enregistrée dans Documents/audio (ancienne version) reste lisible, jamais déplacée.
 */
const cacheRoot = () => new Directory(Paths.cache, 'quran-audio');
const legacyRoot = () => new Directory(Paths.document, 'audio');
const child = (root: Directory, rid: string, make: boolean) => {
  if (make && !root.exists) root.create();
  const d = new Directory(root, rid.replace(/[^\w-]/g, '_'));
  if (make && !d.exists) d.create();
  return d;
};
const fileOf = (rid: string, s: number, a: number, make = false) => {
  const name = verseFile(s, a);
  const fresh = new File(child(cacheRoot(), rid, make), name);
  if (make || fresh.exists) return fresh;
  try {
    const old = new File(child(legacyRoot(), rid, false), name);
    if (old.exists) return old;
  } catch {}
  return fresh;
};

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
    const name = verseFile(s, a);
    for (const root of [cacheRoot, legacyRoot]) {
      try {
        const f = new File(child(root(), rid, false), name);
        if (f.exists) f.delete();
      } catch {}
    }
  }
}

export async function deleteReciter(rid: string, _folder?: string): Promise<void> {
  for (const root of [cacheRoot, legacyRoot]) {
    try {
      const d = child(root(), rid, false);
      if (d.exists) d.delete();
    } catch {}
  }
}

/** Espace libre sur l’appareil (octets), ou null. */
export async function freeSpace(): Promise<number | null> {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return null;
  }
}
