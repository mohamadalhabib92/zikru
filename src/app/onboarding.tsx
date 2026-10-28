import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Madhab } from '@/lib/fiqh';
import { LANGS } from '@/lib/i18n';
import { getGpsPlace } from '@/lib/location';
import { CITIES } from '@/lib/prayer';
import { remindersSupported, requestReminderPermission } from '@/lib/reminders';
import { useSettings } from '@/lib/settings';
import { usePersistentState } from '@/lib/storage';
import { Container, FadeIn, IconBadge, tapHaptic } from '@/ui/ds';
import { Button, Ionicons, Toggle, type IconName } from '@/ui/kit';
import { PatternBg } from '@/components/zikru/Pattern';
import { brand as b } from '@/ui/theme';

type StepId = 'lang' | 'madhab' | 'place' | 'notif' | 'ble' | 'done';

/** Onboarding : langue → école → lieu → rappels → compteur BT (facultatif) → prêt. Tout est passable et modifiable dans Réglages. */
export default function Onboarding() {
  const { s, set, t: tr } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [madhab, setMadhab] = usePersistentState<Madhab>('fiqh-madhab', 'maliki');
  const steps: StepId[] = ['lang', 'madhab', 'place', ...(remindersSupported() ? (['notif'] as StepId[]) : []), 'ble', 'done'];
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gpsErr, setGpsErr] = useState(false);
  const step = steps[i];
  const next = () => {
    tapHaptic('select');
    setI((x) => Math.min(x + 1, steps.length - 1));
  };
  const finish = (to: '/' | '/ring' = '/') => {
    tapHaptic('success');
    set({ onboarded: true });
    router.replace('/');
    if (to !== '/') setTimeout(() => router.push(to), 50);
  };

  const Option = ({ active, title, sub, icon, onPress }: { active: boolean; title: string; sub?: string; icon?: IconName; onPress: () => void }) => (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tapHaptic('select');
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: active ? b.green : b.line, backgroundColor: active ? b.greenTint : b.paper, opacity: pressed ? 0.9 : 1 })}
    >
      {icon ? <IconBadge icon={icon} color={b.green} size={36} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: b.ink, fontWeight: '700', fontSize: 16 }}>{title}</Text>
        {sub ? <Text style={{ color: b.inkMuted, fontSize: 13 }}>{sub}</Text> : null}
      </View>
      <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={active ? b.green : b.line} />
    </Pressable>
  );

  const Title = ({ icon, title, sub }: { icon: IconName; title: string; sub?: string }) => (
    <View style={{ alignItems: 'center', marginBottom: 18, gap: 8 }}>
      <IconBadge icon={icon} color={b.goldDeep} size={56} />
      <Text accessibilityRole="header" style={{ color: b.ink, fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 }}>
        {title}
      </Text>
      {sub ? <Text style={{ color: b.inkMuted, fontSize: 15, textAlign: 'center', lineHeight: 21 }}>{sub}</Text> : null}
    </View>
  );

  let body: ReactNode = null;
  if (step === 'lang')
    body = (
      <>
        <Title icon="language" title={tr.onb_lang} />
        <View style={{ gap: 8 }}>
          {LANGS.map((l) => (
            <Option key={l.code} active={s.lang === l.code} title={l.label} onPress={() => set({ lang: l.code })} />
          ))}
        </View>
      </>
    );
  else if (step === 'madhab')
    body = (
      <>
        <Title icon="scale" title={tr.onb_madhab} sub={tr.onb_madhab_sub} />
        <View style={{ gap: 8 }}>
          <Option active={madhab === 'maliki'} title={tr.maliki} sub="Imam Mālik ibn Anas" onPress={() => setMadhab('maliki')} />
          <Option active={madhab === 'shafii'} title={tr.shafii} sub="Imam ash-Shāfi‘ī" onPress={() => setMadhab('shafii')} />
        </View>
      </>
    );
  else if (step === 'place')
    body = (
      <>
        <Title icon="location" title={tr.onb_location} sub={tr.onb_location_sub} />
        <Button
          title={tr.use_gps}
          icon="locate-outline"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setGpsErr(false);
            const p = await getGpsPlace();
            setBusy(false);
            if (p) {
              set({ place: p });
              next();
            } else setGpsErr(true);
          }}
        />
        {gpsErr ? <Text style={{ color: b.rust, marginTop: 8, textAlign: 'center' }}>Localisation indisponible — choisissez une ville.</Text> : null}
        <Text style={{ color: b.inkMuted, marginTop: 16, marginBottom: 8, fontWeight: '600' }}>{tr.choose_city}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CITIES.map((c) => {
            const on = s.place.label === c.label && s.place.source !== 'example';
            return (
              <Pressable
                key={c.label}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => set({ place: { ...c, source: 'manual' } })}
                style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: on ? b.green : b.line, backgroundColor: on ? b.green : b.paper }}
              >
                <Text style={{ color: on ? '#fff' : b.ink, fontWeight: '600' }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  else if (step === 'notif')
    body = (
      <>
        <Title icon="notifications" title={tr.onb_notif} sub={tr.reminders_hint} />
        <Button
          title={s.reminders ? '✓ ' + tr.reminders : tr.reminders}
          icon="notifications-outline"
          onPress={async () => {
            const ok = await requestReminderPermission();
            set({ reminders: ok });
            if (ok) next();
          }}
        />
        <View style={{ marginTop: 14 }}>
          <Toggle label={tr.notif_friday} value={s.notif.friday} onChange={(v) => set({ notif: { ...s.notif, friday: v } })} />
          <Toggle label={tr.notif_adhkar} value={s.notif.adhkar} onChange={(v) => set({ notif: { ...s.notif, adhkar: v } })} />
        </View>
      </>
    );
  else if (step === 'ble')
    body = (
      <>
        <Title icon="bluetooth" title={tr.onb_ble} sub={tr.onb_ble_sub} />
        <Button title={tr.onb_ble_btn} icon="bluetooth-outline" variant="secondary" onPress={() => finish('/ring')} />
      </>
    );
  else
    body = (
      <>
        <Title icon="checkmark-done" title={tr.onb_done} sub={tr.onb_done_sub} />
        <Text style={{ color: b.inkMuted, textAlign: 'center' }}>
          {s.place.label}
          {s.place.source === 'example' ? ' (exemple)' : ''} · {madhab === 'maliki' ? tr.maliki : tr.shafii} · {tr.offline_ready}
        </Text>
      </>
    );

  const last = step === 'done';
  return (
    <View style={{ flex: 1, backgroundColor: b.cream }}>
      <PatternBg style={{ paddingTop: insets.top + 18, paddingBottom: 26, alignItems: 'center' }}>
        <Text style={{ color: b.gold, fontSize: 46, fontFamily: 'Amiri_700Bold', lineHeight: 80 }}>ذِكْر</Text>
        <Text style={{ color: b.heroText, fontSize: 20, fontWeight: '800' }}>{tr.onboarding_welcome}</Text>
        <Text style={{ color: b.heroMuted, fontSize: 14, marginTop: 2, textAlign: 'center', paddingHorizontal: 24 }}>{tr.onboarding_sub}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }} accessibilityLabel={`Étape ${i + 1} sur ${steps.length}`}>
          {steps.map((x, k) => (
            <View key={x} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k <= i ? b.gold : 'rgba(255,255,255,0.25)' }} />
          ))}
        </View>
      </PatternBg>
      <ScrollView contentContainerStyle={{ paddingTop: 24, paddingBottom: 24 }}>
        <Container max={520} style={{ paddingHorizontal: 20 }}>
          <FadeIn key={step}>{body}</FadeIn>
        </Container>
      </ScrollView>
      <Container max={520} style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16, gap: 8 }}>
        <Button title={last ? tr.start : tr.continue} icon={last ? 'checkmark' : 'arrow-forward'} onPress={() => (last ? finish() : next())} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" disabled={i === 0} onPress={() => setI((x) => Math.max(0, x - 1))} style={{ minHeight: 44, justifyContent: 'center', opacity: i === 0 ? 0 : 1 }}>
            <Text style={{ color: b.inkMuted, fontWeight: '700' }}>{tr.back}</Text>
          </Pressable>
          {!last ? (
            <Pressable accessibilityRole="button" onPress={() => finish()} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: b.inkMuted, fontWeight: '700' }}>{tr.skip}</Text>
            </Pressable>
          ) : null}
        </View>
      </Container>
    </View>
  );
}
