// Vingt attributs, vingt opposés, vers du matn, langue et drapeau sur chaque entrée.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'aqida-murshid': A, 'religious-locale': R } = await loadLib(['aqida-murshid', 'religious-locale'], 'aqida');

assert.equal(A.AQIDA_ATTRIBUTES.length, 20);
assert.equal(new Set(A.AQIDA_ATTRIBUTES.map((a) => a.opposite.id)).size, 20);
const groups = {};
for (const a of A.AQIDA_ATTRIBUTES) groups[a.group] = (groups[a.group] ?? 0) + 1;
assert.deepEqual(groups, { nafsiyya: 1, salbiyya: 5, maani: 7, manawiyya: 7 });

const verseText = Object.fromEntries(A.AQIDA_VERSES.map((v) => [v.n, v.arabic]));
assert.deepEqual(A.AQIDA_VERSES.map((v) => v.n), Array.from({ length: 35 }, (_, i) => i + 6));

for (const a of A.AQIDA_ATTRIBUTES) {
  assert.equal(a.verified, false);
  assert.equal(a.scholarFlag, R.FLAG_SCHOLAR);
  assert.ok(a.sourceRef && a.arabic && a.transliteration);
  assert.equal(a.opposite.verified, false);
  assert.equal(a.opposite.scholarFlag, R.FLAG_SCHOLAR);
  assert.ok(a.opposite.sourceRef && a.opposite.arabic);
  if (a.block === 'sanusi') {
    assert.equal(a.verse, null);
    assert.match(a.sourceRef, /Hors hémistiche/);
    assert.match(a.sourceRef, /Umm al-Barāhīn/);
    assert.equal(verseText[16].includes(a.arabic), false);
  } else {
    assert.ok(a.verse);
    assert.match(a.sourceRef, /vers/);
    const bit = (s) => s.split(' ')[0].replace(/^وَ/, '').replace(/[\u064B-\u0652]$/, '');
    assert.ok(verseText[a.verse].includes(bit(a.arabic)) || verseText[a.verse].includes(a.arabic.split(' ')[0]), a.id + ' absent du vers ' + a.verse);
    assert.ok(verseText[a.opposite.verse].includes(bit(a.opposite.arabic)) || verseText[a.opposite.verse].includes(a.opposite.arabic.split(' ')[0]), a.opposite.id);
  }
  for (const lang of R.CONTENT_LOCALES) {
    const slot = R.resolveSlot(a.gloss, lang);
    assert.ok(slot.text, a.id + ' ' + lang);
    assert.ok(slot.source);
    assert.equal(slot.verified, false);
    assert.ok(slot.flag === R.FLAG_SCHOLAR || slot.flag === R.FLAG_TRANSLATION);
    const spoken = R.spokenOf(a.gloss, lang);
    assert.equal(spoken.text, slot.text);
  }
}

assert.ok(verseText[31].includes('الصِّدْقُ'));
assert.ok(verseText[31].includes('أَمَانَةٌ'));
assert.ok(verseText[31].includes('تَبْلِيغُهُمْ'));
assert.equal(verseText[31].includes('فطان'), false);
assert.ok(verseText[32].includes('ذَكِيُّ'));
assert.ok(verseText[38].includes('لَا إِلَهَ إِلَّا اللَّهُ'));
assert.ok(verseText[19].includes('صُمَاتْ'));

for (const v of A.AQIDA_VERSES) {
  for (const lang of R.CONTENT_LOCALES) {
    const slot = R.resolveSlot(v.translation, lang);
    assert.ok(slot.text, 'vers ' + v.n + ' ' + lang);
    assert.ok(slot.source);
    assert.equal(slot.verified, false);
    assert.ok(slot.flag);
    if (lang === 'ar') assert.equal(slot.kind, 'matn');
    if (lang === 'en') assert.equal(slot.kind, 'published');
    if (lang === 'fr' || lang === 'de') assert.equal(slot.kind, 'literal');
    if (lang === 'ha') assert.equal(slot.kind, 'fallback');
  }
  const fr = R.resolveSlot(v.translation, 'fr').text;
  const ha = R.spokenOf(v.translation, 'ha');
  assert.equal(ha.text, fr);
  assert.equal(ha.speech, 'fr-FR');
}

const de = R.resolveSlot(A.AQIDA_INTRO, 'de').text;
const ch = R.resolveSlot(A.AQIDA_INTRO, 'de-CH');
assert.equal(ch.kind, 'fallback');
assert.equal(ch.text, de.replace(/ß/g, 'ss'));
assert.equal(A.AQIDA_SECTIONS[0].id, 'ahkam');
assert.equal(A.AQIDA_SECTIONS.at(-1).sanusi, true);
console.log('test-aqida OK', A.AQIDA_ATTRIBUTES.length, 'attributs');
