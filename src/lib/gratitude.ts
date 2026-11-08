/**
 * Journal de gratitude (shukr) — logique pure, sans React ni stockage.
 * Chaque soir : jusqu’à 3 bienfaits du jour (pastille rapide et/ou texte libre).
 * Privé, sur l’appareil : aucune série obligatoire, aucun score, aucun partage.
 */
export const MAX_PER_DAY = 3;
export const MAX_TEXT = 140;
export const GRATITUDE_KEY = 'be-gratitude';

/** Pastilles rapides (libellés d’interface, traduits par le catalogue ; aucun texte religieux). */
export const CHIPS = [
  { id: 'health', label: 'La santé', icon: 'fitness-outline' },
  { id: 'family', label: 'Ma famille', icon: 'home-outline' },
  { id: 'prayer', label: 'Une prière', icon: 'moon-outline' },
  { id: 'quran', label: 'Le Coran', icon: 'book-outline' },
  { id: 'food', label: 'Un repas', icon: 'restaurant-outline' },
  { id: 'friends', label: 'Un ami', icon: 'people-outline' },
  { id: 'rest', label: 'Le repos', icon: 'bed-outline' },
  { id: 'work', label: 'Le travail ou les études', icon: 'briefcase-outline' },
  { id: 'nature', label: 'La nature', icon: 'leaf-outline' },
  { id: 'safety', label: 'La sécurité', icon: 'shield-checkmark-outline' },
  { id: 'kindness', label: 'Un geste de bonté', icon: 'heart-outline' },
  { id: 'ease', label: 'Une difficulté allégée', icon: 'sunny-outline' },
] as const;
export type ChipId = (typeof CHIPS)[number]['id'];
const CHIP_IDS = new Set<string>(CHIPS.map((c) => c.id));

/** Un bienfait : une pastille (`k`), un texte (`t`), ou les deux. */
export type Blessing = { k?: ChipId; t?: string };
export type Journal = { v: 1; days: Record<string, Blessing[]>; closed?: Record<string, true> };
export const EMPTY_JOURNAL: Journal = { v: 1, days: {} };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const two = (n: number) => String(n).padStart(2, '0');
/** Jour civil local AAAA-MM-JJ. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

const cleanText = (t?: string) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '');
function cleanBlessing(x: unknown): Blessing | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as { k?: unknown; t?: unknown };
  const k = typeof o.k === 'string' && CHIP_IDS.has(o.k) ? (o.k as ChipId) : undefined;
  const t = cleanText(typeof o.t === 'string' ? o.t : undefined) || undefined;
  return k || t ? { ...(k ? { k } : {}), ...(t ? { t } : {}) } : null;
}

/** Valeur stockée → journal valide (tolère données anciennes ou abîmées). */
export function normalizeJournal(x: unknown): Journal {
  const days: Record<string, Blessing[]> = {};
  const closed: Record<string, true> = {};
  const o = (x && typeof x === 'object' ? x : {}) as { days?: unknown; closed?: unknown };
  if (o.days && typeof o.days === 'object')
    for (const [k, v] of Object.entries(o.days as Record<string, unknown>)) {
      if (!DAY_RE.test(k) || !Array.isArray(v)) continue;
      const list = v.map(cleanBlessing).filter((b): b is Blessing => !!b).slice(0, MAX_PER_DAY);
      if (list.length) days[k] = list;
    }
  if (o.closed && typeof o.closed === 'object') for (const k of Object.keys(o.closed as object)) if (days[k]) closed[k] = true;
  return Object.keys(closed).length ? { v: 1, days, closed } : { v: 1, days };
}

export const blessingsOf = (j: Journal, day: string) => j.days[day] ?? [];
export const isFull = (j: Journal, day: string) => blessingsOf(j, day).length >= MAX_PER_DAY;
export const hasChip = (j: Journal, day: string, k: ChipId) => blessingsOf(j, day).some((b) => b.k === k && !b.t);

/** Ajoute un bienfait (refusé au-delà de 3, ou vide, ou pastille seule déjà notée). Renvoie le même objet si rien ne change. */
export function addBlessing(j: Journal, day: string, b: Blessing): Journal {
  const c = cleanBlessing(b);
  const cur = blessingsOf(j, day);
  if (!c || !DAY_RE.test(day) || cur.length >= MAX_PER_DAY) return j;
  if (!c.t && c.k && hasChip(j, day, c.k)) return j;
  return { ...j, days: { ...j.days, [day]: [...cur, c] } };
}

/** Pastille rapide : un geste ajoute, un second geste retire. */
export function toggleChip(j: Journal, day: string, k: ChipId): Journal {
  if (hasChip(j, day, k)) {
    const cur = blessingsOf(j, day);
    const i = cur.findIndex((b) => b.k === k && !b.t);
    return removeBlessing(j, day, i);
  }
  return addBlessing(j, day, { k });
}

export function removeBlessing(j: Journal, day: string, index: number): Journal {
  const cur = blessingsOf(j, day);
  if (index < 0 || index >= cur.length) return j;
  const next = cur.filter((_, i) => i !== index);
  if (next.length) return { ...j, days: { ...j.days, [day]: next } };
  return deleteDay(j, day);
}

export function deleteDay(j: Journal, day: string): Journal {
  if (!j.days[day]) return j;
  const days = { ...j.days };
  delete days[day];
  const closed = { ...(j.closed ?? {}) };
  delete closed[day];
  return Object.keys(closed).length ? { v: 1, days, closed } : { v: 1, days };
}

/** Clôture de la séance (« al-ḥamdu li-llāh ») : seulement si au moins un bienfait est noté. */
export function closeDay(j: Journal, day: string): Journal {
  if (!blessingsOf(j, day).length || j.closed?.[day]) return j;
  return { ...j, closed: { ...(j.closed ?? {}), [day]: true } };
}
export function reopenDay(j: Journal, day: string): Journal {
  if (!j.closed?.[day]) return j;
  const closed = { ...j.closed };
  delete closed[day];
  return Object.keys(closed).length ? { ...j, closed } : { v: 1, days: j.days };
}
export const isClosed = (j: Journal, day: string) => !!j.closed?.[day];

/** Jours notés, du plus récent au plus ancien. */
export const notedDays = (j: Journal) => Object.keys(j.days).sort().reverse();

/**
 * Résumé doux : nombre de soirs notés et de bienfaits, sur 7 jours et au total.
 * Volontairement AUCUNE série (streak) : un soir sans note ne « casse » rien.
 */
export function summary(j: Journal, today: string) {
  const days = notedDays(j);
  const t = new Date(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10), 12);
  const from = dayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 6, 12));
  const week = days.filter((d) => d >= from && d <= today);
  return {
    evenings: days.length,
    blessings: days.reduce((n, d) => n + j.days[d].length, 0),
    weekEvenings: week.length,
    weekBlessings: week.reduce((n, d) => n + j.days[d].length, 0),
  };
}

/** Pastilles les plus notées (pour un rappel discret « ce qui revient souvent »). */
export function topChips(j: Journal, n = 3): { k: ChipId; count: number }[] {
  const c = new Map<ChipId, number>();
  for (const list of Object.values(j.days)) for (const b of list) if (b.k) c.set(b.k, (c.get(b.k) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k, count]) => ({ k, count }));
}

/** Heures proposées pour le rappel du soir (désactivé par défaut). */
export const GRATITUDE_TIMES = ['20:00', '20:30', '21:00', '21:30', '22:00'] as const;
