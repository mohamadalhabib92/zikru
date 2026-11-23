import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LandscapeBackdrop } from '@/components/landscape-backdrop';
import { useTvKeepAwake } from '@/components/tv/keep-awake';
import { TvBack, TvButton, TvPremiumGate, TvRow, useTvFrame } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { LANDSCAPE_IDS, type LandscapeId } from '@/lib/landscapes';
import { TV_PAD_BOTTOM, TV_PAD_X } from '@/lib/tv-surface';
import { AR_NAMES, computeDay, hhmm, withStates } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { Text } from '@/ui/Text';
import { fonts } from '@/ui/theme';
import { fontsAreReady } from '@/ui/fonts-ready';

const DHIKR = 'سُبْحَانَ ٱللَّهِ وَٱلْحَمْدُ لِلَّهِ وَلَا إِلَٰهَ إِلَّا ٱللَّهُ وَٱللَّهُ أَكْبَرُ';

export default function TvAmbient() {
  return (
    <TvPremiumGate feature="ambient">
      <AmbientBody />
    </TvPremiumGate>
  );
}

function AmbientBody() {
  useTvKeepAwake('zikru-tv-ambient');
  const frame = useTvFrame();
  const { s, t: tr } = useSettings();
  const [i, setI] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI((n) => (n + 1) % LANDSCAPE_IDS.length), 45000);
    return () => clearInterval(id);
  }, [paused]);
  const id: LandscapeId = LANDSCAPE_IDS[i] ?? 'stars';
  const today = computeDay(now, s.place, s.method, s.madhab, s.prayer);
  const tomorrow = computeDay(new Date(now.getTime() + 86400000), s.place, s.method, s.madhab, s.prayer);
  const { next } = withStates(today, now, tomorrow[0].time);
  const cardW = Math.max(320, frame.width - TV_PAD_X * 2);
  return (
    <View style={{ flex: 1, width: frame.width, height: frame.height, backgroundColor: '#000' }}>
      <LandscapeBackdrop id={id} />
      <View style={{ position: 'absolute', left: 0, top: 0, width: frame.width, height: frame.height, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: TV_PAD_X, paddingBottom: TV_PAD_BOTTOM }}>
        <View style={{ width: cardW, maxWidth: cardW, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 28, padding: 28 }}>
          <Text style={{ color: '#F7F4EE', fontSize: 48, lineHeight: 72, textAlign: 'center', width: cardW - 56, fontFamily: fontsAreReady() ? fonts.quran : undefined }}>{DHIKR}</Text>
          <Text style={{ color: '#D9B65C', fontSize: 32, marginTop: 18, textAlign: 'center', width: cardW - 56 }}>
            {tr[next.key]} · {hhmm(next.time)} · {AR_NAMES[next.key]}
          </Text>
          <TvRow>
            <TvButton label={paused ? L('Lecture') : L('Pause')} onPress={() => setPaused((v) => !v)} preferred />
            <TvButton label={L('Paysage suivant')} onPress={() => setI((n) => (n + 1) % LANDSCAPE_IDS.length)} />
            <TvBack />
          </TvRow>
        </View>
      </View>
    </View>
  );
}
