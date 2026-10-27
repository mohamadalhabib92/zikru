/** Web : fichiers audio importés par l'utilisateur, stockés localement dans IndexedDB (jamais envoyés). */
import { uid } from './storage';
import { titleFromName, type Track } from './songs-types';

const DB = 'zikru-songs';
const STORE = 'files';

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const q = fn(d.transaction(STORE, mode).objectStore(STORE));
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

export async function importFiles(): Promise<Track[]> {
  if (typeof document === 'undefined') return [];
  const files = await new Promise<File[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
  const out: Track[] = [];
  for (const f of files) {
    const id = uid('song-');
    await tx('readwrite', (s) => s.put(f, id));
    out.push({ id, title: titleFromName(f.name), kind: 'file', uri: `idb:${id}`, addedAt: Date.now() });
  }
  return out;
}

const urls = new Map<string, string>();
export async function resolveUri(t: Track): Promise<string | null> {
  if (t.kind === 'url') return t.uri;
  if (urls.has(t.id)) return urls.get(t.id)!;
  const blob = await tx<Blob | undefined>('readonly', (s) => s.get(t.id) as IDBRequest<Blob | undefined>);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(t.id, u);
  return u;
}

export async function removeFile(t: Track) {
  if (t.kind !== 'file') return;
  const u = urls.get(t.id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(t.id);
  await tx('readwrite', (s) => s.delete(t.id));
}
