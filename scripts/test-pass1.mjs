// Passe 1 (brief §3, §16) : options de calcul des prières, plan de rappels réel sur 7 jours, mode dispense,
// séries neutres, et « le cœur ne dépend d'aucune API payante ».
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadLib } from './load-lib.mjs';

const M = await loadLib(['prayer', 'notify-plan', 'dispense', 'streak', 'khatma', 'app-placeholders', 'bilal-errors'], 'pass1');
const P = M.prayer, N = M['notify-plan'], D = M.dispense, S = M.streak, K = M.khatma, A = M['app-placeholders'], B = M['bilal-errors'];
let ok = 0;
const t = (name, fn) => {
  fn();
  ok++;
  console.log('✓ ' + name);
};
const ZRH = { label: 'Zurich', lat: 47.3769, lng: 8.5417, source: 'manual' };
const OSLO = { label: 'Oslo', lat: 59.9139, lng: 10.7522, source: 'manual' };
const day = new Date(2026, 10, 2, 12);
const min = (d) => d.getHours() * 60 + d.getMinutes();

// ---------- Méthodes et options ----------
t('méthodes du brief présentes (MWL, UOIF, Umm al-Qura, ISNA, Égypte, Karachi, Diyanet)', () => {
  for (const k of ['MuslimWorldLeague', 'UOIF', 'UmmAlQura', 'NorthAmerica', 'Egyptian', 'Karachi', 'Turkey']) assert.ok(P.isMethodKey(k), k);
  for (const k of Object.keys(P.METHODS)) {
    const r = P.computeDay(day, ZRH, k, 'shafi');
    assert.equal(r.length, 6);
    for (let i = 1; i < 6; i++) assert.ok(r[i].time > r[i - 1].time, `${k} ordre`);
  }
});
t('UOIF 12°/12° : Fajr plus tard et Isha plus tôt que MWL 18°/17°', () => {
  const u = P.computeDay(day, ZRH, 'UOIF', 'shafi');
  const m = P.computeDay(day, ZRH, 'MuslimWorldLeague', 'shafi');
  assert.ok(u[0].time > m[0].time && u[5].time < m[5].time);
  assert.ok(Math.abs(u[2].time - m[2].time) <= 60000, 'Dhuhr identique (MWL ajoute +1 min de précaution)');
});
t('méthode inconnue → MWL ; défaut = YOUR_DEFAULT_PRAYER_METHOD tant que non fourni → MWL (aucun changement)', () => {
  assert.deepEqual(P.computeDay(day, ZRH, 'Nope', 'shafi').map((r) => +r.time), P.computeDay(day, ZRH, 'MuslimWorldLeague', 'shafi').map((r) => +r.time));
  assert.equal(A.PLACEHOLDERS.DEFAULT_PRAYER_METHOD, 'YOUR_DEFAULT_PRAYER_METHOD');
  assert.equal(A.resolveDefaultMethod(), 'MuslimWorldLeague');
  assert.equal(A.resolveDefaultMethod('UOIF'), 'UOIF');
  assert.equal(A.resolveDefaultMethod('Inventée'), 'MuslimWorldLeague');
});
t('Asr hanafite (ombre ×2) après Asr majoritaire', () => {
  assert.ok(P.computeDay(day, ZRH, 'MuslimWorldLeague', 'hanafi')[3].time > P.computeDay(day, ZRH, 'MuslimWorldLeague', 'shafi')[3].time);
});
t('ajustements ±minutes, bornés à ±30', () => {
  const base = P.computeDay(day, ZRH, 'MuslimWorldLeague', 'shafi');
  const a = P.computeDay(day, ZRH, 'MuslimWorldLeague', 'shafi', { adjust: { fajr: 5, isha: -3, dhuhr: 999 } });
  assert.equal(min(a[0].time) - min(base[0].time), 5);
  assert.equal(min(a[5].time) - min(base[5].time), -3);
  assert.equal(min(a[2].time) - min(base[2].time), 30);
});
t('hautes latitudes (Oslo, juin) : règle choisie appliquée, horaires valides', () => {
  const june = new Date(2026, 5, 21, 12);
  const res = {};
  for (const r of P.HIGH_LAT_RULES) {
    const d = P.computeDay(june, OSLO, 'MuslimWorldLeague', 'shafi', { highLat: r });
    for (const x of d) assert.ok(Number.isFinite(x.time.getTime()), `${r} ${x.key}`);
    res[r] = +d[0].time;
  }
  assert.notEqual(res.middleofthenight, res.seventhofthenight);
});
t('« Horaires de ma mosquée » prioritaires ; case vide ou invalide → calcul ; ordre cassé → calcul', () => {
  const base = P.computeDay(day, ZRH, 'MuslimWorldLeague', 'shafi');
  const m = P.computeDay(day, ZRH, 'MuslimWorldLeague', 'shafi', { adjust: { fajr: 10 }, mosque: { enabled: true, times: { fajr: '06:15', dhuhr: '12h45', asr: 'xx', isha: '01:00' } } });
  assert.equal(P.hhmm(m[0].time), '06:15');
  assert.equal(m[0].source, 'mosque');
  assert.equal(P.hhmm(m[2].time), '12:45');
  assert.equal(m[3].source, 'calc');
  assert.equal(+m[3].time, +base[3].time);
  assert.equal(m[5].source, 'calc', 'Isha 01:00 avant Maghrib → refusé');
  const off = P.computeDay(day, ZRH, 'MuslimWorldLeague', 'shafi', { mosque: { enabled: false, times: { fajr: '06:15' } } });
  assert.equal(off[0].source, 'calc');
  assert.equal(P.parseHHMM('24:00'), null);
  assert.equal(P.parseHHMM('5:07'), 307);
});

