import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { LANGS } from '@/lib/i18n';
import { getGpsPlace } from '@/lib/location';
import { CITIES } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { Button, Chip, H1, Muted, Row, Screen, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

/** Onboarding court (3 étapes) : langue → lieu → c'est prêt. */
export default function Onboarding() {
  const { s, set, t: tr } = useSettings();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const finish = () => {
    set({ onboarded: true });
    router.replace('/');
  };
  return (
    <Screen>
      <View style={{ minHeight: 40 }} />
      <Row gap={6}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? t.primary : t.surfaceAlt }} />
        ))}
      </Row>
      <Spacer h={32} />
      <Text style={{ color: t.primary, fontSize: 44, textAlign: 'center' }}>ذِكْر</Text>
      <H1 style={{ textAlign: 'center' }}>{tr.onboarding_welcome}</H1>
      <Muted style={{ textAlign: 'center' }}>{tr.onboarding_sub}</Muted>
      <Spacer h={28} />
      {step === 0 ? (
        <>
          <Text style={{ color: t.text, fontWeight: '700', marginBottom: 8 }}>{tr.language}</Text>
          <Row wrap>
            {LANGS.map((l) => (
              <Chip key={l.code} label={l.label} active={s.lang === l.code} onPress={() => set({ lang: l.code })} />
            ))}
          </Row>
          <Spacer h={24} />
          <Button title={tr.continue} onPress={() => setStep(1)} />
        </>
      ) : step === 1 ? (
        <>
          <Text style={{ color: t.text, fontWeight: '700', marginBottom: 8 }}>{tr.location}</Text>
          <Button
            title={tr.use_gps}
            icon="locate-outline"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const p = await getGpsPlace();
              setBusy(false);
              if (p) {
                set({ place: p });
                setStep(2);
              }
            }}
          />
          <Spacer />
          <Muted>{tr.choose_city}</Muted>
          <Spacer h={8} />
          <Row wrap>
            {CITIES.map((c) => (
              <Chip key={c.label} label={c.label} active={s.place.label === c.label && s.place.source !== 'example'} onPress={() => set({ place: c })} />
            ))}
          </Row>
          <Spacer h={24} />
          <Button title={tr.continue} onPress={() => setStep(2)} />
        </>
      ) : (
        <>
          <Muted style={{ textAlign: 'center' }}>
            {s.place.label}
            {s.place.source === 'example' ? ' (exemple)' : ''} · Muslim World League · {tr.offline_ready}
          </Muted>
          <Spacer h={24} />
          <Button title={tr.start} icon="checkmark" onPress={finish} />
        </>
      )}
    </Screen>
  );
}
