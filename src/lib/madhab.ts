/**
 * Réglage unifié de l’école (madhhab) — une seule clé de stockage `fiqh-madhab`, partagée par
 * l’accueil, les Réglages, le Fiqh et le Sujud as-sahw.
 * Le calcul de l’heure de l’Asr reste un réglage séparé (`settings.madhab` : 'shafi' | 'hanafi') ;
 * par défaut il suit l’école (hanafite → Asr hanafite), sauf si l’utilisateur l’a choisi lui-même.
 */
import type { School } from './fiqh-rulings';
import { usePersistentState } from './storage';

export const MADHAB_KEY = 'fiqh-madhab';
export const SCHOOL_VALUES: School[] = ['maliki', 'shafii', 'hanafi', 'hanbali'];
export function asSchool(v: unknown): School {
  return SCHOOL_VALUES.includes(v as School) ? (v as School) : 'maliki';
}
export function asrForSchool(s: School): 'shafi' | 'hanafi' {
  return s === 'hanafi' ? 'hanafi' : 'shafi';
}
export function useMadhab() {
  const [raw, set] = usePersistentState<School>(MADHAB_KEY, 'maliki');
  return [asSchool(raw), set] as const;
}
