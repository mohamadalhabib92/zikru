/**
 * Données des widgets (écran d’accueil, écran verrouillé, Android) et de l’activité en direct.
 * Pur et testable : aucune dépendance native, aucun réseau. Le pont natif (`widget-bridge.*`)
 * écrit ces instantanés dans le groupe d’apps ; le widget ne fait que les afficher.
 */
import type { ContentItem } from './content';

export type WidgetLang = 'fr' | 'en' | 'de' | 'ar';
export const FARD = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type FardKey = (typeof FARD)[number];
type Row = { key: string; time: Date };

/** Props du widget « Prochaine prière ». `at`/`from` en ms (les props passent en JSON). */
export type NextPrayerProps = { title: string; key: string; name: string; nameAr: string; time: string; at: number; from: number; place: string; url: string };
export type TasbihProps = { title: string; count: number; target: number; dhikr: string; url: string };
export type DhikrProps = { title: string; arabic: string; translit: string; meaning: string; source: string; empty: string; url: string };
export type PrayerActivityProps = { title: string; name: string; time: string; at: number; from: number; place: string; kind: 'prayer' | 'suhur' | 'iftar' };

const two = (n: number) => String(n).padStart(2, '0');
export const hm = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;

/** Prières obligatoires à venir (aujourd’hui puis demain), dans l’ordre, sans le lever du soleil. */
export function upcomingFard(today: Row[], tomorrow: Row[], now: Date): { key: FardKey; time: Date }[] {
  const keep = (r: Row): r is { key: FardKey; time: Date } => (FARD as readonly string[]).includes(r.key);
  return [...today.filter(keep), ...tomorrow.filter(keep)].filter((r) => r.time.getTime() > now.getTime()).sort((a, b) => a.time.getTime() - b.time.getTime());
}

export type PrayerNames = { title: string; place: string; names: Record<FardKey, string>; namesAr: Record<FardKey, string> };

/**
 * Chronologie iOS : une entrée maintenant (prochaine prière), puis une entrée à chaque adhan
 * qui bascule sur la suivante. Le compte à rebours est rendu par le système (Text timer),
 * donc le widget reste juste sans réveiller l’app.
 */
export function prayerTimeline(today: Row[], tomorrow: Row[], now: Date, n: PrayerNames, max = 8): { date: Date; props: NextPrayerProps }[] {
  const up = upcomingFard(today, tomorrow, now).slice(0, max);
  return up.map((p, i) => {
    const from = i === 0 ? now : up[i - 1].time;
    return { date: from, props: { title: n.title, key: p.key, name: n.names[p.key], nameAr: n.namesAr[p.key], time: hm(p.time), at: p.time.getTime(), from: from.getTime(), place: n.place, url: 'zikru:///prayers' } };
  });
}

export const dayIndex = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

/** Contenu éligible au « dhikr du jour » : approuvé, avec arabe ET source. Jamais de brouillon. */
export function eligibleDhikr(items: ContentItem[]): ContentItem[] {
  return items.filter((i) => i.status === 'approved' && !!i.arabic?.trim() && !!i.source?.trim()).sort((a, b) => a.id.localeCompare(b.id));
}

/** Choix déterministe par jour (le même toute la journée, sur tous les appareils). */
export function dhikrOfDay(items: ContentItem[], day: Date): ContentItem | null {
  const list = eligibleDhikr(items);
  if (!list.length) return null;
  return list[((dayIndex(day) % list.length) + list.length) % list.length];
}

/** Traduction seulement si approuvée dans la langue demandée (sinon rien : pas de repli inventé). */
export function dhikrProps(items: ContentItem[], day: Date, lang: WidgetLang, title: string, empty: string): DhikrProps {
  const c = dhikrOfDay(items, day);
  if (!c) return { title, arabic: '', translit: '', meaning: '', source: '', empty, url: 'zikru:///zikrs' };
  const meaning = lang === 'ar' ? '' : (c.translations as Record<string, string | undefined>)[lang]?.trim() ?? '';
  return { title, arabic: c.arabic, translit: c.transliteration ?? '', meaning, source: c.source, empty, url: 'zikru:///tasbih' };
}

export function tasbihProps(t: { count: number; target: number; dhikrId: string }, label: string, title: string): TasbihProps {
  const target = t.target > 0 ? t.target : 0;
  return { title, count: Math.max(0, t.count | 0), target, dhikr: label, url: 'zikru:///tasbih' };
}

/** Fenêtre de l’activité en direct : seulement si la prochaine prière est à ≤ `windowMin`. */
export const LIVE_WINDOW_MIN = 120;
export type RamadanInput = { on: boolean; hijriMonth: number };

/**
 * Activité en direct (opt-in). Hors Ramadan : la prochaine prière. Pendant Ramadan (si activé) :
 * Fajr devient « fin du suhur » et Maghrib « iftar ». Aucun décalage d’imsak inventé : on affiche
 * l’heure du Fajr calculée, l’utilisateur suit sa mosquée pour la marge de précaution.
 */
export function liveActivityFor(today: Row[], tomorrow: Row[], now: Date, n: PrayerNames & { suhur: string; iftar: string }, ramadan: RamadanInput, windowMin = LIVE_WINDOW_MIN): PrayerActivityProps | null {
  const next = upcomingFard(today, tomorrow, now)[0];
  if (!next) return null;
  if (next.time.getTime() - now.getTime() > windowMin * 60000) return null;
  const isRamadan = ramadan.on && ramadan.hijriMonth === 9;
  const kind: PrayerActivityProps['kind'] = isRamadan && next.key === 'fajr' ? 'suhur' : isRamadan && next.key === 'maghrib' ? 'iftar' : 'prayer';
  const name = kind === 'suhur' ? n.suhur : kind === 'iftar' ? n.iftar : n.names[next.key];
  return { title: n.title, name, time: hm(next.time), at: next.time.getTime(), from: now.getTime(), place: n.place, kind };
}

export type WidgetPrefs = { live: boolean; ramadan: boolean };
export const DEFAULT_WIDGET_PREFS: WidgetPrefs = { live: false, ramadan: false };
export const normalizeWidgetPrefs = (v: unknown): WidgetPrefs => {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<WidgetPrefs>;
  return { live: o.live === true, ramadan: o.ramadan === true };
};
