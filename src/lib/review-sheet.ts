/**
 * Fiche de relecture savante : une ligne par élément (invocations/hadiths, jugements de fiqh, réponses sahw).
 * Utilisée par l’écran « Validation savante » (export web) et par scripts/review-sheet.mjs (fichiers CSV/Markdown).
 */
import { RULINGS, SCHOOL_LABEL, citation } from './fiqh-rulings';
import { allProvenance, GRADE_LABEL, SET_LABEL } from './provenance';
import type { ReviewStatus } from './provenance-types';
import { REVIEW_LABEL, reviewFor } from './reviews';
import { allSahwAnswers, refItemsToComplete } from './sahw';
import { DUAS_I18N } from './i18n-content/duas';
import { FIQH_EN } from './i18n-content/fiqh';
import { HADITHS_EN, SALAWAT_EN } from './i18n-content/knowledge';
import { SAHW_CASES_EN } from './i18n-content/sahw';
import { QURAN_DUAS } from './quran-duas';
import { FATIHA_AR, FATIHA_EN, FATIHA_FR } from './fatiha';
import { NURANI_LETTERS, NURANI_MNEMONIC } from './nuraniyya';
import { FATIHA_ORDER_FLAG, PRACTICES } from './tijani';
import { ADHKAR_IDS, ADHKAR_MOMENTS, ADHKAR_TO_COMPLETE, adhkarFor, MOMENT_LABEL } from './adhkar';

const TO_REVIEW = 'traduction à relire (Zikru, assistée par machine puis revue)';
const QD_EN = Object.fromEntries(QURAN_DUAS.map((q) => [q.id, q.en ?? '']));
/** Anglais d’un texte (du‘a, hadith, ṣalāt) + son statut. */
function englishOf(set: string, id: string): [string, string] {
  if (set === 'duas' && DUAS_I18N[id]) return [DUAS_I18N[id].en, TO_REVIEW];
  if (set === 'hadiths' && HADITHS_EN[id]) return [HADITHS_EN[id].en, TO_REVIEW];
  if (set === 'salawat' && SALAWAT_EN[id]) return [SALAWAT_EN[id].en, TO_REVIEW];
  if (set === 'quran-duas' && QD_EN[id]) return [QD_EN[id], 'Pickthall (1930, domaine public) — sens du Coran, non modifié'];
  return ['', 'pas encore de traduction anglaise'];
}

export type ReviewRow = {
  uid: string;
  kind: 'texte' | 'fiqh' | 'sahw';
  group: string;
  title: string;
  arabic: string;
  french: string;
  english: string;
  /** « traduction à relire », domaine public, ou manquante. */
  englishState: string;
  source: string;
  grading: string;
  status: ReviewStatus;
  statusLabel: string;
  note: string;
  /** Pour les textes : état du jugement de hadith. */
  gradingState?: 'verifie' | 'non_verifie' | 'sans_objet';
};

