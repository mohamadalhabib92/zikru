import { useCallback, useEffect, useState } from 'react';
import { quranEditionLang } from '@/lib/i18n';
import { translationFor } from '@/lib/quran';
import { OFFSETS } from '@/lib/quran-nav';
import { loadSurahUthmani, loadUthmani, peekSurahUthmani, preloadSurahUthmani, surahEdition } from '@/lib/quran-reader-data';
import { useSettings } from '@/lib/settings';
import { SURAHS } from '@/lib/surahs';

/** Texte uthmani complet (embarqué) — null pendant le chargement. */
export function useUthmani() {
  const [all, setAll] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadUthmani().then((v) => alive && setAll(v));
    return () => {
      alive = false;
    };
  }, []);
  return all;
}

/** Sourate ouverte : le texte déjà en mémoire s’affiche tout de suite, sinon seul ce module est chargé. La suivante est préparée. */
export function useSurahUthmani(n: number) {
  const cached = peekSurahUthmani(n);
  const [slot, setSlot] = useState<{ n: number; lines: string[] } | null>(cached ? { n, lines: cached } : null);
  const lines = peekSurahUthmani(n) ?? (slot && slot.n === n ? slot.lines : null);
  useEffect(() => {
    let alive = true;
    if (!peekSurahUthmani(n)) {
      void loadSurahUthmani(n).then((v) => {
        if (alive) setSlot({ n, lines: v });
      });
    }
    preloadSurahUthmani(n + 1);
    return () => {
      alive = false;
    };
  }, [n]);
  return lines;
}

/** Vrai quand chaque sourate de l’intervalle est en mémoire. Charge cet intervalle et prépare la suivante. */
export function useSurahSpan(from: number, to: number) {
  const a = Math.max(1, Math.min(from, to));
  const b = Math.min(114, Math.max(from, to));
  const [, bump] = useState(0);
  useEffect(() => {
    let alive = true;
    const jobs: Promise<string[]>[] = [];
    for (let s = a; s <= b; s++) jobs.push(loadSurahUthmani(s));
    preloadSurahUthmani(b + 1);
    void Promise.all(jobs).then(() => {
      if (alive) bump((x) => x + 1);
    });
    return () => {
      alive = false;
    };
  }, [a, b, bump]);
  for (let s = a; s <= b; s++) if (!peekSurahUthmani(s)) return false;
  return true;
}

/** Traduction de l’utilisateur (selon la langue de l’app). */
export function useTranslationId() {
  const { s } = useSettings();
  return translationFor(quranEditionLang(s.lang));
}

/** Une édition (traduction / translittération) d’une sourate, chargée si `on`. */
export function useEdition(n: number, ed: string, on: boolean) {
  const [v, setV] = useState<{ n: number; ed: string; lines: string[] | null; failed: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const retryLoad = useCallback(() => setRetry((x) => x + 1), []);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    surahEdition(n, ed).then((lines) => alive && setV({ n, ed, lines, failed: !lines }));
    return () => {
      alive = false;
    };
  }, [n, ed, on, retry]);
  const cur = v && v.n === n && v.ed === ed ? v : null;
  return { lines: cur?.lines ?? null, failed: !!cur?.failed, retry: retryLoad };
}

/** Versets arabes d’une sourate à partir du texte complet. */
export const surahSlice = (all: string[] | null, n: number) => (all ? all.slice(OFFSETS[n - 1], OFFSETS[n - 1] + SURAHS[n - 1][4]) : null);
