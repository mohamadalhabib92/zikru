import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { backendConfigured } from '@/lib/backend';
import { LANGS } from '@/lib/i18n';
import { getGpsPlace } from '@/lib/location';
import { CITIES, METHODS, type MethodKey } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { clearAll } from '@/lib/storage';
import { Badge, Button, Card, Chip, Divider, Eyebrow, H2, ListItem, Muted, Row, Screen, Segmented, Spacer } from '@/ui/kit';

export default function SettingsScreen() {
  const { s, set, t: tr } = useSettings();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [gpsErr, setGpsErr] = useState(false);
  return (
    <Screen>
      <Eyebrow>{tr.settings_title}</Eyebrow>
      <H2>{tr.language}</H2>
      <Row wrap>
        {LANGS.map((l) => (
          <Chip key={l.code} label={l.pending ? `${l.label} · ⏳` : l.label} active={s.lang === l.code} onPress={() => set({ lang: l.code })} />
        ))}
      </Row>
      <Muted>⏳ = {tr.translation_pending} (repli : français).</Muted>
      <Spacer h={20} />

      <H2>{tr.location}</H2>
      <Muted>
        {s.place.label}
        {s.place.source === 'example' ? ' (exemple)' : ''} · {s.place.lat.toFixed(3)}, {s.place.lng.toFixed(3)}
      </Muted>
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
      <Segmented label={tr.madhab} options={[{ label: tr.shafi, value: 'shafi' as const }, { label: tr.hanafi, value: 'hanafi' as const }]} value={s.madhab} onChange={(v) => set({ madhab: v })} />
      <Spacer />
      <Segmented label={tr.hijri_offset} options={[-2, -1, 0, 1, 2].map((n) => ({ label: n > 0 ? `+${n}` : String(n), value: n }))} value={s.hijriOffset} onChange={(v) => set({ hijriOffset: v })} />
      <Spacer h={20} />

      <Card>
        <ListItem title={tr.sources_title} icon="library-outline" onPress={() => router.push('/sources')} />
        <Divider />
        <ListItem title={tr.ring} icon="radio-outline" right={<Badge label={tr.simulation} tone="warning" />} onPress={() => router.push('/ring')} />
        <Divider />
        <ListItem title="Synchronisation (Supabase)" icon="cloud-outline" right={<Badge label={backendConfigured ? 'Configuré' : tr.config_missing} tone={backendConfigured ? 'success' : 'warning'} />} onPress={() => router.push('/config')} />
        <Divider />
        <ListItem title={tr.content_admin} icon="git-pull-request-outline" onPress={() => router.push('/content-admin')} />
        <Divider />
        <ListItem title={tr.audit} icon="clipboard-outline" onPress={() => router.push('/audit')} />
      </Card>
      <Spacer h={20} />
      <Button
        title={tr.reset_data}
        variant="danger"
        icon="trash-outline"
        onPress={() => {
          const go = async () => {
            await clearAll();
            if (Platform.OS === 'web' && typeof location !== 'undefined') location.reload();
            else set({ onboarded: false });
          };
          if (Platform.OS === 'web') {
            if (typeof confirm === 'undefined' || confirm('Effacer toutes les données locales de Zikru ?')) void go();
          } else Alert.alert(tr.reset_data, 'Compteurs, réglages et contenu local seront effacés.', [{ text: tr.cancel, style: 'cancel' }, { text: 'OK', style: 'destructive', onPress: () => void go() }]);
        }}
      />
      <Spacer />
      <Muted>Zikru 1.0.0 · données stockées uniquement sur cet appareil.</Muted>
    </Screen>
  );
}
