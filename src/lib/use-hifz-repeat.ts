/**
 * Lecture de la file de répétition sur le lecteur verset par verset déjà en place
 * (EveryAyah, secours Islamic Network, fichiers déjà téléchargés). Aucune source audio nouvelle.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_REPEAT, clampAyah, clampSurah, materialize, openCursor, parseScope, pauseGapSec, playbackRateSupported, progressFromStep, repeatVerses, skipRepeat, type RepeatScope, type RepeatSettings } from './hifz-repeat';
import { hifzRepeat } from './hifz-repeat-store';
import { hifzPrefs, readerPrefs } from './quran-store';
import { ayahCount, reciterById, type Gap } from './recitation';
import { useShared } from './shared-state';
import { useRecitation } from './use-recitation';

export function useHifzRepeat(surah: number, from: number, to: number, settings: RepeatSettings) {
  const [hp] = useShared(hifzPrefs);
  const [rp] = useShared(readerPrefs);
  const reciter = hp.reciter || rp.reciter || 'alafasy';
  const rateOn = playbackRateSupported();
  const rate = rateOn ? settings.rate : 1;
  const rec = useRecitation({ reciter, rate, gap: pauseGapSec(settings.pauseSec, rate) as Gap, mode: 'normal' });
  const verses = useMemo(() => repeatVerses(settings.scope, surah, from, to), [settings.scope, surah, from, to]);
  const cursor = useMemo(() => openCursor(settings, surah, from, to), [settings, surah, from, to]);

  const playAt = useCallback(
    (index: number) => {
      if (!cursor || !verses.length) return;
      const at = Math.max(0, Math.min(verses.length - 1, index));
      const m = materialize({ ...cursor, index: at, rep: 1, pass: 1 });
      if (!m.queue.length) return;
      void rec.start(m.queue, m.start, m.loop).catch(() => {});
    },
    [cursor, rec, verses.length],
  );

  const jump = useCallback(
    (dir: 1 | -1) => {
      if (!cursor || !rec.step) {
        rec.skip(dir);
        return;
      }
      const idx = verses.findIndex((v) => v.s === rec.step!.s && v.a === rec.step!.a);
      if (settings.each === 0) {
        const next = skipRepeat({ ...cursor, index: Math.max(0, idx) }, dir);
        if (!next) return;
        const m = materialize(next);
        if (m.queue.length) void rec.start(m.queue, 0, m.loop).catch(() => {});
        return;
      }
      rec.skip(dir);
    },
    [cursor, rec, settings.each, verses],
  );

  const progress = progressFromStep(verses, rec.step, settings.each, settings.times);
  const stop = rec.stop;
  const shape = `${settings.scope}|${settings.each}|${settings.times}|${surah}|${from}|${to}`;
  const shaped = useRef(shape);
  useEffect(() => {
    if (shaped.current === shape) return;
    shaped.current = shape;
    stop();
  }, [shape, stop]);
  return { rec, verses, playAt, jump, progress, reciter, rateOn };
}

export type RepeatParams = { s?: string; scope?: string; a?: string; from?: string; to?: string };

/** Réglages persistés + verset ou plage ouverts depuis la navigation. La route gagne pour la portée, une seule fois. */
export function useRepeatSession(params: RepeatParams) {
  const [saved, setSaved, ready] = useShared(hifzRepeat);
  const surah = clampSurah(Number(params.s) || 1);
  const max = ayahCount(surah) || 1;
  const routeScope = parseScope(params.scope);
  const [scope, setScope] = useState<RepeatScope>(routeScope ?? DEFAULT_REPEAT.scope);
  const [ayah, setAyahState] = useState(() => clampAyah(surah, Number(params.a || params.from) || 1));
  const [from, setFromState] = useState(() => clampAyah(surah, Number(params.from || params.a) || 1));
  const [to, setToState] = useState(() => clampAyah(surah, Number(params.to || params.from || params.a) || Math.min(max, 5)));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!ready || hydrated) return;
    setHydrated(true);
    if (routeScope) setSaved((s) => ({ ...s, scope: routeScope }));
    else setScope(saved.scope);
  }, [ready, hydrated, routeScope, saved.scope, setSaved]);

  const each = ready ? saved.each : DEFAULT_REPEAT.each;
  const times = ready ? saved.times : DEFAULT_REPEAT.times;
  const pauseSec = ready ? saved.pauseSec : DEFAULT_REPEAT.pauseSec;
  const rate = ready ? saved.rate : DEFAULT_REPEAT.rate;
  const patch = (p: Partial<RepeatSettings>) => setSaved((s) => ({ ...s, ...p }));
  const settings = useMemo<RepeatSettings>(() => ({ scope, each, times, pauseSec, rate }), [scope, each, times, pauseSec, rate]);
  const spanFrom = scope === 'verse' ? ayah : from;
  const spanTo = scope === 'verse' ? ayah : to;
  const player = useHifzRepeat(surah, spanFrom, spanTo, settings);

  return {
    surah,
    scope,
    ayah,
    from,
    to,
    each,
    times,
    pauseSec,
    rate,
    spanFrom,
    spanTo,
    max,
    player,
    reciterName: reciterById(player.reciter).name,
    chooseScope: (next: RepeatScope) => {
      setScope(next);
      patch({ scope: next });
    },
    setAyah: (n: number) => setAyahState(clampAyah(surah, n)),
    setFrom: (n: number) => {
      const a = clampAyah(surah, n);
      setFromState(a);
      setToState((t) => Math.max(a, t));
    },
    setTo: (n: number) => {
      const b = clampAyah(surah, n);
      setToState(b);
      setFromState((a) => Math.min(a, b));
    },
    setEach: (n: number) => patch({ each: n }),
    setTimes: (n: number) => patch({ times: n }),
    setPause: (n: number) => patch({ pauseSec: n }),
    setRate: (n: number) => patch({ rate: n }),
  };
}
