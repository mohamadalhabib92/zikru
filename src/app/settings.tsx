import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { backendConfigured } from '@/lib/backend';
import { LANGS } from '@/lib/i18n';
import { getGpsPlace } from '@/lib/location';
import { CITIES, METHODS, type MethodKey } from '@/lib/prayer';
import Constants from 'expo-constants';
import { SCHOOLS, SCHOOL_LABEL, type School } from '@/lib/fiqh-rulings';
import { asrForSchool, useMadhab } from '@/lib/madhab';
import { NotifSettings } from '@/components/NotifSettings';
import { useSettings } from '@/lib/settings';
import { setPendingRoute, takePendingRoute } from '@/ui/appearance';
import { clearAll, saveJSON } from '@/lib/storage';
import { consentStore, useConsent } from '@/lib/consent';
import { DEFAULT_CONSENT } from '@/lib/privacy';
import { privacyText } from '@/lib/privacy-text';
import { Badge, Button, Card, Chip, Divider, Eyebrow, H2, ListItem, Muted, Row, Screen, Segmented, Spacer } from '@/ui/kit';

export default function SettingsScreen() {
  const { s, set, t: tr } = useSettings();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [gpsErr, setGpsErr] = useState(false);
  const [fiqh, setFiqhRaw] = useMadhab();
  const setFiqh = (m: School) => {
    setFiqhRaw(m);
    if (!s.asrManual) set({ madhab: asrForSchool(m) });
  };
  const [consent, choose] = useConsent();
  const pt = privacyText(s.lang);
  return (
    <Screen>
      <Eyebrow>{tr.settings_title}</Eyebrow>
      <Segmented
        label={tr.appearance}
        options={[
          { label: tr.app_system, value: 'system' as const },
          { label: tr.app_light, value: 'light' as const },
          { label: tr.app_dark, value: 'dark' as const },
        ]}
        value={s.appearance}
        onChange={(v) => {
          if (v === s.appearance) return;
          setPendingRoute('/settings');
          set({ appearance: v });
          setTimeout(() => takePendingRoute(), 2000); // si le thème effectif ne change pas, on oublie la route
        }}
      />
      <H2>{tr.language}</H2>
      <Row wrap>
        {LANGS.map((l) => (
          <Chip key={l.code} label={l.pending ? `${l.label} · ⏳` : l.label} active={s.lang === l.code} onPress={() => set({ lang: l.code })} />
        ))}
      </Row>
      <Muted>⏳ = {tr.translation_pending} (repli : français).</Muted>
      <Spacer h={20} />

      <NotifSettings />
      <H2>{tr.location}</H2>
      <Muted>
        {s.place.label}
        {s.place.source === 'example' ? ' (exemple)' : ''} · {s.place.lat.toFixed(3)}, {s.place.lng.toFixed(3)}
      </Muted>
      <Muted>{pt.location_note}</Muted>
      <Spacer h={8} />
      <Button
        title={tr.use_gps}
        icon="locate-outline"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          const p = await getGpsPlace();
          setBusy(false);
          setGpsErr(!p);
          if (p) set({ place: p });
        }}
      />
      {gpsErr ? <Muted>Position refusée ou indisponible — choisissez une ville ci-dessous.</Muted> : null}
      <Spacer h={8} />
      <Row wrap>
        {CITIES.map((c) => (
          <Chip key={c.label} label={c.label} active={s.place.label === c.label && s.place.source !== 'example'} onPress={() => set({ place: { ...c, updatedAt: new Date().toISOString() } })} />
        ))}
      </Row>
      <Spacer h={20} />

      <H2>{tr.method}</H2>
      <Card>
        {(Object.keys(METHODS) as MethodKey[]).map((k, i) => (
          <ListItem key={k} title={METHODS[k]} icon={s.method === k ? 'radio-button-on' : 'radio-button-off'} onPress={() => set({ method: k })} />
        ))}
      </Card>
      <Spacer />
      <Segmented
        label={tr.onb_madhab}
        options={SCHOOLS.map((m) => ({ label: s.lang === 'ar' ? SCHOOL_LABEL[m].ar : s.lang === 'fr' ? SCHOOL_LABEL[m].fr : SCHOOL_LABEL[m].en, value: m }))}
        value={fiqh}
        onChange={setFiqh}
      />
      <Muted>{s.lang === 'fr' ? 'École utilisée pour le Fiqh et le Sujud as-sahw.' : 'School used for Fiqh and Sujud as-sahw.'}</Muted>
      <Spacer h={10} />
      <Segmented
        label={tr.madhab}
        options={[{ label: tr.shafi, value: 'shafi' as const }, { label: tr.hanafi, value: 'hanafi' as const }]}
        value={s.madhab}
        onChange={(v) => set({ madhab: v, asrManual: v !== asrForSchool(fiqh) })}
      />
      <Muted>
        {s.lang === 'fr'
          ? `Réglage distinct de l’école : ombre ×1 (majorité) ou ×2 (hanafite). ${s.asrManual ? 'Choisi manuellement.' : 'Suit l’école choisie ci-dessus.'}`
          : `Separate from the school: shadow ×1 (majority) or ×2 (Hanafi). ${s.asrManual ? 'Set manually.' : 'Follows the school above.'}`}
      </Muted>
      <Spacer />
      <Segmented label={tr.hijri_offset} options={[-2, -1, 0, 1, 2].map((n) => ({ label: n > 0 ? `+${n}` : String(n), value: n }))} value={s.hijriOffset} onChange={(v) => set({ hijriOffset: v })} />
      <Spacer h={20} />

      <H2>{pt.section}</H2>
      <Segmented
        label={pt.ai_toggle}
        options={[
          { label: pt.on, value: 'on' as const },
          { label: pt.off, value: 'off' as const },
        ]}
        value={consent.ai === true ? 'on' : 'off'}
        onChange={(v) => choose('ai', v === 'on')}
      />
      {consent.ai !== true ? <Muted>{pt.ai_off_note}</Muted> : null}
      <Segmented
        label={pt.weather_toggle}
        options={[
          { label: pt.on, value: 'on' as const },
          { label: pt.off, value: 'off' as const },
        ]}
        value={consent.weather === true ? 'on' : 'off'}
        onChange={(v) => choose('weather', v === 'on')}
      />
      <Card>
        <ListItem title={pt.policy_link} icon="shield-checkmark-outline" onPress={() => router.push('/privacy')} />
        <Divider />
        <ListItem title={pt.delete_account} subtitle={pt.delete_account_hint} icon="person-remove-outline" onPress={() => router.push('/community')} />
        <Divider />
        <ListItem
          title={pt.clear_bilal}
          icon="chatbubble-ellipses-outline"
          onPress={() => {
            void saveJSON('bilal-chat', []);
            void saveJSON('bilal-reflection', null);
            if (Platform.OS !== 'web') Alert.alert(pt.clear_bilal, '✓');
          }}
        />
      </Card>
      <Spacer h={20} />

      <Card>
        <ListItem title={tr.sources_title} icon="library-outline" onPress={() => router.push('/sources')} />
        <Divider />
        <ListItem title={tr.ring} subtitle="Tasbih électronique, anneau de dhikr, télécommande" icon="bluetooth-outline" onPress={() => router.push('/ring')} />
        <Divider />
        <ListItem title="Synchronisation (Supabase)" icon="cloud-outline" right={<Badge label={backendConfigured ? 'Configuré' : tr.config_missing} tone={backendConfigured ? 'success' : 'warning'} />} onPress={() => router.push('/config')} />
        <Divider />
        <ListItem title={tr.content_admin} icon="git-pull-request-outline" onPress={() => router.push('/content-admin')} />
        <Divider />
        <ListItem title={tr.audit} icon="clipboard-outline" onPress={() => router.push('/audit')} />
        <Divider />
        <ListItem title="Validation savante" subtitle="Pour les relecteurs : contenus par statut, fiche exportable" icon="ribbon-outline" onPress={() => router.push('/validation')} />
      </Card>
      <Spacer h={20} />
      <Button
        title={tr.reset_data}
        variant="danger"
        icon="trash-outline"
        onPress={() => {
          const go = async () => {
            await clearAll();
            consentStore.set(DEFAULT_CONSENT);
            if (Platform.OS === 'web' && typeof location !== 'undefined') location.reload();
            else set({ onboarded: false });
          };
          if (Platform.OS === 'web') {
            if (typeof confirm === 'undefined' || confirm('Effacer toutes les données locales de Zikru ?')) void go();
          } else Alert.alert(tr.reset_data, 'Compteurs, réglages et contenu local seront effacés.', [{ text: tr.cancel, style: 'cancel' }, { text: 'OK', style: 'destructive', onPress: () => void go() }]);
        }}
      />
      <Spacer />
      <Muted>Zikru {Constants.expoConfig?.version ?? '1.0.19'} · {pt.local_footer}</Muted>
    </Screen>
  );
}
