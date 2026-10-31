/**
 * Stockage hors ligne de la récitation (web/PWA) : Cache Storage « zikru-audio-v1 », clé = URL EveryAyah.
 * Le service worker de la PWA répond depuis ce cache (y compris les requêtes Range de Safari) ; hors PWA
 * installée, la lecture reste en ligne. Rien n’est envoyé : le cache vit dans le navigateur de l’utilisateur.
 */
export const AUDIO_CACHE = 'zikru-audio-v1';
export const AUDIO_STORE = 'cache' as const;

const hasCaches = () => typeof caches !== 'undefined';
let persisted = false;
const persist = () => {
  if (persisted) return;
  persisted = true;
  try {
    void navigator.storage?.persist?.();
  } catch {}
};

export async function saveVerse(_rid: string, _s: number, _a: number, url: string): Promise<number> {
  if (!hasCaches()) throw new Error('stockage indisponible');
  persist();
  const c = await caches.open(AUDIO_CACHE);
  const hit = await c.match(url);
  if (hit) {
    const b = await hit.clone().blob();
    if (b.size > 512) return b.size;
  }
  const r = await fetch(url, { mode: 'cors' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob = await r.blob();
  if (blob.size < 512) throw new Error('fichier audio invalide');
  await c.put(url, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(blob.size) } }));
  return blob.size;
}

/** Sur le web l’URL d’origine est conservée : le service worker la sert depuis le cache. */
export function localUri(_rid: string, _s: number, _a: number): string | null {
  return null;
}

const keysFor = async (match: (u: string) => boolean) => {
  if (!hasCaches()) return [];
  const c = await caches.open(AUDIO_CACHE);
  return (await c.keys()).filter((k) => match(k.url)).map((k) => [c, k] as const);
};

export async function deleteSurah(_rid: string, s: number, _total: number, folder?: string): Promise<void> {
  const tag = `/${String(s).padStart(3, '0')}`;
  for (const [c, k] of await keysFor((u) => (!folder || u.includes(`/${folder}/`)) && new URL(u).pathname.split('/').pop()!.startsWith(tag.slice(1)))) await c.delete(k);
}

export async function deleteReciter(_rid: string, folder?: string): Promise<void> {
  for (const [c, k] of await keysFor((u) => !!folder && u.includes(`/${folder}/`))) await c.delete(k);
}

export async function freeSpace(): Promise<number | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e?.quota != null && e.usage != null ? Math.max(0, e.quota - e.usage) : null;
  } catch {
    return null;
  }
}
