// Panneau d’enseignement : le Coran ne voyage pas, un élève ne change pas le passage, un collage exige une source.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'calls/teach': T, 'quran-nav': N } = await loadLib(['calls/teach', 'quran-nav'], 'teach');

const call = 'cercle-1';
const opened = T.drive(null, call, { type: 'surah', surah: 1, from: 1, to: 7 }, true, 1000);
assert.equal(opened.ok, true);
assert.equal(opened.board.kind, 'quran');
assert.equal(T.quranCite(opened.board), '1:1–7');
assert.equal(opened.board.page, N.pageOf(1, 1));
assert.equal(T.teachChip(opened.board).page, opened.board.page);
assert.equal(T.teachChip(opened.board).hizb, N.rubLabel(N.rubOfIndex(opened.board.focus)));
assert.equal(JSON.stringify(opened.board).includes('بِسْم'), false, 'le verset n’est pas dans le message');

const pupil = T.drive(opened.board, call, { type: 'ayah', dir: 1 }, false);
assert.equal(pupil.ok, false);
assert.equal(pupil.reason, 'not-teacher');

let board = opened.board;
for (let i = 0; i < 6; i++) {
  const step = T.drive(board, call, { type: 'ayah', dir: 1 }, true, 2000 + i);
  assert.equal(step.ok, true);
  board = step.board;
}
assert.equal(board.focus, opened.board.focus + 6);
assert.equal(T.decodeTeach(T.encodeTeach(board)).focus, board.focus);
const back = T.decodeTeach(T.teachText(T.teachBytes(T.encodeTeach(board))));
assert.equal(back.focus, board.focus);
assert.equal(T.acceptTeach(board, back), null, 'même révision ignorée');
const older = { ...back, revision: 1 };
assert.equal(T.acceptTeach(board, older), null);
const other = T.drive(null, 'autre', { type: 'surah', surah: 2, from: 1, to: 5 }, true);
assert.equal(T.acceptTeach(board, other.board), null);

const page = T.drive(board, call, { type: 'page', page: 2 }, true);
assert.equal(page.ok, true);
assert.equal(page.board.page, 2);
assert.equal(page.board.focus, N.pageRange(2)[0]);
const next = T.drive(page.board, call, { type: 'pageStep', dir: 1 }, true);
assert.equal(next.board.page, 3);
const edge = T.drive(page.board, call, { type: 'pageStep', dir: -1 }, true);
assert.equal(edge.board.page, 1);
const stop = T.drive(edge.board, call, { type: 'pageStep', dir: -1 }, true);
assert.equal(stop.reason, 'edge');

const hizb = T.drive(null, call, { type: 'hizb', hizb: 1 }, true);
assert.equal(hizb.ok, true);
assert.equal(hizb.board.start, N.hizbRange(1)[0]);
assert.equal(T.drive(null, call, { type: 'surah', surah: 1, from: 5, to: 2 }, true).reason, 'range');

const noSource = T.drive(null, call, { type: 'paste', hadith: true, text: 'texte', source: '  ' }, true);
assert.equal(noSource.reason, 'source');
const pasted = T.drive(null, call, { type: 'paste', hadith: true, text: 'إِنَّمَا الأَعْمَالُ', source: 'Bukhari 1' }, true);
assert.equal(pasted.ok, true);
assert.equal(pasted.board.teacherProvided, true);
assert.equal(pasted.board.hadith, true);
assert.equal(pasted.board.source, 'Bukhari 1');
assert.equal(T.LICENSED_HADITH_IDS.length, 0);
assert.equal(T.licensedHadith('niyya'), null);
assert.equal(T.canHostTeaching(true, false), false);
assert.equal(T.canHostTeaching(true, true), true);
assert.equal(T.canHostTeaching(false, true), false);
assert.equal(T.canViewTeaching(), true);
assert.equal(T.nextZoom(1, 1), 1.25);
assert.equal(T.encodeTeach(opened.board), T.encodeTeach({ ...opened.board }), 'le zoom n’est pas dans le message');

const off = T.drive(pasted.board, call, { type: 'off' }, true);
assert.equal(off.board.kind, 'off');
assert.equal(T.acceptTeach(null, off.board).kind, 'off');

function lin(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function contrast(a, b) {
  const lum = (h) => {
    const n = parseInt(h.slice(1), 16);
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
for (const scheme of ['light', 'dark']) {
  const p = T.teachPlate(scheme);
  assert.ok(contrast(p.fg, p.bg) >= 4.5, scheme + ' texte');
  assert.ok(contrast(p.fg, p.hi) >= 4.5, scheme + ' surlignage');
  assert.ok(contrast(p.fg, p.chip) >= 4.5, scheme + ' pastille');
}

const late = T.acceptTeach(null, page.board);
assert.equal(late.page, 2);
console.log('test-teach OK');
