// Couverture du contenu en/ar (P5) : chaque du‘a, du‘a coranique, règle de fiqh, cas de sahw, hadith et ṣalāt
// doit avoir sa traduction anglaise ; l’arabe source n’est jamais modifié (vérifié par test-quran / test-sources).
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';
const m = await loadLib(['duas', 'quran-duas', 'fiqh-rulings', 'sahw', 'knowledge', 'salawat', 'i18n-content/duas', 'i18n-content/quran-duas', 'i18n-content/fiqh', 'i18n-content/sahw', 'i18n-content/knowledge'], 'i18nc');
const miss = [];
const chk = (ok, what) => { if (!ok) miss.push(what); };
for (const d of m.duas.DUAS_LIST) { const e = m['i18n-content/duas'].DUAS_I18N[d.id]; chk(e?.en && e.title?.[0] && e.title?.[1], 'dua ' + d.id); if (e && d.note) chk(e.note, 'dua note ' + d.id); }
for (const q of m['quran-duas'].QURAN_DUAS) { chk(q.en, 'qdua en ' + q.id); chk(m['i18n-content/quran-duas'].QURAN_DUAS_I18N[q.id]?.title?.[1], 'qdua title ' + q.id); }
for (const r of m['fiqh-rulings'].RULINGS) { const e = m['i18n-content/fiqh'].FIQH_EN[r.id]; chk(e && e.items.length === r.items.length && e.title, 'fiqh ' + r.id); chk(r.title.ar && r.textAr, 'fiqh ar ' + r.id); }
const S = m['i18n-content/sahw'];
for (const c of m.sahw.CASES) { chk(S.SAHW_CASES_EN[c.id]?.q && S.SAHW_CASES_AR[c.id], 'sahw q ' + c.id); for (const k of Object.keys(c.by)) chk(S.SAHW_CASES_EN[c.id]?.by[k]?.text, `sahw ${c.id}/${k}`); }
for (const [k, v] of Object.entries(m.sahw.HOW)) chk(S.SAHW_HOW_EN[k]?.steps.length === v.steps.length && S.SAHW_HOW_AR[k], 'sahw how ' + k);
const K = m['i18n-content/knowledge'];
for (const h of m.knowledge.HADITHS) chk(K.HADITHS_EN[h.id]?.en, 'hadith ' + h.id);
for (const s of m.salawat.SALAWAT) chk(K.SALAWAT_EN[s.id]?.en, 'salawat ' + s.id);
assert.deepEqual(miss, [], 'Traductions de contenu manquantes');
console.log(`i18n contenu OK : ${m.duas.DUAS_LIST.length} du‘as, ${m['quran-duas'].QURAN_DUAS.length} du‘as coraniques, ${m['fiqh-rulings'].RULINGS.length} règles, ${m.sahw.CASES.length} cas de sahw, ${m.knowledge.HADITHS.length} hadiths, ${m.salawat.SALAWAT.length} ṣalawāt`);