export function reviewRows(): ReviewRow[] {
  const rows: ReviewRow[] = [];
  for (const p of allProvenance()) {
    const grading =
      p.gradingState === 'sans_objet'
        ? 'Sans objet (Coran, tradition ou usage)'
        : p.gradingState === 'non_verifie'
          ? 'Jugement non vérifié'
          : [...new Set(p.gradings.map((g) => `${g.key} : ${GRADE_LABEL[g.grade]} « ${g.raw} » (${g.grader}, ${g.site})`))].join(' ; ');
    rows.push({
      uid: p.uid,
      kind: 'texte',
      group: SET_LABEL[p.set],
      title: p.title,
      arabic: p.arabic ?? '',
      french: p.translation.fr ?? '',
      english: englishOf(p.set, p.id)[0],
      englishState: englishOf(p.set, p.id)[1],
      source: p.refText,
      grading: grading + (p.divergence ? ' — DIVERGENCE entre savants' : ''),
      status: p.review.status,
      statusLabel: REVIEW_LABEL[p.review.status],
      note: p.review.note ?? '',
      gradingState: p.gradingState,
    });
  }
  for (const r of RULINGS) {
    const uid = `fiqh:${r.id}`;
    const st = reviewFor(uid).status;
    rows.push({
      uid,
      kind: 'fiqh',
      group: `Fiqh ${SCHOOL_LABEL[r.school].fr} — ${r.topic}`,
      title: r.title.fr,
      arabic: r.textAr,
      french: r.items.map((x, i) => `${i + 1}. ${x}`).join(' '),
      english: FIQH_EN[r.id] ? `${FIQH_EN[r.id].title} — ` + FIQH_EN[r.id].items.map((x, i) => `${i + 1}. ${x}`).join(' ') : '',
      englishState: FIQH_EN[r.id] ? TO_REVIEW + ' ; en arabe l’app affiche l’extrait classique ci-contre' : 'pas encore de traduction anglaise',
      source: [citation(r.source), ...(r.also ?? []).map(citation)].join(' | '),
      grading: r.evidence?.length ? 'Preuves : ' + r.evidence.join(' ; ') : '',
      status: st,
      statusLabel: REVIEW_LABEL[st],
      note: r.note ?? '',
    });
  }
  for (const x of allSahwAnswers()) {
    const st = reviewFor(x.uid).status;
    rows.push({
      uid: x.uid,
      kind: 'sahw',
      group: `Sahw ${SCHOOL_LABEL[x.school].fr}`,
      title: x.q,
      arabic: x.a.textAr,
      french: `[${x.a.when}] ${x.a.text}`,
      english: SAHW_CASES_EN[x.caseId]?.by[x.school]?.text ?? '',
      englishState: SAHW_CASES_EN[x.caseId]?.by[x.school] ? TO_REVIEW + ' ; en arabe l’app affiche l’extrait classique ci-contre' : 'pas encore de traduction anglaise',
      source: [citation(x.a.source), ...(x.a.also ?? []).map(citation)].join(' | '),
      grading: '',
      status: st,
      statusLabel: REVIEW_LABEL[st],
      note: x.a.note ?? '',
    });
  }
  for (const x of refItemsToComplete()) {
    const r = reviewFor(x.uid);
    const st: ReviewStatus = r.status === 'a_valider' ? 'source_a_completer' : r.status;
    rows.push({
      uid: x.uid,
      kind: 'sahw',
      group: `Sahw ${SCHOOL_LABEL[x.school].fr} — tableau de référence`,
      title: `${x.item.act} (${x.item.cat})`,
      arabic: '',
      french: x.item.act,
      english: '',
      englishState: 'tableau de référence : français seulement',
      source: '',
      grading: '',
      status: st,
      statusLabel: REVIEW_LABEL[st],
      note: x.item.todo ?? '',
    });
  }
  rows.push(...p5Rows());
  rows.push(...adhkarRows());
  return rows;
}

