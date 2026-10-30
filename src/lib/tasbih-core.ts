/** Logique pure du compteur de tasbih (testée par scripts/test-ble.mjs et scripts/test-tasbih-history.mjs). */
export type ClickSource = 'manuel' | 'bluetooth' | 'clavier';
/**
 * Ligne d'historique. `at` = fin (dernier enregistrement), `start` = début si la ligne regroupe plusieurs
 * enregistrements consécutifs, `parts` = nombre d'enregistrements regroupés, `sealed` = ligne close
 * explicitement (bouton « Enregistrer », remise à zéro, changement de dhikr) : rien ne s'y ajoute ensuite.
 */
export type TasbihSession = {
  id: string;
  dhikrId: string;
  count: number;
  target: number;
  at: string;
  source?: 'manuel' | 'bluetooth' | 'mixte';
  deviceCount?: number;
  start?: string;
  parts?: number;
  sealed?: boolean;
};
/** firstAt / lastAt : dates (ms) du premier et du dernier appui de la session en cours (journal). */
export type Tasbih = { count: number; target: number; dhikrId: string; total: number; sessions: TasbihSession[]; deviceCount?: number; firstAt?: number; lastAt?: number };

/** Au-delà de cet écart sans appui, une nouvelle ligne d'historique commence (5 min). */
export const SESSION_GAP_MS = 5 * 60 * 1000;
export const HISTORY_MAX = 200;

/** Ajoute n appuis ; indique si un cycle (33/99/100…) vient d'être complété. */
export function applyClicks(t: Tasbih, n: number, source: ClickSource): { next: Tasbih; cycleCompleted: boolean; cycles: number } {
  if (n <= 0) return { next: t, cycleCompleted: false, cycles: 0 };
  const count = t.count + n;
  const cycles = t.target > 0 ? Math.floor(count / t.target) - Math.floor(t.count / t.target) : 0;
  const dev = (t.deviceCount ?? 0) + (source === 'manuel' ? 0 : n);
  return { next: { ...t, count, total: t.total + n, deviceCount: dev }, cycleCompleted: cycles > 0, cycles };
}

const ms = (iso: string | undefined) => {
  const v = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(v) ? v : NaN;
};

/** Deux lignes consécutives (older plus ancienne) peuvent-elles n'en faire qu'une ? */
export function canJoin(older: TasbihSession, newer: Pick<TasbihSession, 'dhikrId' | 'source' | 'sealed' | 'at' | 'start'>, gapMs = SESSION_GAP_MS): boolean {
  if (older.sealed || newer.sealed) return false;
  if (older.dhikrId !== newer.dhikrId || (older.source ?? 'manuel') !== (newer.source ?? 'manuel')) return false;
  const a = ms(older.at);
  const b = ms(newer.start ?? newer.at);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return b - a <= gapMs && b - a >= -gapMs;
}

function join2(older: TasbihSession, newer: TasbihSession): TasbihSession {
  const late = ms(newer.at) >= ms(older.at);
  return {
    ...older,
    count: older.count + newer.count,
    deviceCount: (older.deviceCount ?? 0) + (newer.deviceCount ?? 0),
    target: newer.target,
    at: late ? newer.at : older.at,
    start: older.start ?? older.at,
    parts: (older.parts ?? 1) + (newer.parts ?? 1),
  };
}

export type CloseOpts = {
  /** Clôture explicite (bouton « Enregistrer ») : ligne séparée et close. Sinon (fin d'étape, sortie…) : regroupement. */
  explicit?: boolean;
  gapMs?: number;
};

/**
 * Clôt la session courante dans l'historique (source manuelle, appareil ou mixte).
 * Une clôture automatique s'ajoute à la ligne précédente si c'est le même dhikr, la même source,
 * sans clôture explicite entre les deux et avec moins de 5 min d'écart : une seule ligne par séance.
 * Le journal des appuis et le total ne sont jamais modifiés ici.
 */
export function closeSession(t: Tasbih, id: string, at: string, opts: CloseOpts = {}): Tasbih {
  if (t.count === 0) return t;
  const dev = Math.min(t.deviceCount ?? 0, t.count);
  const source: TasbihSession['source'] = dev === 0 ? 'manuel' : dev >= t.count ? 'bluetooth' : 'mixte';
  const s: TasbihSession = { id, dhikrId: t.dhikrId, count: t.count, target: t.target, at, source, deviceCount: dev };
  if (t.firstAt != null && Number.isFinite(t.firstAt) && t.firstAt < ms(at)) s.start = new Date(t.firstAt).toISOString();
  if (opts.explicit) s.sealed = true;
  const head = t.sessions[0];
  const sessions = head && !opts.explicit && canJoin(head, s, opts.gapMs) ? [join2(head, s), ...t.sessions.slice(1)] : [s, ...t.sessions].slice(0, HISTORY_MAX);
  return { ...t, count: 0, deviceCount: 0, firstAt: undefined, lastAt: undefined, sessions };
}

/** Ferme la dernière ligne : la prochaine séance commencera une nouvelle ligne. */
export function sealHead(t: Tasbih): Tasbih {
  const head = t.sessions[0];
  if (!head || head.sealed) return t;
  return { ...t, sessions: [{ ...head, sealed: true }, ...t.sessions.slice(1)] };
}

/** Remise à zéro du compte affiché (les appuis restent dans le journal et le total). */
export function resetCount(t: Tasbih): Tasbih {
  return { ...sealHead(t), count: 0, deviceCount: 0, firstAt: undefined, lastAt: undefined };
}

/** Changement de dhikr : la ligne précédente est close. */
export function switchDhikr(t: Tasbih, dhikrId: string, target = t.target): Tasbih {
  const base = dhikrId !== t.dhikrId ? sealHead(t) : t;
  return { ...base, dhikrId, target };
}

/**
 * Affichage : regroupe les lignes déjà enregistrées de façon fragmentée (anciennes versions : une ligne par
 * appui Bluetooth). Non destructif : les données stockées et le total ne changent pas.
 * `sessions` est trié du plus récent au plus ancien.
 */
export function groupSessions(sessions: TasbihSession[], gapMs = SESSION_GAP_MS): TasbihSession[] {
  const out: TasbihSession[] = [];
  // du plus ancien au plus récent, pour joindre chaque ligne à la précédente
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    const last = out[out.length - 1];
    if (last && canJoin(last, s, gapMs)) out[out.length - 1] = { ...join2(last, s), id: last.id, sealed: s.sealed };
    else out.push(s);
  }
  return out.reverse();
}
