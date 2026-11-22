import { useLocalSearchParams } from 'expo-router';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTvKeepAwake } from '@/components/tv/keep-awake';
import { TvBack, TvButton, TvFocusable, TvMuted, TvPremiumGate, TvRow, TvScroll, TvTitle } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { BASMALA_UTHMANI, loadSurahUthmani } from '@/lib/quran-reader-data';
import { buildQueue } from '@/lib/recitation';
import { useGlobalRecitation } from '@/lib/recitation-context';
import { SURAHS } from '@/lib/surahs';
import { tvAyahType } from '@/lib/tv';
import { TV_FOCUS_INK, TV_ON_CARD, TV_ON_CARD_MUTED } from '@/lib/tv-surface';
import { Text } from '@/ui/Text';
import { fonts, theme as t } from '@/ui/theme';
import { fontsAreReady } from '@/ui/fonts-ready';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <SurahCrash message={error?.message || L('La sourate n’a pas pu s’ouvrir.')} onRetry={() => void retry()} />;
}

export default function TvSurah() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const surah = Math.min(114, Math.max(1, Number(n) || 1));
  return (
    <SurahBoundary>
      <TvPremiumGate feature="quran">
        <SurahBody key={surah} surah={surah} />
      </TvPremiumGate>
    </SurahBoundary>
  );
}

class SurahBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) return <SurahCrash message={this.state.error.message} onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

function SurahCrash({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <TvScroll>
      <TvTitle>{L('La sourate n’a pas pu s’ouvrir')}</TvTitle>
      <TvMuted>{message}</TvMuted>
      <TvRow>
        <TvButton preferred label={L('Réessayer')} onPress={onRetry} />
        <TvBack />
      </TvRow>
    </TvScroll>
  );
}

function SurahBody({ surah }: { surah: number }) {
  useTvKeepAwake('zikru-tv-quran');
  const meta = SURAHS[surah - 1];
  const rec = useGlobalRecitation();
  const [ayahs, setAyahs] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    loadSurahUthmani(surah)
      .then((rows) => {
        if (!live) return;
        if (!rows?.length) setErr(L('Le texte de cette sourate n’a pas pu être ouvert.'));
        else setAyahs(rows);
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
  const waiting = ayahs == null && !err;
  const type = tvAyahType(text);
  const showBasmala = surah !== 1 && surah !== 9;
  const play = () => {
    if (!ayahs) return;
    const verses = ayahs.map((_, i) => [surah, i + 1] as [number, number]).slice(ayah - 1);
    setPicked(null);
    setErr(null);
    void rec.start(buildQueue(verses), 0, false).catch(() => setErr(L('La récitation n’a pas pu démarrer.')));
  };
  return (
    <TvScroll>
      <TvTitle>{meta ? `${meta[0]}. ${meta[2]}` : L('Sourate')}</TvTitle>
      {waiting ? <Text style={{ color: TV_ON_CARD, fontSize: 34, lineHeight: 46, marginTop: 16 }}>{L('Chargement…')}</Text> : null}
      {showBasmala && !waiting ? (
        <Text style={{ color: t.accent, fontSize: 48, lineHeight: 86, textAlign: 'right', marginTop: 12, fontFamily: fontsAreReady() ? fonts.quran : undefined }}>{BASMALA_UTHMANI}</Text>
      ) : null}
      <View style={{ marginTop: 18 }}>
        <TvFocusable block minHeight={160} label={`${ayah}`}>
          {(on) => (
            <>
              <Text style={{ color: on ? TV_FOCUS_INK : TV_ON_CARD_MUTED, fontSize: 28, fontWeight: '800' }}>
                {ayah}
                {playingHere === ayah ? ` · ${L('Lecture')}` : ''}
              </Text>
              <Text style={{ color: on ? TV_FOCUS_INK : TV_ON_CARD, fontSize: type.fontSize, lineHeight: type.lineHeight, textAlign: 'right', fontFamily: fontsAreReady() ? fonts.quran : undefined }}>{text || (waiting ? '' : '…')}</Text>
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
