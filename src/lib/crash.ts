import { env } from './config';

/**
 * Journal de crash. Désactivé tant que EXPO_PUBLIC_SENTRY_DSN est absent ou YOUR_*.
 * Aucun envoi au démarrage : un rapport part seulement après une erreur interceptée,
 * sans contenu religieux ni donnée de pratique.
 */
const dsn = env('EXPO_PUBLIC_SENTRY_DSN', process.env.EXPO_PUBLIC_SENTRY_DSN);
export const sentryConfigured = dsn.configured;
export const sentryEnv = dsn;

function parseDsn(value: string): { storeUrl: string; key: string } | null {
  try {
    const u = new URL(value);
    const key = decodeURIComponent(u.username);
    const project = u.pathname.replace(/\//g, '');
    if (!key || !project || !u.host) return null;
    return { key, storeUrl: `${u.protocol}//${u.host}/api/${project}/store/` };
  } catch {
    return null;
  }
}

function eventId(): string {
  const bytes = new Uint8Array(16);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) cryptoObj.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Signale une erreur. Ne lance jamais, ne bloque jamais l'interface. */
export function reportCrash(error: unknown, context?: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error('[Zikru]', context ?? 'crash', err);
  if (!dsn.configured || !dsn.value) return;
  const parsed = parseDsn(dsn.value);
  if (!parsed || typeof fetch !== 'function') return;
  const body = JSON.stringify({
    event_id: eventId(),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    message: err.message.slice(0, 500),
    exception: { values: [{ type: err.name || 'Error', value: err.message.slice(0, 500) }] },
    tags: context ? { context: context.slice(0, 80) } : undefined,
  });
  void fetch(parsed.storeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=zikru-passe1/1.0`,
    },
    body,
  }).catch(() => {});
}
