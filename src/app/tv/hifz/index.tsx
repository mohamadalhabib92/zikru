import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TvBack, TvButton, TvMuted, TvPremiumGate, TvRow, useTvFrame } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { dayKey } from '@/lib/dates';
import { hifzCards } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import { TV_HIFZ_LESSON, tvLessonSpan, tvReviewKeys } from '@/lib/tv-hifz';
import { TV_ON_CARD } from '@/lib/tv-surface';
import { Text } from '@/ui/Text';

/** Même mémorisation que l’iPhone, gratuite comme là-bas. Les cartes restent dans `hifz-cards`. */
export default function TvHifz() {
  return (
    <TvPremiumGate feature="hifz">
      <Hub />
    </TvPremiumGate>
  );
}

function Hub() {
  const frame = useTvFrame();
  const [cards] = useShared(hifzCards);
  const [surah, setSurah] = useState(1);
  const today = dayKey();
  const due = tvReviewKeys(cards, today).length;
  const lesson = tvLessonSpan(surah, cards, TV_HIFZ_LESSON);
  const meta = SURAHS[surah - 1];
  const known = Object.keys(cards).length;
  return (
    <View style={{ flex: 1, width: frame.width, height: frame.height, backgroundColor: '#10211C', paddingHorizontal: 90, paddingTop: 36 }}>
      <Text style={{ color: TV_ON_CARD, fontSize: 48, fontWeight: '800', height: 64 }}>{L('Mémorisation')}</Text>
      <TvMuted>
        {known ? `${known} · ${due}` : L('Hifz guidé et révision')}
      </TvMuted>
      <TvRow>
        <TvButton
          preferred={due > 0}
          label={L('Révision du jour')}
          hint={due ? String(due) : L('Révision à jour ✓')}
          onPress={() => router.push({ pathname: '/tv/hifz/session', params: { mode: 'review' } })}
        />
        <TvButton
          preferred={due === 0}
          label={L('Commencer la mémorisation')}
          hint={`${meta[2]} ${lesson.from}–${lesson.to}`}
          onPress={() => router.push({ pathname: '/tv/hifz/session', params: { s: String(surah), from: String(lesson.from), to: String(lesson.to) } })}
        />
        <TvButton
          label={L('Répéter la récitation')}
          hint={`${meta[2]} ${lesson.from}–${lesson.to}`}
          onPress={() => router.push({ pathname: '/tv/hifz/repeat', params: { s: String(surah), scope: 'range', from: String(lesson.from), to: String(lesson.to) } })}
        />
      </TvRow>
      <TvRow>
        <TvButton label={L('Sourate précédente')} onPress={() => setSurah((n) => (n <= 1 ? 114 : n - 1))} />
        <TvButton label={L('Sourate suivante')} onPress={() => setSurah((n) => (n >= 114 ? 1 : n + 1))} />
        <TvBack />
      </TvRow>
    </View>
  );
}
