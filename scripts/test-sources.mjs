// CI : tout texte religieux doit avoir une source structurée ; chaque hadith cité doit avoir été vérifié
// (gradings.gen.ts) ; chaque référence coranique doit exister ; aucun jugement sans savant ni lien.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { provenance: P, 'gradings.gen': G } = await loadLib(['provenance', 'gradings.gen'], 'src');
const items = P.allProvenance();
const fail = [];
const uids = new Set();
for (const it of items) {
  if (uids.has(it.uid)) fail.push(`${it.uid} : identifiant en double`);
  uids.add(it.uid);
  if (!it.sources.length) fail.push(`${it.uid} : aucune source (réf. « ${it.refText} »)`);
  if (!it.review || !['a_valider', 'valide', 'a_corriger'].includes(it.review.status)) fail.push(`${it.uid} : statut de validation invalide`);
  if (it.review.status === 'valide' && (!it.review.role || !it.review.date || !it.review.version)) fail.push(`${it.uid} : « validé » sans rôle/date/version`);
  for (const s of it.sources) {
    if (s.kind === 'hadith') {
      if (!G.HADITH_CHECKS[s.key]) fail.push(`${it.uid} : ${s.key} jamais vérifié (relancer scripts/verify-hadith)`);
    }
    if (s.kind === 'coran') {
      const n = P.AYAH_COUNTS[s.surah - 1];
      if (!n || s.ayah < 1 || s.ayah > n || (s.ayahEnd && (s.ayahEnd < s.ayah || s.ayahEnd > n))) fail.push(`${it.uid} : verset inexistant ${s.label}`);
    }
  }
  for (const g of it.gradings) {
    if (!g.grader || !g.url || !/^https:\/\/(sunnah\.com|dorar\.net)\//.test(g.url)) fail.push(`${it.uid} : jugement sans savant ou sans lien vérifiable`);
  }
  if (it.gradingState === 'verifie' && !it.gradings.length) fail.push(`${it.uid} : « vérifié » sans jugement`);
}
assert.equal(P.AYAH_COUNTS.length, 114);
assert.equal(P.AYAH_COUNTS.reduce((a, b) => a + b, 0), 6236);
assert.deepEqual(
  P.parseRef('Jami‘ at-Tirmidhi 3391 ; Sunan Abi Dawud 5068').map((s) => s.key),
  ['abudawud:5068', 'tirmidhi:3391'],
);
assert.equal(P.parseRef('Coran 33:41-42')[0].ayahEnd, 42);
if (fail.length) {
  console.error('✗ sources manquantes ou invalides :\n  ' + fail.join('\n  '));
  process.exit(1);
}
const by = {};
for (const it of items) {
  by[it.set] ??= { n: 0, verifie: 0, non_verifie: 0, sans_objet: 0 };
  by[it.set].n++;
  by[it.set][it.gradingState]++;
}
console.log(`✓ sources : ${items.length} items, tous sourcés —`, JSON.stringify(by));
