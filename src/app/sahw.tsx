import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CASES, HOW, REFERENCE, SAHW_SOURCES, type Madhab, type When } from '@/lib/sahw';
import { useSettings } from '@/lib/settings';
import { Badge, Card, Eyebrow, H1, H2, Ionicons, Muted, Notice, Row, Screen, Segmented, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

const WHEN: Record<When, { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' }> = {
  avant: { label: 'Avant le salam', tone: 'success' },
  après: { label: 'Après le salam', tone: 'info' },
  aucun: { label: 'Pas de prosternation', tone: 'neutral' },
  refaire: { label: 'Accomplir l’acte manqué', tone: 'warning' },
};

export default function Sahw() {
  const { t: tr } = useSettings();
  const [madhab, setMadhab] = useState<Madhab>('maliki');
  const [tab, setTab] = useState<'help' | 'how' | 'ref'>('help');
  const [sel, setSel] = useState<string | null>(null);
  return (
    <Screen>
      <Eyebrow>Sujud al-Sahw</Eyebrow>
      <H1>{tr.sahw}</H1>
      <Spacer />
      <Segmented label="École" options={[{ label: 'Malikite', value: 'maliki' }, { label: 'Chaféite', value: 'shafii' }]} value={madhab} onChange={setMadhab} />
      <Segmented options={[{ label: 'Que s’est-il passé ?', value: 'help' }, { label: 'Comment', value: 'how' }, { label: 'Référence', value: 'ref' }]} value={tab} onChange={setTab} />

      {tab === 'help' ? (
        <View>
          <Muted>Choisissez la situation :</Muted>
          <Spacer h={8} />
          {CASES.map((c) => {
            const r = c[madhab];
            const open = sel === c.id;
            const w = WHEN[r.when];
            return (
              <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setSel(open ? null : c.id)}>
                <Card style={open ? { borderColor: t.primary } : undefined}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={{ color: t.text, fontWeight: '700', flex: 1, fontSize: 15 }}>{c.q}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
                  </Row>
                  {open ? (
                    <View style={{ marginTop: 10 }}>
                      <Badge label={w.label} tone={w.tone} />
                      <Text style={{ color: t.text, marginTop: 8, lineHeight: 22 }}>{r.text}</Text>
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {tab === 'how' ? (
        <Card>
          <H2>{HOW[madhab].title}</H2>
          {HOW[madhab].steps.map((x, i) => (
            <Row key={i} gap={10} style={{ alignItems: 'flex-start', marginTop: 8 }}>
              <Text style={{ color: t.primary, fontWeight: '800' }}>{i + 1}.</Text>
              <Text style={{ color: t.text, flex: 1, lineHeight: 22 }}>{x}</Text>
            </Row>
          ))}
        </Card>
      ) : null}

      {tab === 'ref' ? (
        <View>
          {REFERENCE[madhab].cats.map((c, ci) => (
            <Card key={c.name}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2>{c.name}</H2>
                <Badge label={ci === 0 ? 'Obligatoire' : ci === 1 ? 'Prosternation' : 'Aucune'} tone={ci === 0 ? 'warning' : ci === 1 ? 'success' : 'neutral'} />
              </Row>
              <Muted>{c.rule}</Muted>
              <Spacer h={6} />
              {REFERENCE[madhab].items
                .filter((x) => x.cat === c.name)
                .map((x) => (
                  <Text key={x.act} style={{ color: t.text, marginTop: 4, lineHeight: 21 }}>
                    • {x.act}
                  </Text>
                ))}
            </Card>
          ))}
        </View>
      ) : null}
      <Spacer />
      <Notice tone="info" icon="library-outline" title="Sources" text={SAHW_SOURCES} />
    </Screen>
  );
}
