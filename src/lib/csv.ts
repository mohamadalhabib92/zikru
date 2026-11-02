import type { TasbihSession } from './tasbih-core';

/** Champ CSV (RFC 4180) + garde contre l'injection de formules dans les tableurs (=, +, -, @ en tête). */
export function csvField(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const csvRows = (rows: unknown[][]) => rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';

/** v2 — Historique du tasbih en CSV (fichier local, rien n'est envoyé). Le BOM UTF-8 est ajouté par downloadText (web). */
export function tasbihCsv(sessions: TasbihSession[]): string {
  const head = ['date', 'debut', 'dhikr', 'compte', 'objectif', 'source'];
  const rows = [...sessions].sort((a, b) => a.at.localeCompare(b.at)).map((s) => [s.at, s.start ?? '', s.dhikrId, s.count, s.target, s.source ?? 'manuel']);
  return csvRows([head, ...rows]);
}
