// Tests de l’étape Al-Fatiha (src/lib/fatiha.ts) : texte identique au Tanzil uthmani embarqué, insertion 1× en tête.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLib } from './load-lib.mjs';

const { fatiha: F } = await loadLib(['fatiha'], 'fat');
const src = readFileSync(new URL('../src/lib/quran-uthmani.ts', import.meta.url), 'utf8');
const s1 = src.split(/\\n|\n/).map((l) => l.replace(/^.*[`'"](?=1\|1\|)/, '')).filter((l) => /^1\|\d+\|/.test(l)).map((l) => l.split('|').slice(2).join('|'));
assert.equal(s1.length, 7, 'sourate 1 : 7 versets');
assert.deepEqual([...F.FATIHA_AYAHS], s1, 'texte arabe identique au Tanzil uthmani (jamais modifié)');
// Le texte affiché = versets + marques de fin de verset uniquement.
assert.equal(F.FATIHA_AR.replace(/ \u06DD[٠-٩]+/g, '\u0000').split('\u0000').filter(Boolean).map((t) => t.trim()).join('|'), s1.join('|'));

const it = F.fatihaItem();
assert.equal(it.reps, 1);
assert.equal(it.ref, '1:1-7');
assert.ok(F.isFatiha(it));
assert.ok(F.isFatiha({ id: 'x', kind: 'quran', ref: '1:1-7' }));
assert.ok(F.isFatiha({ id: 'x', kind: 'verse', ref: 'Coran 1' }));
assert.ok(!F.isFatiha({ id: 'x', kind: 'quran', ref: '1:1' === '1:1' ? '2:255' : '' }));
assert.ok(!F.isFatiha({ id: 'x', kind: 'dhikr', ref: '1:1-7' }));
assert.ok(!F.isFatiha({ id: 'x', kind: 'quran', ref: '112' }));

const a = { id: 'a', kind: 'dhikr', label: 'Subhana Allah', ar: 'سُبْحَانَ ٱللَّهِ', reps: 33 };
const items = [a];
const w = F.withFatiha(items, true);
assert.equal(w.length, 2);
assert.equal(w[0].id, F.FATIHA_ITEM_ID);
assert.equal(w[1], a);
assert.equal(items.length, 1, 'la composition enregistrée n’est pas modifiée');
assert.equal(F.withFatiha(items, false), items, 'réglage désactivé : inchangé');
assert.deepEqual(F.withFatiha([], true), [], 'composition vide : rien ajouté');
assert.equal(F.withFatiha(w, true), w, 'pas de doublon si la Fatiha est déjà en tête');
const own = [{ id: 'u', kind: 'quran', ref: '1:1-7', reps: 3 }, a];
assert.equal(F.withFatiha(own, true), own, 'Fatiha ajoutée par l’utilisateur : respectée');
console.log('test-fatiha OK');
