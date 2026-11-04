// Tests du Mode Focus : minuteur, minimum de 10 min, pauses en arrière-plan, restauration, série.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadLib } from './load-lib.mjs';
const { 'focus-core': F } = await loadLib(['focus-core'], 'focus');

const T0 = new Date(2026, 10, 4, 9, 0, 0).getTime();
const MIN = 60_000;

test('durées proposées et minimum de 10 minutes', () => {
  assert.deepEqual([...F.FOCUS_DURATIONS], [10, 15, 20, 30]);
  assert.equal(F.FOCUS_MIN_MINUTES, 10);
  assert.equal(F.clampMinutes(3), 10);
  assert.equal(F.clampMinutes(0), 10);
  assert.equal(F.clampMinutes(-5), 10);
  assert.equal(F.clampMinutes(NaN), 10);
  assert.equal(F.clampMinutes(15), 15);
  assert.equal(F.clampMinutes(999), F.FOCUS_MAX_MINUTES);
  assert.equal(F.startFocus(5, T0).plannedMs, 10 * MIN);
});

test('le minuteur avance, ne dépasse pas la durée, la sortie libre n’arrive qu’à la fin', () => {
  const s = F.startFocus(10, T0, 'tasbih');
  assert.equal(F.remainingMs(s, T0), 10 * MIN);
  assert.equal(F.progressOf(s, T0 + 5 * MIN), 0.5);
  assert.equal(F.canLeaveFreely(s, T0 + 9 * MIN + 59_000), false);
  assert.equal(F.canLeaveFreely(s, T0 + 10 * MIN), true);
  assert.equal(F.remainingMs(s, T0 + 60 * MIN), 0);
  assert.equal(F.focusedMs(s, T0 + 60 * MIN), 10 * MIN);
  assert.equal(F.progressOf(s, T0 + 60 * MIN), 1);
});

test('arrière-plan : pause, absence notée, reprise ; le temps hors app ne compte pas', () => {
  let s = F.startFocus(10, T0);
  s = F.pauseFocus(s, T0 + 4 * MIN);
  assert.equal(F.isPaused(s), true);
  assert.equal(F.focusedMs(s, T0 + 30 * MIN), 4 * MIN, 'figé pendant l’absence');
  assert.equal(F.canLeaveFreely(s, T0 + 30 * MIN), false, 'quitter l’app ne raccourcit pas la séance');
  const r = F.resumeFocus(s, T0 + 6 * MIN);
  assert.equal(r.awayMs, 2 * MIN);
  assert.equal(r.session.interruptions.length, 1);
  assert.equal(F.remainingMs(r.session, T0 + 6 * MIN), 6 * MIN);
  assert.equal(F.isComplete(r.session, T0 + 12 * MIN), true);
  // double pause / double reprise : sans effet
  assert.equal(F.pauseFocus(F.pauseFocus(s, T0 + 5 * MIN), T0 + 9 * MIN).accumulatedMs, 4 * MIN);
  assert.equal(F.resumeFocus(r.session, T0 + 7 * MIN).awayMs, 0);
});

test('une bascule éclair (< 1 s) n’est pas une interruption', () => {
  const s = F.pauseFocus(F.startFocus(10, T0), T0 + MIN);
  const r = F.resumeFocus(s, T0 + MIN + 400);
  assert.equal(r.awayMs, 0);
  assert.equal(r.session.interruptions.length, 0);
});

test('restauration après fermeture : le temps après le dernier signe de vie ne compte pas', () => {
  let s = F.startFocus(15, T0);
  s = F.heartbeat(s, T0 + 3 * MIN);
  const stored = JSON.parse(JSON.stringify(s));
  const r = F.restoreFocus(stored, T0 + 20 * MIN);
  assert.ok(r.session);
  assert.equal(F.focusedMs(r.session, T0 + 20 * MIN), 3 * MIN);
  assert.equal(r.awayMs, 17 * MIN);
  assert.equal(r.session.interruptions.length, 1);
  // séance en pause stockée : reprise avec l'absence
  const p = F.restoreFocus(JSON.parse(JSON.stringify(F.pauseFocus(s, T0 + 5 * MIN))), T0 + 8 * MIN);
  assert.equal(p.awayMs, 3 * MIN);
  assert.equal(F.remainingMs(p.session, T0 + 8 * MIN), 10 * MIN);
});

