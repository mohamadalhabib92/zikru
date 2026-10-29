/**
 * Journal de diagnostic Bluetooth (mémoire uniquement, jamais envoyé) :
 * événements du scan, de la connexion, des abonnements et dernière erreur.
 * Alimenté par les transports (web / natif) et par le gestionnaire ; lu par l'écran /ble-diag.
 */
import type { GattChar } from './core';

export type DiagLevel = 'info' | 'warn' | 'error';
export type DiagEntry = { t: number; level: DiagLevel; tag: string; msg: string };
export type DiagSeen = { id: string; name: string | null; rssi: number | null; services: string[]; count: number; last: number };

const MAX = 300;
let entries: DiagEntry[] = [];
let lastError: DiagEntry | null = null;
const seen = new Map<string, DiagSeen>();
let gatt: { id: string; name: string | null; chars: GattChar[]; mtu?: number | null } | null = null;
const subs = new Set<() => void>();
let rev = 0;
let notifyQueued = false;

function emit() {
  rev++;
  if (notifyQueued) return;
  notifyQueued = true;
  // Regroupe les rafales (scan) en une seule notification.
  setTimeout(() => {
    notifyQueued = false;
    subs.forEach((f) => f());
  }, 120);
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) {
    const ext = e as Error & { errorCode?: number; reason?: string | null; iosErrorCode?: number | null; androidErrorCode?: number | null; attErrorCode?: number | null };
    const codes = [ext.errorCode != null ? `code ${ext.errorCode}` : '', ext.iosErrorCode != null ? `iOS ${ext.iosErrorCode}` : '', ext.androidErrorCode != null ? `Android ${ext.androidErrorCode}` : '', ext.attErrorCode != null ? `ATT ${ext.attErrorCode}` : '']
      .filter(Boolean)
      .join(', ');
    return `${e.message}${ext.reason && ext.reason !== e.message ? ` — ${ext.reason}` : ''}${codes ? ` (${codes})` : ''}`;
  }
  return String(e);
}

export const diag = {
  log(tag: string, msg: string, level: DiagLevel = 'info') {
    const e: DiagEntry = { t: Date.now(), level, tag, msg };
    entries.push(e);
    if (entries.length > MAX) entries = entries.slice(-MAX);
    if (level === 'error') lastError = e;
    emit();
  },
  error(tag: string, e: unknown) {
    diag.log(tag, errMsg(e), 'error');
  },
  seen(r: { id: string; name: string | null; rssi: number | null; services?: string[] }) {
    const p = seen.get(r.id);
    const isNew = !p;
    seen.set(r.id, {
      id: r.id,
      name: r.name ?? p?.name ?? null,
      rssi: r.rssi ?? p?.rssi ?? null,
      services: [...new Set([...(p?.services ?? []), ...(r.services ?? [])])],
      count: (p?.count ?? 0) + 1,
      last: Date.now(),
    });
    if (isNew) diag.log('scan', `vu ${r.name ?? '(sans nom)'} · ${r.id} · RSSI ${r.rssi ?? '?'}${r.services?.length ? ` · ${r.services.join(', ')}` : ''}`);
    else emit();
  },
  clearSeen() {
    seen.clear();
    emit();
  },
  setGatt(g: typeof gatt) {
    gatt = g;
    if (g) diag.log('gatt', `${g.chars.length} caractéristique(s) sur ${new Set(g.chars.map((c) => c.service)).size} service(s)${g.mtu ? ` · MTU ${g.mtu}` : ''}`);
    else emit();
  },
  snapshot() {
    return { rev, entries: entries.slice(), lastError, seen: [...seen.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)), gatt };
  },
  clear() {
    entries = [];
    lastError = null;
    emit();
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
  /** Texte copiable (aucune donnée personnelle : identifiants d'appareils BLE et événements techniques). */
  text(header: Record<string, string | number | boolean | null | undefined>) {
    const iso = (t: number) => new Date(t).toISOString();
    const lines: string[] = ['Zikru · diagnostic Bluetooth', ...Object.entries(header).map(([k, v]) => `${k}: ${v ?? '—'}`), ''];
    lines.push(`Dernière erreur: ${lastError ? `${iso(lastError.t)} [${lastError.tag}] ${lastError.msg}` : '—'}`, '');
    if (gatt) {
      lines.push(`GATT ${gatt.name ?? '(sans nom)'} ${gatt.id}${gatt.mtu ? ` MTU ${gatt.mtu}` : ''}`);
      for (const c of gatt.chars) lines.push(`  ${c.service} / ${c.uuid}${c.notify ? ' notify' : ''}${c.read ? ' read' : ''}`);
      lines.push('');
    }
    lines.push(`Appareils vus (${seen.size}):`);
    for (const d of [...seen.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))) lines.push(`  ${d.rssi ?? '?'} dBm  ${d.name ?? '(sans nom)'}  ${d.id}${d.services.length ? `  [${d.services.join(', ')}]` : ''}`);
    lines.push('', 'Journal:');
    for (const e of entries) lines.push(`${iso(e.t)} ${e.level.toUpperCase()} [${e.tag}] ${e.msg}`);
    return lines.join('\n');
  },
};
