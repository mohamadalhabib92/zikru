// Échoue si un jugement de fiqh ou une réponse sahw n’a pas de source précise (livre, chapitre, page, édition, lien).
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'fiqh-rulings': F, sahw: S, fiqh: Q, 'review-sheet': RS } = await loadLib(['fiqh-rulings', 'sahw', 'fiqh', 'review-sheet'], 'fiqh');
const okSrc = (s, where) => {
  for (const k of ['book', 'author', 'chapter', 'page', 'edition', 'url']) assert.ok(s?.[k] && String(s[k]).trim(), `${where} : source.${k} manquant`);
  assert.match(s.url, /^https:\/\//, `${where} : lien invalide`);
  assert.match(s.page, /\d/, `${where} : page sans numéro`);
};
const ids = new Set();
for (const r of F.RULINGS) {
  assert.ok(!ids.has(r.id), 'id en double : ' + r.id);
  ids.add(r.id);
  assert.ok(F.SCHOOLS.includes(r.school), r.id + ' : école');
  assert.ok(r.items.length > 0 && r.textAr.trim().length > 10, r.id + ' : contenu ou extrait arabe vide');
  assert.ok(['a_valider', 'valide', 'a_corriger'].includes(r.status), r.id + ' : statut');
  okSrc(r.source, r.id);
  (r.also ?? []).forEach((s, i) => okSrc(s, `${r.id} also[${i}]`));
}
const per = Object.fromEntries(F.SCHOOLS.map((s) => [s, F.RULINGS.filter((r) => r.school === s).length]));
for (const s of F.SCHOOLS) assert.ok(per[s] > 0, 'aucun jugement pour ' + s);
assert.deepEqual(Object.keys(Q.FIQH), F.SCHOOLS);
let n = 0;
for (const c of S.CASES)
  for (const m of F.SCHOOLS) {
    const a = c.by[m];
    if (!a) {
      assert.ok(c.gap?.[m], `sahw ${c.id}/${m} : ni réponse ni lacune expliquée`);
      continue;
    }
    n++;
    okSrc(a.source, `sahw ${c.id}/${m}`);
    assert.ok(a.textAr.trim().length > 10, `sahw ${c.id}/${m} : extrait arabe`);
  }
for (const m of F.SCHOOLS) okSrc(S.HOW[m].source, 'sahw HOW ' + m);
// Tableau de référence : chaque élément a une catégorie existante ; un élément sans source précise doit le déclarer.
for (const m of F.SCHOOLS)
  for (const it of S.REFERENCE[m].items) {
    assert.ok(S.REFERENCE[m].cats.some((c) => c.name === it.cat), `sahw REF ${m} « ${it.act} » : catégorie inconnue`);
    if (it.sourceStatus !== undefined) {
      assert.equal(it.sourceStatus, 'source_a_completer', `sahw REF ${m} « ${it.act} » : sourceStatus invalide`);
      assert.ok(it.id && it.todo?.trim(), `sahw REF ${m} « ${it.act} » : id et « ce qui manque » requis`);
    }
  }
const toComplete = S.refItemsToComplete();
// Fiche de relecture : aucune ligne sans source, sauf si elle porte explicitement le statut « source à compléter ».
const rows = RS.reviewRows();
for (const r of rows) if (!r.source.trim()) assert.equal(r.status, 'source_a_completer', `${r.uid} : source manquante non déclarée`);
for (const x of toComplete) assert.ok(rows.some((r) => r.uid === x.uid && r.status === 'source_a_completer'), `${x.uid} absent de la fiche`);
for (const m of F.SCHOOLS) S.REFERENCE[m].source.forEach((s, i) => okSrc(s, `sahw REF ${m}[${i}]`));
console.log(`fiqh OK : ${F.RULINGS.length} jugements ${JSON.stringify(per)} · sahw ${n} réponses · ${F.FIQH_GAPS.length} lacunes listées · ${toComplete.length} « source à compléter »`);
