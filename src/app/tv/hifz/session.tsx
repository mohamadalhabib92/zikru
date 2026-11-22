import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { HideText } from '@/components/quran/HideText';
import { TvBack, TvButton, TvMuted, TvPremiumGate, TvRow, useTvFrame } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { fromIndex, gIndex } from '@/lib/quran-nav';
import { loadSurahUthmani } from '@/lib/quran-reader-data';
import { gradeVerses, hifzCards, hifzPrefs, startHifz, type HideMode } from '@/lib/quran-store';
import { buildQueue } from '@/lib/recitation';
import { useGlobalRecitation } from '@/lib/recitation-context';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import { nextTvHide, TV_HIFZ_ARABIC, TV_HIFZ_LINE, tvReviewKeys, type TvHide } from '@/lib/tv-hifz';
import { TV_ON_CARD } from '@/lib/tv-surface';
import { Text } from '@/ui/Text';
import { dayKey } from '@/lib/dates';

/** Un verset à la fois. Révélation, voisin, répétition du récitateur, note SM-2. Pas d’enregistrement du micro. */
export default function TvHifzSession() {
  return (
    <TvPremiumGate feature="hifz">
      <Body />
    </TvPremiumGate>
  );
}

function Body() {
  const params = useLocalSearchParams<{ mode?: string; s?: string; from?: string; to?: string }>();
  const review = params.mode === 'review';
  const frame = useTvFrame();
  const [hp, setHp] = useShared(hifzPrefs);
  const rec = useGlobalRecitation();
  const [keys] = useState<number[]>(() => {
    if (review) return tvReviewKeys(hifzCards.get(), dayKey());
    const s = Math.min(114, Math.max(1, Number(params.s) || 1));
    const from = Math.max(1, Number(params.from) || 1);
    const to = Math.max(from, Number(params.to) || from);
    const meta = SURAHS[s - 1];
    const hi = Math.min(meta[4], to);
    const out: number[] = [];
    for (let a = from; a <= hi; a++) out.push(gIndex(s, a));
    return out;
  });
  const [i, setI] = useState(0);
  const [revealFor, setRevealFor] = useState<number | null>(null);
  const [load, setLoad] = useState<{ surah: number; ayah: number; text: string | null; err: string | null } | null>(null);
  const verseWidth = Math.max(640, frame.width - 180);
  const done = i >= keys.length;
  const k = keys[i] ?? 0;
  const [surah, ayah] = keys.length && !done ? fromIndex(k) : [1, 1];
  const meta = SURAHS[surah - 1];
  const hide = (hp.hide === 'blur' ? 'all' : hp.hide) as HideMode;
  const reveal = revealFor === k;
  const current = load && load.surah === surah && load.ayah === ayah ? load : null;

  useEffect(() => {
    if (done) return;
    let live = true;
    loadSurahUthmani(surah)
      .then((rows) => {
        if (!live) return;
        const line = rows?.[ayah - 1] ?? null;
        setLoad({ surah, ayah, text: line, err: line ? null : L('Le texte de cette sourate n’a pas pu être ouvert.') });
      })
      .catch(() => {
        if (live) setLoad({ surah, ayah, text: null, err: L('Le texte de cette sourate n’a pas pu être ouvert.') });
      });
    return () => {
      live = false;
    };
  }, [surah, ayah, done]);

  const grade = (g: 'hard' | 'medium' | 'easy') => {
    startHifz(k, k + 1);
    gradeVerses([k], g);
    setI((n) => n + 1);
  };
  const repeat = () => {
    if (!current?.text) return;
    void rec.start(buildQueue([[surah, ayah]], hp.each || 1, 1), 0, false);
  };

  return (
    <View style={{ flex: 1, width: frame.width, height: frame.height, backgroundColor: '#10211C', paddingHorizontal: 90, paddingTop: 28 }}>
      <Text style={{ color: TV_ON_CARD, fontSize: 40, fontWeight: '800', height: 52 }}>
        {done ? L('Mémorisation') : `${meta[2]} · ${ayah}`}
      </Text>
      {done ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <TvMuted>{keys.length ? L('Révision terminée') : L('Commencez une nouvelle leçon pour alimenter la révision.')}</TvMuted>
          <TvRow>
            <TvBack preferred />
          </TvRow>
        </View>
      ) : (
        <>
          <View style={{ flex: 1, width: verseWidth, justifyContent: 'center' }}>
            {!current ? <Text style={{ color: TV_ON_CARD, fontSize: 34 }}>{L('Chargement…')}</Text> : null}
            {current?.err ? <TvMuted>{current.err}</TvMuted> : null}
            {current?.text ? (
              <HideText text={current.text} mode={hide} revealAll={reveal || hide === 'none'} size={TV_HIFZ_ARABIC} lineH={TV_HIFZ_LINE / TV_HIFZ_ARABIC} color={TV_ON_CARD} style={{ textAlign: 'center', width: verseWidth }} />
            ) : null}
          </View>
          <TvRow>
            <TvButton preferred label={reveal ? L('Masquer') : L('Révéler')} onPress={() => setRevealFor(reveal ? null : k)} />
            <TvButton label={L(hide === 'none' ? 'Texte' : hide === 'first' ? '1er mot' : hide === 'alt' ? '1 sur 2' : 'Masqué')} onPress={() => setHp((v) => ({ ...v, hide: nextTvHide(v.hide as TvHide) }))} />
            <TvButton label={rec.playing ? L('Pause') : L('Répéter')} onPress={() => (rec.playing ? rec.pause() : repeat())} />
            <TvButton label={L('Précédent')} onPress={() => setI((n) => Math.max(0, n - 1))} />
            <TvButton label={L('Suivant')} onPress={() => setI((n) => Math.min(keys.length, n + 1))} />
            <TvBack />
          </TvRow>
          <TvRow>
            <TvButton label={L('Difficile')} onPress={() => grade('hard')} />
            <TvButton label={L('Moyen')} onPress={() => grade('medium')} />
            <TvButton label={L('Facile')} onPress={() => grade('easy')} />
          </TvRow>
        </>
      )}
    </View>
  );
}