// ---------- Plan réel sur 7 jours ----------
const prefs = { prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, before: 10, friday: true, adhkar: true, wird: true, quran: 'isha' };
const L = { prayer: { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' }, place: 'Zurich', atTime: 'Heure', inMin: (n) => `dans ${n} min`, kahfTitle: 'Kahf', kahfBody: '', jumuaTitle: 'Jumua', jumuaBody: '', morningTitle: 'AM', eveningTitle: 'PM', adhkarBody: '', wirdMorning: 'WA', wirdEvening: 'WP', wazifa: 'Waz', hailala: 'Hail', wirdBody: '', quranTitle: 'Coran', quranBody: '', pausedTitle: 'Pause', pausedBody: '' };
for (const [place, start, label] of [
  [ZRH, new Date(2026, 9, 24, 22, 0), 'Zurich, passage à l’heure d’hiver'],
  [OSLO, new Date(2026, 5, 18, 23, 30), 'Oslo, juin'],
  [ZRH, new Date(2027, 2, 24, 9, 0), 'Zurich, passage à l’heure d’été'],
]) {
  t(`plan réel adhan (${label}) : 7 jours sans trou, ≤ 64`, () => {
    const compute = (d) => P.computeDay(d, place, 'MuslimWorldLeague', 'shafi');
    const plan = N.buildPlan(start, compute, prefs, L);
    assert.ok(plan.length <= 64, String(plan.length));
    const have = new Set(plan.filter((e) => e.kind === 'prayer').map((e) => +e.date));
    const end = start.getTime() + 7 * 86400000;
    let n = 0;
    for (let i = 0; i <= 8; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
      for (const x of compute(d)) {
        if (x.key === 'sunrise' || +x.time <= start.getTime() || +x.time > end) continue;
        n++;
        assert.ok(have.has(+x.time), `${x.key} ${x.time}`);
      }
    }
    assert.ok(n >= 34);
  });
}

// ---------- Mode dispense ----------
const d0 = new Date(2026, 9, 26, 9);
const at = (n) => new Date(2026, 9, 26 + n, 9);
t('dispense : début, reprise automatique, historique, niveau de pause', () => {
  let s = D.start(D.DEFAULT_DISPENSE, d0, 5);
  assert.equal(s.since, '2026-10-26');
  assert.equal(s.until, '2026-10-31');
  assert.equal(D.pauseLevel(s, at(2)), 'prayers');
  assert.equal(D.pauseLevel(s, at(5)), 'none', 'reprise le 31');
  assert.equal(D.pauseLevel({ ...s, alsoOthers: true }, at(1)), 'all');
  assert.ok(D.isPausedDay(s, '2026-10-30') && !D.isPausedDay(s, '2026-10-31') && !D.isPausedDay(s, '2026-10-25'));
  s = D.normalize(s, at(6));
  assert.equal(s.active, false);
  assert.deepEqual(s.history, [{ from: '2026-10-26', to: '2026-10-30' }]);
  assert.ok(D.isPausedDay(s, '2026-10-28'), 'reste neutre après la fin');
  const m = D.stop(D.start(D.DEFAULT_DISPENSE, d0), at(2));
  assert.deepEqual(m.history, [{ from: '2026-10-26', to: '2026-10-28' }]);
  assert.equal(D.clearHistory(m).history.length, 0);
  assert.equal(D.start(D.DEFAULT_DISPENSE, d0, 999).until, '2026-12-25', 'borné à 60 jours');
});
t('dispense : plan de rappels sans prières pendant la pause, reprise ensuite', () => {
  const s = D.start(D.DEFAULT_DISPENSE, d0, 3);
  const compute = (d) => P.computeDay(d, ZRH, 'MuslimWorldLeague', 'shafi');
  const plan = N.buildPlan(d0, compute, prefs, L, 63, 30, (d) => D.pauseLevel(s, d));
  const until = new Date(2026, 9, 29, 0, 0);
  assert.ok(!plan.some((e) => e.date < until && (e.kind === 'prayer' || e.kind === 'before')));
  assert.ok(plan.some((e) => e.date >= until && e.kind === 'prayer'));
  assert.ok(plan.length <= 64);
});
t('séries : un jour en pause ne compte pas et ne casse pas la série', () => {
  const act = new Set(['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-26', '2026-10-27']);
  const neutral = (k) => k >= '2026-10-23' && k <= '2026-10-25';
  const today = new Date(2026, 9, 27, 20);
  assert.equal(S.streak((k) => act.has(k), today), 2);
  assert.equal(S.streak((k) => act.has(k), today, neutral), 5);
  assert.equal(S.bestStreak([...act]), 3);
  assert.equal(S.bestStreak([...act], neutral), 5);
  // pause en cours aujourd’hui et hier : la série d’avant reste visible
  assert.equal(S.streak((k) => ['2026-10-20', '2026-10-21'].includes(k), new Date(2026, 9, 23, 9), (k) => k >= '2026-10-22'), 2);
  const r = K.streak([...act], '2026-10-27', neutral);
  assert.equal(r.current, 5);
  assert.equal(r.best, 5);
  assert.deepEqual(K.streak([...act], '2026-10-27'), { current: 2, best: 3, todayDone: true }, 'sans pause : inchangé');
});
t('dispense : jamais synchronisée (clé absente de la synchro communauté et du serveur)', () => {
  const root = new URL('..', import.meta.url).pathname;
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(ts|tsx|sql)$/.test(f.name)) files.push(p);
    }
  };
  walk(join(root, 'src/lib/community'));
  walk(join(root, 'supabase'));
  for (const f of files) assert.ok(!/dispense/i.test(readFileSync(f, 'utf8')), f);
});

