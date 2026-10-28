import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AddToZikrSheet, type DraftItem } from '@/components/zikr/parts';
import { SURAHS } from '@/lib/surahs';
import { AyahActions, type AyahTarget } from './AyahActions';
import type { Pal } from './palette';
import { TafsirSheet } from './TafsirSheet';

/** Enchaîne actions du verset → tafsir / zikr / mémorisation / écoute, partagé par le lecteur et le mushaf. */
export function useAyahFlow(pal: Pal, onPlay: (t: AyahTarget) => void) {
  const router = useRouter();
  const [target, setTarget] = useState<AyahTarget | null>(null);
  const [taf, setTaf] = useState<AyahTarget | null>(null);
  const [draft, setDraft] = useState<DraftItem | null>(null);
  const sheets = (
    <>
      <AyahActions
        target={target}
        pal={pal}
        onClose={() => setTarget(null)}
        onAction={(a, t) => {
          if (a === 'play') onPlay(t);
          else if (a === 'tafsir') setTimeout(() => setTaf(t), 60);
          else if (a === 'zikr') setTimeout(() => setDraft({ kind: 'verse', ref: `Coran ${t.s}:${t.a}`, label: `${SURAHS[t.s - 1][2]} ${t.s}:${t.a}`, ar: t.ar, fr: t.tr ?? '', reps: 1 }), 60);
          else if (a === 'hifz') router.push({ pathname: '/quran/hifz-session', params: { s: String(t.s), from: String(t.a), to: String(Math.min(SURAHS[t.s - 1][4], t.a + 4)) } });
        }}
      />
      <TafsirSheet verse={taf} arabic={taf?.ar} pal={pal} onClose={() => setTaf(null)} />
      <AddToZikrSheet item={draft} onClose={() => setDraft(null)} />
    </>
  );
  return { open: setTarget, sheets };
}
