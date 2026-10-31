import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { ADJUST_LIMIT, clampAdj, DEFAULT_PRAYER_OPTS, HIGH_LAT_RULES, parseHHMM, type HighLatChoice, type PrayerKey, type PrayerOpts } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { Card, Chip, Divider, Field, Muted, Row, Spacer, Toggle } from '@/ui/kit';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

const KEYS: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const HL_LABEL: Record<HighLatChoice, string> = {
  auto: 'Automatique (recommandé)',
  middleofthenight: 'Milieu de la nuit',
  seventhofthenight: 'Septième de la nuit',
  twilightangle: 'Angle du crépuscule',
};

/** Réglages fins des horaires : latitudes élevées, ajustements ±minutes, horaires fixes de la mosquée. */
export function PrayerOptions() {
  const { s, set, t: tr } = useSettings();
  const p: PrayerOpts = s.prayer ?? DEFAULT_PRAYER_OPTS;
  const patch = (q: Partial<PrayerOpts>) => set({ prayer: { ...p, ...q } });
  const adj = p.adjust ?? {};
  const mosque = p.mosque ?? { enabled: false, times: {} };
  const bump = (k: PrayerKey, d: number) => patch({ adjust: { ...adj, [k]: clampAdj((adj[k] ?? 0) + d) } });
  return (
    <>
      <Spacer />
      <Muted style={{ marginBottom: 6 }}>{L('Latitudes élevées (Fajr et Isha quand la nuit est courte)')}</Muted>
      <Row wrap>
        {HIGH_LAT_RULES.map((r) => (
          <Chip key={r} label={L(HL_LABEL[r])} active={(p.highLat ?? 'auto') === r} onPress={() => patch({ highLat: r })} />
        ))}
      </Row>
      <Spacer h={14} />
      <Muted style={{ marginBottom: 6 }}>{L('Ajustements (minutes, ±{n} max)', { n: ADJUST_LIMIT })}</Muted>
      <Card>
        {KEYS.map((k, i) => (
          <View key={k}>
            {i ? <Divider /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
              <Text style={{ flex: 1, color: b.ink, fontWeight: '600' }}>{tr[k]}</Text>
              <Chip label="−" onPress={() => bump(k, -1)} />
              <Text accessibilityLabel={L('{p} : {n} minutes', { p: tr[k], n: adj[k] ?? 0 })} style={{ width: 44, textAlign: 'center', color: b.ink, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {(adj[k] ?? 0) > 0 ? `+${adj[k]}` : String(adj[k] ?? 0)}
              </Text>
              <Chip label="+" onPress={() => bump(k, 1)} />
            </View>
          </View>
        ))}
      </Card>
      <Spacer h={14} />
      <Card>
        <Toggle
          label={L('Horaires de ma mosquée')}
          hint={L('Remplace le calcul par les horaires affichés par ta mosquée (format 05:42). Une case vide garde l’horaire calculé.')}
          value={mosque.enabled}
          onChange={(v) => patch({ mosque: { ...mosque, enabled: v } })}
        />
        {mosque.enabled ? (
          <>
            <Field label={L('Nom de la mosquée (facultatif)')} value={mosque.name ?? ''} maxLength={60} onChangeText={(v) => patch({ mosque: { ...mosque, name: v } })} />
            {KEYS.map((k) => {
              const v = mosque.times[k] ?? '';
              const bad = v.trim() !== '' && parseHHMM(v) == null;
              return (
                <Field
                  key={k}
                  label={tr[k]}
                  value={v}
                  placeholder="HH:MM"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  error={bad ? L('Format attendu : 05:42') : null}
                  onChangeText={(t) => patch({ mosque: { ...mosque, times: { ...mosque.times, [k]: t } } })}
                />
              );
            })}
            <Muted>{L('Ces horaires sont répétés chaque jour : pense à les mettre à jour quand ta mosquée change d’horaires.')}</Muted>
          </>
        ) : null}
      </Card>
      <Muted style={{ marginTop: 6 }}>{L('Horaires calculés : vérifie avec ta mosquée locale.')}</Muted>
    </>
  );
}