test('restauration : données invalides, séance trop ancienne, minimum réimposé', () => {
  assert.equal(F.restoreFocus(null, T0).session, null);
  assert.equal(F.restoreFocus({ id: 3 }, T0).session, null);
  const old = F.startFocus(10, T0);
  const r = F.restoreFocus(old, T0 + F.STALE_AFTER_MS + MIN);
  assert.equal(r.session, null);
  assert.ok(r.stale);
  const tampered = { ...F.startFocus(10, T0), plannedMs: 60_000 };
  assert.equal(F.restoreFocus(tampered, T0 + 1000).session.plannedMs, 10 * MIN);
});

test('fin de séance : terminée seulement si la durée est atteinte ; sortie d’urgence = non terminée', () => {
  let s = F.startFocus(10, T0, 'quran');
  s = F.resumeFocus(F.pauseFocus(s, T0 + MIN), T0 + 3 * MIN).session;
  const early = F.finishFocus(s, T0 + 5 * MIN, false);
  assert.equal(early.completed, false);
  assert.equal(early.focusedMs, 3 * MIN);
  assert.equal(early.interruptions, 1);
  assert.equal(early.awayMs, 2 * MIN);
  assert.equal(early.activity, 'quran');
  assert.equal(F.finishFocus(s, T0 + 5 * MIN, true).completed, false, 'pas de « terminée » avant l’heure');
  const done = F.finishFocus(s, T0 + 12 * MIN, true);
  assert.equal(done.completed, true);
  assert.equal(done.plannedMin, 10);
  assert.equal(done.day, '2026-11-04');
});

test('historique et série de jours', () => {
  const day = (d) => new Date(2026, 10, d, 9).getTime();
  const rec = (d, completed = true, id = 'r' + d) => ({ ...F.finishFocus(F.startFocus(10, day(d)), day(d) + 11 * MIN, completed), id });
  let h = [];
  for (const d of [1, 2, 3, 4]) h = F.addRecord(h, rec(d));
  h = F.addRecord(h, rec(4, false, 'x'));
  assert.equal(h.length, 5);
  assert.equal(h[0].id, 'x');
  assert.equal(F.addRecord(h, rec(4, true, 'x')).length, 5, 'pas de doublon');
  assert.equal(F.focusStreak(h, '2026-11-04'), 4);
  assert.equal(F.focusStreak(h, '2026-11-05'), 4, 'la série tient jusqu’au lendemain');
  assert.equal(F.focusStreak(h, '2026-11-06'), 0);
  assert.equal(F.focusStreak([rec(3, false)], '2026-11-03'), 0, 'une sortie d’urgence ne compte pas');
  assert.deepEqual(F.focusTotals(h), { sessions: 4, minutes: 40 });
  assert.equal(F.addRecord(h, rec(9), 3).length, 3);
// passage de mois
  const oct31 = { ...rec(1, true, 'a'), day: '2026-10-31' };
  const nov1 = { ...rec(1, true, 'b'), day: '2026-11-01' };
  assert.equal(F.focusStreak([nov1, oct31], '2026-11-01'), 2);
});

test('affichage et paliers annoncés', () => {
  assert.equal(F.formatClock(10 * MIN), '10:00');
  assert.equal(F.formatClock(65_001), '1:06');
  assert.equal(F.formatClock(0), '0:00');
  assert.equal(F.formatClock(-5), '0:00');
  assert.equal(F.minutesLeft(4 * MIN + 1), 5);
  assert.equal(F.crossedMilestone(5 * MIN + 500, 5 * MIN - 500), 5);
  assert.equal(F.crossedMilestone(6 * MIN, 5 * MIN + 1), null);
  assert.equal(F.crossedMilestone(61_000, 59_000), 1);
  assert.equal(F.EMERGENCY_HOLD_MS, 3000);
});
