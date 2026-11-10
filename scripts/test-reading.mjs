// Position partagée : le texte Tanzil n’est pas modifié, le canal ne transporte pas le verset.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadLib } from './load-lib.mjs';

const root = join(import.meta.dirname, '..');
const { 'lessons/reading': R } = await loadLib(['lessons/reading'], 'reading');

const raw = [
  '# Tanzil',
  '1|1|بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  '2|1|بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ الٓمٓ',
  '2|2|ذَٰلِكَ الْكِتَابُ',
].join('\n');
const lines = R.passageFromTanzil(raw, 2, 1, 2);
assert.equal(lines.length, 2);
assert.equal(lines[0].text, 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ الٓمٓ', 'la basmala du verset 1 reste');
assert.equal(lines[0].words.length, 5);
assert.ok(lines.every(R.verseIntact), 'joindre les mots redonne le verset');
assert.equal(R.passageFromTanzil(raw, 2, 3, 4).length, 0);

const uth = readFileSync(join(root, 'src/lib/quran-uthmani.ts'), 'utf8');
const at = uth.indexOf('2|1|');
const end = uth.indexOf('\\n', at);
const embedded = uth.slice(at + 4, end);
assert.ok(embedded.startsWith('بِسْمِ'), 'le Hafs embarqué commence par la basmala en 2:1');
const shown = R.passageFromTanzil(`2|1|${embedded}`, 2, 1, 1);
assert.equal(shown[0].text, embedded, 'l’écran recopie le verset embarqué');
assert.ok(R.verseIntact(shown[0]));

const lesson = '42000000-0000-4000-8000-000000000010';
const teacher = '42000000-0000-4000-8000-000000000002';
const student = '42000000-0000-4000-8000-000000000003';
let state = {
  lessonId: lesson,
  surah: 1,
  ayahFrom: 1,
  ayahTo: 7,
  focusAyah: 1,
  focusWord: null,
  driverId: null,
  revision: 1,
  page: 1,
  marks: [],
};

const moved = R.applyReadingOp(state, { type: 'focus', ayah: 2, word: 0, wordCount: 4, actorId: teacher, teacher: true, page: 1 });
assert.equal(moved.ok, true);
assert.equal(moved.state.focusAyah, 2);
assert.equal(moved.state.focusWord, 0);
assert.equal(moved.state.revision, 2);
state = moved.state;

const pupil = R.applyReadingOp(state, { type: 'focus', ayah: 3, word: 0, wordCount: 4, actorId: student, teacher: false, page: 1 });
assert.equal(pupil.ok, false);
assert.equal(pupil.reason, 'not-driver');

const outside = R.applyReadingOp(state, { type: 'focus', ayah: 8, word: 0, wordCount: 4, actorId: teacher, teacher: true, page: 1 });
assert.equal(outside.reason, 'range');
const far = R.applyReadingOp(state, { type: 'focus', ayah: 2, word: 9, wordCount: 4, actorId: teacher, teacher: true, page: 1 });
assert.equal(far.reason, 'word');

const handed = R.applyReadingOp(state, { type: 'hand', to: student, actorTeacher: true, members: [student] });
assert.equal(handed.ok, true);
assert.equal(handed.state.driverId, student);
const stranger = R.applyReadingOp(state, { type: 'hand', to: '42000000-0000-4000-8000-000000000099', actorTeacher: true, members: [student] });
assert.equal(stranger.ok, false);
const studentHand = R.applyReadingOp(state, { type: 'hand', to: teacher, actorTeacher: false, members: [teacher] });
assert.equal(studentHand.reason, 'not-teacher');

const led = R.applyReadingOp(handed.state, { type: 'focus', ayah: 4, word: null, wordCount: 3, actorId: student, teacher: false, page: 1 });
assert.equal(led.ok, true);
assert.equal(led.state.focusAyah, 4);
assert.equal(led.state.focusWord, null);

const mark = R.applyReadingOp(led.state, {
  type: 'mark',
  actorTeacher: true,
  mark: { id: 'm1', surah: 1, ayah: 4, word: 1, kind: 'tajweed', comment: 'ghunna' },
});
assert.equal(mark.ok, true);
assert.equal(mark.state.marks[0].comment, 'ghunna');
assert.equal(JSON.stringify(mark.state).includes('الْحَمْدُ'), false, 'le verset n’entre pas dans l’état');
const empty = R.applyReadingOp(mark.state, {
  type: 'mark',
  actorTeacher: true,
  mark: { id: 'm2', surah: 1, ayah: 4, word: null, kind: 'comment', comment: '   ' },
});
assert.equal(empty.reason, 'comment');
const byStudent = R.applyReadingOp(mark.state, {
  type: 'mark',
  actorTeacher: false,
  mark: { id: 'm3', surah: 1, ayah: 4, word: 0, kind: 'tajweed', comment: '' },
});
assert.equal(byStudent.reason, 'not-teacher');

const back = R.applyReadingOp(mark.state, { type: 'passage', surah: 1, from: 5, to: 7, actorTeacher: true, page: 1 });
assert.equal(back.ok, true);
assert.equal(back.state.focusAyah, 5);
assert.equal(back.state.driverId, null, 'changer de passage rend la main');
assert.equal(back.state.marks.length, 1, 'la marque reste pour la relecture');
assert.equal(R.marksOn(back.state, 4, 1).length, 1);

const wire = R.encodeReading(back.state);
assert.equal(wire.includes('بِسْمِ'), false, 'le canal ne transporte pas le verset');
const parsed = JSON.parse(wire);
parsed.text = 'بِسْمِ اللَّهِ modifié';
const clean = R.decodeReading(JSON.stringify(parsed));
assert.equal(clean.ayah, 5);
assert.equal(clean.page, 1);
assert.equal('text' in clean, false);
assert.equal(R.acceptRemote(back.state, clean), null, 'même révision ignorée');
const newer = { ...clean, revision: clean.revision + 1, ayah: 6, page: 1 };
assert.equal(R.acceptRemote(back.state, newer).focusAyah, 6);
assert.equal(R.acceptRemote(back.state, { ...newer, lessonId: '42000000-0000-4000-8000-000000000011' }), null);
assert.equal(R.decodeReading('{"v":1}'), null);
assert.equal(R.readingText(R.readingBytes(wire)), wire);

const screen = readFileSync(join(root, 'src/components/lesson/shared-reading.tsx'), 'utf8');
assert.ok(screen.includes("import('@/lib/quran-uthmani')"), 'le texte lu est le Hafs embarqué');
assert.ok(!screen.includes('stripBasmala'), 'la basmala n’est pas retirée');
assert.ok(!screen.includes('alquran.cloud'), 'pas de texte téléchargé à la place du Tanzil');
const home = readFileSync(join(root, 'src/app/(tabs)/index.tsx'), 'utf8');
assert.ok(!home.includes('SharedReading') && !home.includes('/lesson/'), 'l’accueil n’ouvre pas la lecture');

console.log('test-reading OK');
