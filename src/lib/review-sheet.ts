/**
 * Fiche de relecture savante : une ligne par élément (invocations/hadiths, jugements de fiqh, réponses sahw).
 * Utilisée par l’écran « Validation savante » (export web) et par scripts/review-sheet.mjs (fichiers CSV/Markdown).
 */
import { RULINGS, SCHOOL_LABEL, citation } from './fiqh-rulings';
import { allProvenance, GRADE_LABEL, SET_LABEL } from './provenance';
import type { ReviewStatus } from './provenance-types';
import { REVIEW_LABEL, reviewFor } from './reviews';
import { allSahwAnswers, refItemsToComplete } from './sahw';

export type ReviewRow = {
  uid: string;
  kind: 'texte' | 'fiqh' | 'sahw';
  group: string;
  title: string;
  arabic: string;
  french: string;
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
      source: '',
      grading: '',
      status: st,
      statusLabel: REVIEW_LABEL[st],
      note: x.item.todo ?? '',
    });
  }
  return rows;
}

const COLS: [keyof ReviewRow, string][] = [
  ['uid', 'Identifiant'],
  ['kind', 'Type'],
  ['group', 'Rubrique'],
  ['title', 'Titre'],
  ['arabic', 'Texte arabe'],
  ['french', 'Résumé / traduction française'],
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
    out.push(`- **Source** : ${r.source || '**SOURCE À COMPLÉTER** — aucune source précise pour l’instant'}`);
    if (r.grading) out.push(`- **Jugement / preuves** : ${r.grading}`);
    if (r.note) out.push(`- **Remarque** : ${r.note}`);
    out.push(`- **Statut** : ${r.statusLabel}`, '- [ ] Validé   - [ ] À corriger — correction : ……………………………', '');
  }
  return out.join('\n');
}