/** Points ajoutés en P5 (Fatiha en tête, lettres lumineuses, al-Kahf) à faire relire. */
function p5Rows(): ReviewRow[] {
  const row = (uid: string, group: string, title: string, o: Partial<ReviewRow>): ReviewRow => {
    const st = reviewFor(uid).status;
    return { uid, kind: 'texte', group, title, arabic: '', french: '', english: '', englishState: '', source: '', grading: 'Sans objet (Coran, tradition ou usage)', status: st, statusLabel: REVIEW_LABEL[st], note: '', ...o };
  };
  const out: ReviewRow[] = [];
  for (const p of PRACTICES)
    out.push(
      row(`tijani:order:${p.id}`, 'Tijaniyya — ordre des étapes', `${p.name} : ordre des étapes`, {
        french: p.steps.map((s, i) => `${i + 1}. ${s.formula}${s.count ? ` ×${s.count}` : ' (sans compter)'}`).join(' '),
        englishState: 'sans objet',
        source: 'Usage couramment décrit dans la tariqa (Jawahir al-Ma‘ani pour le wird) — à confirmer',
        note: FATIHA_ORDER_FLAG,
      }),
    );
  out.push(
    row('fatiha:translation', 'Coran — Al-Fatiha (étape d’ouverture)', 'Al-Fatiha 1:1-7 — traductions', {
      arabic: FATIHA_AR,
      french: FATIHA_FR,
      english: FATIHA_EN,
      englishState: 'Pickthall (1930, domaine public) — sens du Coran, non modifié',
      source: 'Texte arabe : Tanzil Uthmani (non modifié). Français : traduction de l’app, à relire.',
      note: 'Étape ajoutée en tête des compositions « Mes zikrs » (réglage, actif par défaut) et des pratiques Tijaniyya.',
    }),
    row('quran:nuraniyya', 'Coran — lecteur', 'Lettres lumineuses (al-ḥurūf an-nūrāniyya) : fiche d’information', {
      arabic: `${NURANI_LETTERS.join(' ')} — ${NURANI_MNEMONIC}`,
      french:
        'Les 29 sourates ouvertes par des lettres isolées ; 14 lettres distinctes (moitié de l’alphabet), formule mnémotechnique « نص حكيم قاطع له سر ». Sens : Allah en connaît mieux le sens (avis rapporté de nombreux savants) ; az-Zamakhsharī et Ibn Kathīr y voient un signe de l’inimitabilité. Aucune vertu attribuée.',
      englishState: 'interface : traduction à relire',
      source: 'Ibn Kathīr, Tafsīr al-Qur’ān al-‘Aẓīm, début de la sourate al-Baqara (2:1) ; az-Zamakhsharī, al-Kashshāf, même passage',
      note: 'Règles d’affichage : ا ٱ آ أ إ et ى comptent ; ء ؤ ئ et ة non. À confirmer (en particulier ى et les formes de hamza).',
    }),
    row('kahf:hadith-ar', 'Coran — sourate al-Kahf', 'Hadiths cités sur l’écran al-Kahf : libellé arabe', {
      arabic: 'مَنْ حَفِظَ عَشْرَ آيَاتٍ مِنْ أَوَّلِ سُورَةِ الْكَهْفِ عُصِمَ مِنَ الدَّجَّالِ ‖ مَنْ قَرَأَ سُورَةَ الْكَهْفِ فِي يَوْمِ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الْجُمُعَتَيْنِ',
      englishState: 'interface : traduction à relire',
      source: 'Sahih Muslim 809 ; al-Ḥākim (al-Mustadrak) et al-Bayhaqī, authentifié par al-Albānī (Ṣaḥīḥ al-Jāmi‘ 6470)',
      note: 'Vérifier le libellé arabe exact de chaque recueil avant validation.',
    }),
  );
  return out;
}

/** Passe 2 : classement des adhkar par moment (textes déjà présents) et adhkar dont la source manque. */
function adhkarRows(): ReviewRow[] {
  const out: ReviewRow[] = [];
  for (const m of ADHKAR_MOMENTS) {
    const uid = `adhkar:moment:${m}`;
    const st = reviewFor(uid).status;
    out.push({
      uid,
      kind: 'texte',
      group: 'Adhkar — classement par moment',
      title: `${MOMENT_LABEL[m]} : liste et ordre`,
      arabic: '',
      french: adhkarFor(m).map((d, i) => `${i + 1}. ${d.title}${d.reps && d.reps > 1 ? ` ×${d.reps}` : ''} (${d.ref})`).join(' '),
      english: '',
      englishState: 'sans objet',
      source: 'Classement d’après le champ « moment » de chaque invocation de l’app, dans l’esprit de Ḥiṣn al-Muslim (al-Qaḥṭānī) — correspondance à confirmer',
      grading: 'Voir la ligne de chaque invocation',
      status: st,
      statusLabel: REVIEW_LABEL[st],
      note: `Identifiants : ${ADHKAR_IDS[m].join(', ')}. Vérifier que chaque texte convient à ce moment (ex. formule du matin / du soir) et l’ordre.`,
    });
  }
  for (const x of ADHKAR_TO_COMPLETE) {
    const r = reviewFor(x.uid);
    const st: ReviewStatus = r.status === 'a_valider' ? 'source_a_completer' : r.status;
    out.push({
      uid: x.uid,
      kind: 'texte',
      group: 'Adhkar — à ajouter après vérification',
      title: x.title,
      arabic: '',
      french: '',
      english: '',
      englishState: 'sans objet',
      source: '',
      grading: '',
      status: st,
      statusLabel: REVIEW_LABEL[st],
      note: `${x.moments.map((m) => MOMENT_LABEL[m]).join(', ')} — ${x.todo}`,
    });
  }
  return out;
}

