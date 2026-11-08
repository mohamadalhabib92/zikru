/**
 * Adhkar du jour (matin, soir, après la prière, avant de dormir) — module pur, testé par scripts/test-pass2.mjs.
 * AUCUN TEXTE NOUVEAU : chaque entrée renvoie à une invocation déjà présente dans duas.ts (arabe, translittération,
 * traduction, nombre de répétitions et référence inchangés). Le classement par moment suit uniquement le champ
 * « when » déjà rédigé pour chaque invocation ; il s’inspire de l’organisation de Ḥiṣn al-Muslim (al-Qaḥṭānī)
 * sans en reprendre la numérotation, et reste « à valider » dans la fiche savante.
 * Les adhkar connus de ces moments mais pas encore sourcés dans l’app sont listés dans ADHKAR_TO_COMPLETE
 * (titre seul, aucun texte arabe ni traduction écrits de mémoire) : ils vont dans la fiche « Source à compléter ».
 */
import { DUAS_LIST, type Dua } from './duas';

export type AdhkarMoment = 'matin' | 'soir' | 'apres-priere' | 'sommeil';
export const ADHKAR_MOMENTS: AdhkarMoment[] = ['matin', 'soir', 'apres-priere', 'sommeil'];

export const MOMENT_LABEL: Record<AdhkarMoment, string> = {
  matin: 'Adhkar du matin',
  soir: 'Adhkar du soir',
  'apres-priere': 'Après la prière',
  sommeil: 'Avant de dormir',
};
export const MOMENT_ICON: Record<AdhkarMoment, string> = { matin: 'sunny-outline', soir: 'partly-sunny-outline', 'apres-priere': 'checkmark-done-outline', sommeil: 'moon-outline' };

/**
 * Identifiants (duas.ts) par moment, dans l’ordre d’affichage. Règles :
 *  - une invocation n’apparaît que si son champ « when » cite ce moment ;
 *  - « sabah » (texte du matin) n’est pas repris le soir et « amsayna » (texte du soir) n’est pas repris le matin :
 *    l’arabe affiché doit être celui du moment ;
 *  - Āyat al-Kursī n’est placée qu’au coucher, seul moment couvert par sa référence (al-Bukhārī 2311) ;
 *  - « aslamtu » est placée en dernier (le hadith dit de la dire en dernier).
 */
export const ADHKAR_IDS: Record<AdhkarMoment, string[]> = {
  matin: ['sabah', 'sayyid', 'fatir', 'bismillah-ladhi', 'afini', 'kufr-faqr', 'afiya', 'subhan-bihamdih'],
  soir: ['amsayna', 'sayyid', 'fatir', 'bismillah-ladhi', 'afini', 'kufr-faqr', 'afiya', 'subhan-bihamdih'],
  'apres-priere': ['salam', 'la-mani', 'tasbih-33', 'ainni', 'muawwidhat-salat', 'jubn', 'ilm-nafi'],
  sommeil: ['kursi', 'muawwidhat-nawm', 'tasbih-fatima', 'fatir', 'bismika-rabbi', 'qini', 'atamana', 'nawm', 'aslamtu'],
};

/** Adhkar de ces moments à ajouter seulement après vérification de la source (titres seuls, pas de texte). */
export const ADHKAR_TO_COMPLETE: { uid: string; moments: AdhkarMoment[]; title: string; todo: string }[] = [
  { uid: 'adhkar:todo:kursi-salat', moments: ['apres-priere'], title: 'Āyat al-Kursī après chaque prière', todo: 'Le texte existe déjà (Coran 2:255) ; il manque la référence du hadith qui la recommande après la prière, avec son jugement vérifié.' },
  { uid: 'adhkar:todo:kursi-sabah', moments: ['matin', 'soir'], title: 'Āyat al-Kursī le matin et le soir', todo: 'Référence du hadith et jugement vérifié à fournir avant de l’ajouter au matin et au soir.' },
  { uid: 'adhkar:todo:muawwidhat-sabah', moments: ['matin', 'soir'], title: 'Les trois Qul (al-Ikhlāṣ, al-Falaq, an-Nās) matin et soir', todo: 'Référence du hadith, nombre de répétitions et jugement vérifié à fournir.' },
  { uid: 'adhkar:todo:tahlil-moment', moments: ['matin'], title: 'Tahlil ×100 : moment de la journée', todo: 'L’app le présente « chaque jour » (al-Bukhārī 3293) ; confirmer s’il doit figurer parmi les adhkar du matin.' },
  { uid: 'adhkar:todo:istighfar-100', moments: ['matin', 'soir'], title: 'Istighfar ×100 par jour', todo: 'L’app le présente « chaque jour » (al-Bukhārī 6307 ; Muslim 2702) ; confirmer s’il doit figurer parmi les adhkar du matin ou du soir.' },
];

const byId = new Map(DUAS_LIST.map((d) => [d.id, d]));
/** Invocations d’un moment (les identifiants inconnus sont ignorés ; le test vérifie qu’il n’y en a aucun). */
export function adhkarFor(m: AdhkarMoment): Dua[] {
  return ADHKAR_IDS[m].map((id) => byId.get(id)).filter((d): d is Dua => !!d);
}
export const unknownAdhkarIds = () => ADHKAR_MOMENTS.flatMap((m) => ADHKAR_IDS[m].filter((id) => !byId.has(id)).map((id) => `${m}:${id}`));

/** Moment proposé par défaut selon l’heure et les horaires du jour (sans réseau). */
export function momentAt(now: Date, t: { fajr?: Date; asr?: Date; isha?: Date }): AdhkarMoment {
  const ms = now.getTime();
  if (t.isha && ms >= t.isha.getTime() + 60 * 60000) return 'sommeil';
  if (t.asr && ms >= t.asr.getTime()) return 'soir';
  if (t.fajr && ms >= t.fajr.getTime()) return 'matin';
  return ms < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4).getTime() ? 'sommeil' : 'matin';
}

/** Progression d’un moment pour la journée : { id → nombre fait }. Une invocation sans nombre compte pour 1. */
export type AdhkarProgress = Record<string, number>;
export const repsOf = (d: Dua) => (d.reps && d.reps > 0 ? d.reps : 1);
export function momentDone(m: AdhkarMoment, p: AdhkarProgress): { done: number; total: number } {
  const list = adhkarFor(m);
  return { done: list.filter((d) => (p[d.id] ?? 0) >= repsOf(d)).length, total: list.length };
}
