// Chaque entrée religieuse a toutes les langues de l’app, une source et un statut.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLib } from './load-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const { 'religious-locale': R, 'akhdari-view': Ak, 'fiqh-locales': F, i18n } = await loadLib(
  ['religious-locale', 'akhdari-view', 'fiqh-locales', 'i18n'],
  'locales',
);

assert.deepEqual([...R.CONTENT_LOCALES], i18n.LANGS.map((l) => l.code));

const items = JSON.parse(readFileSync(join(root, 'assets/fiqh/akhdari.json'), 'utf8'));
const paragraphs = items.filter((x) => x.kind === 'paragraph');
assert.equal(paragraphs.length, 112);
for (const p of paragraphs) {
  const map = Ak.akhdariParagraphLocales(p.text);
  for (const lang of R.CONTENT_LOCALES) {
    const slot = R.resolveSlot(map, lang);
    assert.equal(slot.text, p.text, p.id + ' ' + lang);
    assert.ok(slot.source);
    assert.equal(slot.verified, false);
    assert.ok(slot.flag);
    if (lang !== 'ar') assert.equal(slot.kind, 'fallback');
  }
  const spoken = R.spokenOf(map, 'fr');
  assert.equal(spoken.text, p.text);
  assert.equal(spoken.speech, 'ar');
}
for (const lang of R.CONTENT_LOCALES) {
  const gap = R.resolveSlot(Ak.AKHDARI_GAP, lang);
  assert.ok(gap.text);
  assert.equal(gap.verified, false);
  assert.ok(gap.flag === R.FLAG_TRANSLATION || gap.flag === R.FLAG_SCHOLAR);
}

const rulings = F.allRulingLocales();
assert.ok(rulings.length > 10);
for (const r of rulings) {
  for (const lang of R.CONTENT_LOCALES) {
    const matn = R.resolveSlot(r.matn, lang);
    const note = R.resolveSlot(r.explanation, lang);
    assert.ok(matn.text && matn.source && matn.flag);
    assert.ok(note.text && note.source && note.flag);
    assert.equal(matn.verified, false);
    assert.equal(note.verified, false);
  }
  assert.equal(R.resolveSlot(r.matn, 'ar').kind, 'matn');
  if (r.id === 'maliki-wudu-faraid') {
    assert.equal(R.resolveSlot(r.explanation, 'ha').kind, 'fallback');
    assert.equal(R.spokenOf(r.explanation, 'ha').speech, 'fr-FR');
  }
}
console.log('test-religious-locales OK', paragraphs.length, 'paragraphes', rulings.length, 'jugements', R.CONTENT_LOCALES.length, 'langues');
