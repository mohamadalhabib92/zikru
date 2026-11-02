import { TextInput, View } from 'react-native';
import { setDispense } from '@/lib/dispense';
import { HIGH_LAT_KEYS, PRAYER_KEYS, clampAdjust, type HighLatKey, type PrayerKey } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { Button, Card, Chip, Field, H2, Muted, Row, Spacer, Toggle } from '@/ui/kit';
import { theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

const HIGH_LAT_LABEL: Record<HighLatKey, string> = {
  recommended: 'Recommandée',
  middle: 'Milieu de la nuit',
  seventh: 'Un septième de la nuit',
  angle: 'Angle du crépuscule',
};

/** Horaires fiables : hautes latitudes, ajustements, mosquée, mode dispense. Tout reste sur l’appareil. */
export function PrayerReliability() {
  const { s, set, t: tr } = useSettings();
  const mosque = s.mosque ?? { enabled: false, label: '', times: {} };
  const setTime = (key: PrayerKey, value: string) => set({ mosque: { ...mosque, times: { ...mosque.times, [key]: value } } });
  return (
    <>
      <Muted>Méthode par défaut pour la Suisse : YOUR_DEFAULT_PRAYER_METHOD (à valider). Le repli technique (Muslim World League) n’est pas une norme officielle.</Muted>
      <Muted>UOIF : angles 12° / 12° couramment publiés — à valider.</Muted>
      <Spacer h={8} />
      <H2>Règle des hautes latitudes</H2>
      <Row wrap>
        {HIGH_LAT_KEYS.map((k) => (
          <Chip key={k} label={HIGH_LAT_LABEL[k]} active={(s.highLat ?? 'recommended') === k} onPress={() => set({ highLat: k })} />
        ))}
      </Row>
      <Spacer h={12} />
      <H2>Ajustement manuel (minutes)</H2>
      <Muted>Appliqué au calcul, pas aux heures de mosquée. De −90 à +90.</Muted>
      <Card>
        {PRAYER_KEYS.map((key) => {
          const n = s.adjustments?.[key] ?? 0;
          return (
            <Row key={key} style={{ minHeight: 48, justifyContent: 'space-between' }}>
              <Muted style={{ flex: 1, marginBottom: 0 }}>{tr[key]}</Muted>
              <Row>
                <Button title="−" variant="secondary" onPress={() => set({ adjustments: { ...s.adjustments, [key]: clampAdjust(n - 1) } })} accessibilityLabel={L('{l} : diminuer', { l: tr[key] })} />
                <Muted style={{ minWidth: 48, textAlign: 'center', marginBottom: 0 }}>{n > 0 ? `+${n}` : String(n)}</Muted>
                <Button title="+" variant="secondary" onPress={() => set({ adjustments: { ...s.adjustments, [key]: clampAdjust(n + 1) } })} accessibilityLabel={L('{l} : augmenter', { l: tr[key] })} />
              </Row>
            </Row>
          );
        })}
      </Card>
      <H2>Horaires de ma mosquée</H2>
      <Card>
        <Toggle label="Horaires de ma mosquée" hint="Prioritaires sur le calcul. Laissez une case vide pour garder l’heure calculée." value={mosque.enabled} onChange={(v) => set({ mosque: { ...mosque, enabled: v } })} />
        <Field label="Nom du lieu (facultatif)" value={mosque.label} onChangeText={(label) => set({ mosque: { ...mosque, label } })} />
        {PRAYER_KEYS.map((key) => (
          <View key={key} style={{ marginBottom: 8 }}>
            <Muted>{tr[key]}</Muted>
            <TextInput
              value={mosque.times[key] ?? ''}
              onChangeText={(v) => setTime(key, v)}
              placeholder="HH:MM"
              accessibilityLabel={tr[key]}
              keyboardType="numbers-and-punctuation"
              style={{ minHeight: 48, borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, color: t.text, backgroundColor: t.surface }}
            />
          </View>
        ))}
      </Card>
      <H2>Mode dispense</H2>
      <Toggle
        label="Mode dispense"
        hint="Local uniquement, jamais synchronisé. Les rappels sont suspendus et la série n’est pas cassée."
        value={s.dispense?.on === true}
        onChange={(v) => set({ dispense: setDispense(s.dispense, v) })}
      />
      <Spacer h={8} />
    </>
  );
}
