import { useEffect, useState } from 'react';
import { translationFor } from '@/lib/quran';
import { OFFSETS } from '@/lib/quran-nav';
import { loadUthmani, surahEdition } from '@/lib/quran-reader-data';
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

/** Traduction de l’utilisateur (selon la langue de l’app). */
export function useTranslationId() {
  const { s } = useSettings();
  return translationFor(s.lang);
}

/** Une édition (traduction / translittération) d’une sourate, chargée si `on`. */
export function useEdition(n: number, ed: string, on: boolean) {
  const [v, setV] = useState<{ n: number; ed: string; lines: string[] | null; failed: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    surahEdition(n, ed).then((lines) => alive && setV({ n, ed, lines, failed: !lines }));
    return () => {
      alive = false;
    };
  }, [n, ed, on, retry]);
  const cur = v && v.n === n && v.ed === ed ? v : null;
  return { lines: cur?.lines ?? null, failed: !!cur?.failed, retry: () => setRetry((x) => x + 1) };
}

/** Versets arabes d’une sourate à partir du texte complet. */
export const surahSlice = (all: string[] | null, n: number) => (all ? all.slice(OFFSETS[n - 1], OFFSETS[n - 1] + SURAHS[n - 1][4]) : null);
