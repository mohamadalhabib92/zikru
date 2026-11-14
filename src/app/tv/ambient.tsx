import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LandscapeBackdrop } from '@/components/landscape-backdrop';
import { TvBack, TvButton, TvPremiumGate } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { LANDSCAPE_IDS, type LandscapeId } from '@/lib/landscapes';
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
  useKeepAwake('zikru-tv-ambient');
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
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <LandscapeBackdrop id={id} />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 72, paddingBottom: 48, backgroundColor: 'rgba(0,0,0,0.28)' }}>
        <Text style={{ color: '#F7F4EE', fontSize: 48, lineHeight: 86, textAlign: 'right', fontFamily: fontsAreReady() ? fonts.quran : undefined }}>{DHIKR}</Text>
        <Text style={{ color: '#D9B65C', fontSize: 28, marginTop: 16 }}>
          {tr[next.key]} · {hhmm(next.time)} · {AR_NAMES[next.key]}
        </Text>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 22 }}>
          <TvButton label={paused ? L('Lecture') : L('Pause')} onPress={() => setPaused((v) => !v)} preferred />
          <TvButton label={L('Paysage suivant')} onPress={() => setI((n) => (n + 1) % LANDSCAPE_IDS.length)} />
          <TvBack />
        </View>
      </View>
    </View>
  );
}
