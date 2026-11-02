/**
 * v2 §3 — Événements du calendrier hégirien (logique pure, hors ligne).
 *
 * Source unique des dates : `hijri.ts` (même calendrier et même décalage que tous les écrans).
 * Seules des DATES sont produites ici : aucun texte religieux, aucun hadith, aucun jugement.
 * Les jeûnes surérogatoires (Achoura, jours blancs, lundi/jeudi) sont affichés avec le badge
 * « Source à compléter » tant qu'un savant n'a pas fourni la référence (YOUR_SCHOLAR_VALIDATOR_NAME).
 * Le Mawlid n'est affiché que si l'utilisateur l'active (« selon votre école »), désactivé par défaut.
 */
import { addDays, dayKey, daysBetween } from './dates';
import { toHijri, type HijriCalendar, type HijriDate } from './hijri';

export type HijriEventKind = 'new-year' | 'ashura' | 'mawlid' | 'ramadan' | 'eid-fitr' | 'eid-adha' | 'white-days';

/** Dates fixes (mois, jour) du calendrier hégirien. */
export const FIXED_EVENTS: { kind: HijriEventKind; month: number; day: number; optIn?: boolean }[] = [
  { kind: 'new-year', month: 1, day: 1 },
  { kind: 'ashura', month: 1, day: 10 },
  { kind: 'mawlid', month: 3, day: 12, optIn: true },
  { kind: 'ramadan', month: 9, day: 1 },
  { kind: 'eid-fitr', month: 10, day: 1 },
  { kind: 'eid-adha', month: 12, day: 10 },
];

/** Jeûnes surérogatoires : affichés avec « Source à compléter » (aucune référence inventée). */
export const FAST_KINDS: ReadonlySet<HijriEventKind> = new Set(['ashura', 'white-days']);

export type HijriEvent = { kind: HijriEventKind; day: string; hijri: HijriDate; inDays: number };
export type EventOpts = { offset?: number; cal?: HijriCalendar; mawlid?: boolean; days?: number };

const at = (k: string) => new Date(k + 'T12:00:00');

/**
 * Jours où l'app ne suggère jamais de jeûne surérogatoire : tout le Ramadan (déjà jeûné),
 * 1 Chawwal, 10 à 13 Dhou al-Hijja. Exclusion prudente — à faire valider par un savant.
 */
export function isNoSuggestionDay(h: HijriDate): boolean {
  return h.month === 9 || (h.month === 10 && h.day === 1) || (h.month === 12 && h.day >= 10 && h.day <= 13);
}

/** Événements des `days` prochains jours (aujourd'hui compris), triés par date. */
export function upcomingHijriEvents(from: Date, o: EventOpts = {}): HijriEvent[] {
  const start = dayKey(from);
  const out: HijriEvent[] = [];
  const n = o.days ?? 365;
  for (let i = 0; i < n; i++) {
    const k = addDays(start, i);
    const h = toHijri(at(k), o.offset ?? 0, o.cal);
    for (const e of FIXED_EVENTS) {
      if (e.month === h.month && e.day === h.day && (!e.optIn || o.mawlid)) out.push({ kind: e.kind, day: k, hijri: h, inDays: i });
    }
    // Jours blancs (13, 14, 15) : une entrée par mois, au 13 (ou au 14/15 si la liste commence en cours de période).
    const whiteStart = h.day === 13 || (i === 0 && (h.day === 14 || h.day === 15));
    if (whiteStart && !isNoSuggestionDay(h)) out.push({ kind: 'white-days', day: k, hijri: h, inDays: i });
  }
  return out;
}

/** Prochain lundi ou jeudi (aujourd'hui compris) hors des jours exclus ci-dessus. */
export function nextMonThu(from: Date, o: EventOpts = {}): { day: string; weekday: 1 | 4; inDays: number } | null {
  const start = dayKey(from);
  for (let i = 0; i < 60; i++) {
    const k = addDays(start, i);
    const wd = at(k).getDay();
    if (wd !== 1 && wd !== 4) continue;
    if (isNoSuggestionDay(toHijri(at(k), o.offset ?? 0, o.cal))) continue;
    return { day: k, weekday: wd as 1 | 4, inDays: daysBetween(start, k) };
  }
  return null;
}