const COLS: [keyof ReviewRow, string][] = [
  ['uid', 'Identifiant'],
  ['kind', 'Type'],
  ['group', 'Rubrique'],
  ['title', 'Titre'],
  ['arabic', 'Texte arabe'],
  ['french', 'Résumé / traduction française'],
  ['english', 'Traduction anglaise'],
  ['englishState', 'Statut de la traduction anglaise'],
  ['source', 'Source citée'],
  ['grading', 'Jugement (hadith) / preuves'],
  ['statusLabel', 'Statut'],
  ['note', 'Remarque'],
];
const EXTRA = ['Avis du relecteur (valide / à corriger)', 'Correction proposée', 'Rôle du relecteur', 'Date'];

export function reviewCsv(rows = reviewRows()): string {
  const q = (v: string) => `"${v.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const head = [...COLS.map((c) => c[1]), ...EXTRA].map(q).join(';');
  const body = rows.map((r) => [...COLS.map((c) => q(String(r[c[0]]))), ...EXTRA.map(() => '""')].join(';'));
  return '\uFEFF' + [head, ...body].join('\r\n') + '\r\n';
}

export function reviewMarkdown(rows = reviewRows(), version = ''): string {
  const out: string[] = [];
  out.push('# Zikru — fiche de validation savante', '');
  if (version) out.push(`Version de l’app : ${version}`, '');
  out.push(
    'Pour chaque élément : vérifier le texte arabe, la traduction ou le résumé, la source (livre, numéro ou page, édition) et, pour les hadiths, le jugement et le savant cité.',
    'Cocher « Validé » ou « À corriger » et proposer la correction. Merci d’indiquer votre rôle (ex. muhaddith, faqih malikite) ; votre nom ne sera publié qu’avec votre accord.',
    '',
  );
  const counts = (k: ReviewRow['kind']) => rows.filter((r) => r.kind === k).length;
  out.push(`Éléments : ${rows.length} (textes ${counts('texte')}, fiqh ${counts('fiqh')}, sahw ${counts('sahw')}).`, '');
  let group = '';
  for (const r of rows) {
    if (r.group !== group) {
      group = r.group;
      out.push(`## ${group}`, '');
    }
    out.push(`### ${r.title}  \`${r.uid}\``, '');
    if (r.arabic) out.push(`> ${r.arabic}`, '');
    if (r.french) out.push(`- **Français** : ${r.french}`);
    if (r.english) out.push(`- **English** (${r.englishState}) : ${r.english}`);
    out.push(`- **Source** : ${r.source || '**SOURCE À COMPLÉTER** — aucune source précise pour l’instant'}`);
    if (r.grading) out.push(`- **Jugement / preuves** : ${r.grading}`);
    if (r.note) out.push(`- **Remarque** : ${r.note}`);
    out.push(`- **Statut** : ${r.statusLabel}`, '- [ ] Validé   - [ ] À corriger — correction : ……………………………', '');
  }
  return out.join('\n');
}
