/**
 * v2 — Requêtes GET idempotentes : délai maximal + nouvel essai à délai exponentiel.
 * Réessaie seulement sur erreur réseau, délai dépassé, 429 ou 5xx ; jamais sur 4xx (erreur définitive).
 * À n'utiliser que pour des lectures (GET/HEAD) : aucune écriture n'est rejouée.
 */
export type RetryOpts = { timeoutMs?: number; retries?: number; baseMs?: number; maxMs?: number; sleep?: (ms: number) => Promise<void>; fetchImpl?: typeof fetch };

export const retryDelay = (attempt: number, baseMs = 500, maxMs = 8000) => Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
export const isRetryableStatus = (s: number) => s === 408 || s === 429 || s >= 500;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchWithRetry(url: string, init: RequestInit = {}, o: RetryOpts = {}): Promise<Response> {
  const retries = o.retries ?? 2;
  const f = o.fetchImpl ?? fetch;
  const sleep = o.sleep ?? wait;
  let last: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), o.timeoutMs ?? 10_000) : null;
    try {
      const r = await f(url, { ...init, signal: ctl?.signal ?? init.signal });
      if (!isRetryableStatus(r.status) || attempt === retries) return r;
      last = new Error('HTTP ' + r.status);
    } catch (e) {
      last = e;
      if (attempt === retries) throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
    await sleep(retryDelay(attempt, o.baseMs, o.maxMs));
  }
  throw last instanceof Error ? last : new Error('fetchWithRetry');
}
