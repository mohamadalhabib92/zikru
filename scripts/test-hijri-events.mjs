// v2 §3 : événements hégiriens (dates seulement, même source que hijri.ts), jeûnes jamais suggérés pendant le Ramadan / l'Aïd.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'hijri-events': E, hijri: H } = await loadLib(['hijri-events', 'hijri'], 'hijri-events');
let ok = 0;
const t = (name, fn) => {
  fn();
  ok++;
  console.log('✓ ' + name);
};
const from = new Date(2026, 10, 2, 12);
const ev = E.upcomingHijriEvents(from, { cal: 'tabular' });

t('chaque événement fixe tombe sur sa date hégirienne (calendrier tabulaire)', () => {
  for (const e of ev) {
    const h = H.toHijri(new Date(e.day + 'T12:00:00'), 0, 'tabular');
    assert.deepEqual(h, e.hijri, e.kind);
    const f = E.FIXED_EVENTS.find((x) => x.kind === e.kind);
    if (f) assert.ok(h.month === f.month && h.day === f.day, e.kind);
  }
});
t('sur 365 jours : Ramadan, Aïd al-Fitr, Aïd al-Adha, Nouvel an et Achoura présents une fois', () => {
  for (const k of ['ramadan', 'eid-fitr', 'eid-adha', 'new-year', 'ashura']) assert.equal(ev.filter((e) => e.kind === k).length, 1, k);
});
t('Mawlid absent par défaut, présent seulement si activé', () => {
  assert.equal(ev.filter((e) => e.kind === 'mawlid').length, 0);
  assert.equal(E.upcomingHijriEvents(from, { cal: 'tabular', mawlid: true }).filter((e) => e.kind === 'mawlid').length, 1);
});
t('jours blancs : jamais en Ramadan ni en Dhou al-Hijja (13 = tashrīq), une entrée par mois sinon', () => {
  const w = ev.filter((e) => e.kind === 'white-days');
  assert.ok(w.length >= 9 && w.length <= 11, String(w.length));
  for (const e of w) assert.ok(e.hijri.month !== 9 && e.hijri.month !== 12, JSON.stringify(e.hijri));
});
t('liste triée, inDays croissant, aujourd’hui = 0', () => {
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].inDays >= ev[i - 1].inDays);
  assert.ok(ev.every((e) => e.inDays >= 0 && e.inDays < 365));
});
t('décalage utilisateur : +1 jour avance chaque événement d’un jour', () => {
  const a = E.upcomingHijriEvents(from, { cal: 'tabular', offset: 0, days: 200 }).find((e) => e.kind === 'ramadan');
  const b = E.upcomingHijriEvents(from, { cal: 'tabular', offset: 1, days: 200 }).find((e) => e.kind === 'ramadan');
  assert.equal(b.inDays, a.inDays - 1);
});
t('lundi / jeudi : jamais pendant le Ramadan ni le 1 Chawwal', () => {
  const r = ev.find((e) => e.kind === 'ramadan');
  const n = E.nextMonThu(new Date(r.day + 'T12:00:00'), { cal: 'tabular' });
  const h = H.toHijri(new Date(n.day + 'T12:00:00'), 0, 'tabular');
  assert.ok(!(h.month === 9) && !(h.month === 10 && h.day === 1), JSON.stringify(h));
  assert.ok([1, 4].includes(new Date(n.day + 'T12:00:00').getDay()));
});
t('lundi / jeudi : hors Ramadan, au plus 3 jours d’attente', () => {
  const n = E.nextMonThu(new Date(2026, 10, 3, 12), { cal: 'tabular' }); // mardi
  assert.equal(n.weekday, 4);
  assert.equal(n.inDays, 2);
});
console.log(`test-hijri-events OK : ${ok} tests`);
