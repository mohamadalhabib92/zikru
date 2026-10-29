/**
 * Fiqh pratique — vue par section, dérivée des jugements sourcés de `fiqh-rulings.ts`.
 * Chaque liste garde sa source précise (livre, chapitre, page, édition) et son statut de validation.
 */
import { RULINGS, SCHOOLS, TOPICS, type FiqhRuling, type School } from './fiqh-rulings';

export type Madhab = School;
export type FiqhSection = { id: string; title: string; ar: string; icon: string; intro?: FiqhRuling; lists: FiqhRuling[] };

export const FIQH: Record<Madhab, FiqhSection[]> = Object.fromEntries(
  SCHOOLS.map((school) => [
    school,
    TOPICS.map((tp) => {
      const rs = RULINGS.filter((r) => r.school === school && r.topic === tp.id);
      return { id: tp.id, title: tp.title, ar: tp.ar, icon: tp.icon, intro: rs.find((r) => r.kind === 'intro'), lists: rs.filter((r) => r.kind === 'list') };
    }).filter((s) => s.lists.length || s.intro),
  ]),
) as Record<Madhab, FiqhSection[]>;

export { FIQH_GAPS, RULINGS, SCHOOLS, SCHOOL_LABEL, citation } from './fiqh-rulings';
