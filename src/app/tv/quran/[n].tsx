import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { TvBack, TvButton, TvFocusable, TvMuted, TvPremiumGate, TvRow, TvScroll, TvTitle } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { BASMALA_UTHMANI, loadSurahUthmani } from '@/lib/quran-reader-data';
import { buildQueue } from '@/lib/recitation';
import { useGlobalRecitation } from '@/lib/recitation-context';
import { SURAHS } from '@/lib/surahs';
import { tvAyahType } from '@/lib/tv';
import { Text } from '@/ui/Text';
import { fonts, theme as t } from '@/ui/theme';
import { fontsAreReady } from '@/ui/fonts-ready';

export default function TvSurah() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const surah = Math.min(114, Math.max(1, Number(n) || 1));
  return (
    <TvPremiumGate feature="quran">
      <SurahBody key={surah} surah={surah} />
    </TvPremiumGate>
  );
}

function SurahBody({ surah }: { surah: number }) {
  useKeepAwake('zikru-tv-quran');
  const meta = SURAHS[surah - 1];
  const rec = useGlobalRecitation();
  const [ayahs, setAyahs] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    loadSurahUthmani(surah)
      .then((rows) => {
        if (live) setAyahs(rows);
      })
      .catch(() => {
        if (live) setErr(L('Le texte de cette sourate n’a pas pu être ouvert.'));
      });
    return () => {
      live = false;
    };
  }, [surah]);
  const playingHere = rec.step?.s === surah ? rec.step.a : null;
  const count = ayahs?.length ?? meta?.[4] ?? 1;
  const ayah = Math.min(count, Math.max(1, picked ?? playingHere ?? 1));
  const text = ayahs?.[ayah - 1] ?? '';
  const type = tvAyahType(text);
  const showBasmala = surah !== 1 && surah !== 9;
  const play = () => {
    if (!ayahs) return;
    const verses = ayahs.map((_, i) => [surah, i + 1] as [number, number]).slice(ayah - 1);
    setPicked(null);
    void rec.start(buildQueue(verses), 0, false);
  };
  return (
    <TvScroll>
      <TvTitle>{meta ? `${meta[0]}. ${meta[2]}` : L('Sourate')}</TvTitle>
      {showBasmala ? (
        <Text style={{ color: t.accent, fontSize: 48, lineHeight: 86, textAlign: 'right', marginTop: 12, fontFamily: fontsAreReady() ? fonts.quran : undefined }}>{BASMALA_UTHMANI}</Text>
      ) : null}
      <View style={{ marginTop: 18 }}>
        <TvFocusable block minHeight={160} label={`${ayah}`}>
          {(on) => (
            <>
              <Text style={{ color: on ? '#141311' : t.muted, fontSize: 28, fontWeight: '800' }}>
                {ayah}
                {playingHere === ayah ? ` · ${L('Lecture')}` : ''}
              </Text>
              <Text style={{ color: on ? '#141311' : t.text, fontSize: type.fontSize, lineHeight: type.lineHeight, textAlign: 'right', fontFamily: fontsAreReady() ? fonts.quran : undefined }}>{text || '…'}</Text>
            </>
          )}
        </TvFocusable>
      </View>
      {err ? <TvMuted>{err}</TvMuted> : null}
      <TvRow>
        <TvButton label={L('Verset précédent')} onPress={() => setPicked(Math.max(1, ayah - 1))} />
        <TvButton preferred label={rec.playing && playingHere ? L('Pause') : L('Lecture')} onPress={() => (rec.playing && playingHere ? rec.pause() : rec.pos >= 0 && playingHere ? rec.resume() : play())} />
        <TvButton label={L('Verset suivant')} onPress={() => setPicked(Math.min(count, ayah + 1))} />
        <TvButton label={L('Arrêter')} onPress={() => rec.stop()} />
        <TvBack />
      </TvRow>
    </TvScroll>
  );
}