// ---------- Cœur sans API payante ----------
t('Bilal : 402 / 529 / 5xx → « indisponible » (message calme), jamais bloquant', () => {
  assert.equal(B.codeFromResponse(503, { error: 'unavailable' }), 'unavailable');
  assert.equal(B.codeFromResponse(402, null), 'unavailable');
  assert.equal(B.codeFromResponse(529, null), 'unavailable');
  assert.equal(B.codeFromResponse(502, { error: 'upstream' }), 'unavailable');
  assert.equal(B.codeFromResponse(429, { error: 'quota' }), 'quota');
  assert.equal(B.codeFromResponse(503, { error: 'not_configured' }), 'not_configured');
  assert.match(B.bilalErrorFr(new B.BilalError('unavailable')), /reste de Zikru fonctionne/);
  const edge = readFileSync(new URL('../supabase/functions/bilal/index.ts', import.meta.url), 'utf8');
  assert.match(edge, /402[\s\S]*529/);
});
t('modules du cœur (prières, rappels, hijri, tasbih, Coran hors-ligne, séries) : ni Supabase ni IA, pas de réseau (sauf téléchargement hors-ligne volontaire)', () => {
  const lib = new URL('../src/lib/', import.meta.url).pathname;
  const core = ['prayer', 'notify-plan', 'hijri', 'zikr', 'tasbih-log', 'khatma', 'streak', 'dispense', 'quran-offline', 'quran-nav', 'srs', 'abjad'];
  const seen = new Set();
  const visit = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const f = join(lib, rel + '.ts');
    if (!existsSync(f)) return;
    const src = readFileSync(f, 'utf8');
    const code = src.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/supabase|bilal|anthropic|openai/i.test(code), `${rel} dépend d’un service payant / IA`);
    // seul réseau toléré : texte/traductions du Coran depuis l’API publique gratuite alquran.cloud (mis en cache, téléchargeable pour le hors-ligne)
    if (!['quran-offline', 'quran'].includes(rel)) assert.ok(!/\bfetch\(|XMLHttpRequest/.test(code), `${rel} touche le réseau`);
    for (const m of src.matchAll(/from '\.\/([\w-]+)'/g)) visit(m[1]);
  };
  core.filter((c) => existsSync(join(lib, c + '.ts'))).forEach(visit);
  assert.ok(seen.size >= 8, [...seen].join(','));
});
console.log(`Passe 1 : ${ok} tests passent.`);
