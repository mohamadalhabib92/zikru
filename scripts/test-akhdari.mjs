// Le JSON vocalisé d’al-Akhdarī est recopié tel quel. Le test refuse toute modification.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLib } from './load-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const bytes = readFileSync(join(root, 'assets/fiqh/akhdari.json'));
const hash = createHash('sha256').update(bytes).digest('hex');
assert.equal(hash, '65948bd45d3aa9c05021b6f378198e365f174feeadf50fa40e4f27055f02dc92');

const items = JSON.parse(bytes.toString('utf8'));
const { 'akhdari-view': V } = await loadLib(['akhdari-view'], 'akhdari');
assert.equal(V.AKHDARI_JSON_SHA256, hash);
const paragraphs = items.filter((x) => x.kind === 'paragraph');
assert.equal(paragraphs.length, 112);
const chapters = V.akhdariChapters(items);
const subs = chapters.reduce((n, c) => n + c.subs.length, 0);
assert.equal(chapters.length + subs, 21, 'chapitres ## et sous-titres ###');
assert.equal(items.filter((x) => String(x.id).startsWith('fm-')).length, 5);
assert.equal(V.chapterParagraphs(items, chapters[0].title)[0].text, paragraphs[0].text);
const spoken = V.splitSentences('أَوَّلُ. ثُمَّ ثَانٍ.');
assert.deepEqual(spoken, ['أَوَّلُ.', 'ثُمَّ ثَانٍ.']);
const credits = readFileSync(join(root, 'assets/fiqh/CREDITS.md'), 'utf8');
assert.match(credits, /Mohamed El Habib Ba/);
assert.match(credits, /domaine public/);
console.log('test-akhdari OK', hash.slice(0, 12));
