/** Cache de gros textes (web) : Cache API du navigateur, hors du quota localStorage. */
const NAME = 'zikru-texts-v1';
const url = (k: string) => `/__zikru-cache/${encodeURIComponent(k)}`;

export async function readText(key: string): Promise<string | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const r = await (await caches.open(NAME)).match(url(key));
    return r ? await r.text() : null;
  } catch {
    return null;
  }
}

export async function writeText(key: string, value: string): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    await (await caches.open(NAME)).put(url(key), new Response(value, { headers: { 'content-type': 'text/plain;charset=utf-8' } }));
  } catch {}
}
