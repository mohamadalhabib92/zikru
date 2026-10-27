import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSettings } from '@/lib/settings';
import { ADILLA, BIOGRAPHY, CONDITIONS, FORMULAS, HAILALA_FRIDAY, MUQADDAM_NOTE, WAZIFA, WIRD, type Step } from '@/lib/tijani';
import { Badge, Card, Chip, Eyebrow, H1, H2, Ionicons, Muted, Notice, Row, Screen, Segmented, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

type Tab = 'wird' | 'wazifa' | 'hailala' | 'path' | 'adilla';
const TABS: { v: Tab; label: string }[] = [
  { v: 'wird', label: 'Wird' },
  { v: 'wazifa', label: 'Wazifa' },
  { v: 'hailala', label: 'Hailala' },
  { v: 'path', label: 'La Voie' },
  { v: 'adilla', label: 'Adilla' },
];

export default function Tijani() {
  const p = useLocalSearchParams<{ tab?: string }>();
  const initial = (TABS.find((x) => x.v === p.tab)?.v ?? 'wird') as Tab;
  const [tab, setTab] = useState<Tab>(initial);
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const { t: tr } = useSettings();
  return (
    <Screen>
      <Eyebrow>Tariqa Tijaniyya</Eyebrow>
      <H1>{tr.tijani}</H1>
      <Spacer />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TABS.map((x) => (
          <Chip key={x.v} label={x.label} active={tab === x.v} onPress={() => setTab(x.v)} />
        ))}
      </ScrollView>
      <Spacer />
      {tab === 'wird' || tab === 'wazifa' ? <Segmented label="Traduction" options={[{ label: 'Français', value: 'fr' }, { label: 'English', value: 'en' }]} value={lang} onChange={setLang} /> : null}
      {tab === 'wird' ? <Timeline data={WIRD} lang={lang} /> : null}
      {tab === 'wazifa' ? <Timeline data={WAZIFA} lang={lang} /> : null}
      {tab === 'hailala' ? <Hailala /> : null}
      {tab === 'path' ? <Path /> : null}
      {tab === 'adilla' ? <Adilla /> : null}
      <Spacer />
      <Notice tone="info" icon="person-outline" title="Suivez votre muqaddam" text={MUQADDAM_NOTE} />
    </Screen>
  );
}

function Timeline({ data, lang }: { data: { title: string; when: string; steps: Step[] }; lang: 'fr' | 'en' }) {
  return (
    <View>
      <H2>{data.title}</H2>
      <Muted>{data.when}</Muted>
      <Spacer />
      {data.steps.map((st, i) => {
        const f = FORMULAS[st.formula];
        const last = i === data.steps.length - 1;
        return (
          <View key={i} style={{ flexDirection: 'row' }}>
            <View style={{ width: 34, alignItems: 'center' }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: t.onPrimary, fontWeight: '800' }}>{i + 1}</Text>
              </View>
              {!last ? <View style={{ flex: 1, width: 2, backgroundColor: t.border, marginVertical: 4 }} /> : null}
            </View>
            <View style={{ flex: 1, marginLeft: 10, marginBottom: 14 }}>
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: t.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{f.title}</Text>
                  <Badge label={`× ${st.count}`} tone="info" />
                </Row>
                <Text style={{ color: t.text, fontSize: 22, lineHeight: 40, textAlign: 'right', writingDirection: 'rtl', marginTop: 8 }}>{f.ar}</Text>
                <Text style={{ color: t.primary, fontStyle: 'italic', marginTop: 4 }}>{f.tr}</Text>
                <Text style={{ color: t.text, marginTop: 6, lineHeight: 21 }}>{lang === 'fr' ? f.fr : f.en}</Text>
                {f.indicative ? <Muted style={{ fontSize: 12, marginTop: 4 }}>{lang === 'fr' ? 'Traduction indicative.' : 'Indicative translation.'}</Muted> : null}
                {f.note ? <Muted style={{ fontSize: 12, marginTop: 4 }}>{f.note}</Muted> : null}
                {st.extra ? <Muted style={{ marginTop: 6 }}>{st.extra}</Muted> : null}
              </Card>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Hailala() {
  const f = FORMULAS.hailala;
  return (
    <Card>
      <Row gap={8}>
        <Ionicons name="calendar-outline" size={18} color={t.primary} />
        <Eyebrow>Vendredi</Eyebrow>
      </Row>
      <H2>{HAILALA_FRIDAY.title}</H2>
      <Muted>{HAILALA_FRIDAY.when}</Muted>
      <Text style={{ color: t.text, fontSize: 28, textAlign: 'center', marginVertical: 14 }}>{f.ar}</Text>
      <Text style={{ color: t.primary, fontStyle: 'italic', textAlign: 'center' }}>{f.tr}</Text>
      <Spacer />
      <Text style={{ color: t.text, lineHeight: 22 }}>{HAILALA_FRIDAY.text}</Text>
      {new Date().getDay() === 5 ? (
        <>
          <Spacer />
          <Badge label="C’est vendredi aujourd’hui" tone="success" />
        </>
      ) : null}
    </Card>
  );
}

function Path() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <View>
      <H2>Cheikh Ahmad al-Tijani</H2>
      {BIOGRAPHY.map((b, i) => (
        <Pressable key={b.title} accessibilityRole="button" accessibilityState={{ expanded: open === i }} onPress={() => setOpen(open === i ? null : i)}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{b.title}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
            </Row>
            {open === i ? <Text style={{ color: t.text, marginTop: 8, lineHeight: 22 }}>{b.body}</Text> : null}
          </Card>
        </Pressable>
      ))}
      <Spacer />
      <H2>Conditions de la voie</H2>
      <Muted>Telles qu’elles sont couramment énoncées ; le muqaddam les explique lors de la transmission.</Muted>
      <Spacer h={8} />
      <Card>
        {CONDITIONS.map((c, i) => (
          <Row key={i} gap={10} style={{ alignItems: 'flex-start', marginBottom: 8 }}>
            <Ionicons name="checkmark-circle-outline" size={18} color={t.success} />
            <Text style={{ color: t.text, flex: 1, lineHeight: 21 }}>{c}</Text>
          </Row>
        ))}
      </Card>
    </View>
  );
}

function Adilla() {
  const [kind, setKind] = useState<'all' | 'coran' | 'hadith'>('all');
  const list = ADILLA.filter((a) => kind === 'all' || a.kind === kind);
  return (
    <View>
      <H2>Adilla — preuves du dhikr</H2>
      <Muted>Versets (sourate:verset, sens traduit) et hadiths (recueil + numéro).</Muted>
      <Spacer h={8} />
      <Segmented options={[{ label: 'Tout', value: 'all' }, { label: 'Coran', value: 'coran' }, { label: 'Hadith', value: 'hadith' }]} value={kind} onChange={setKind} />
      {list.map((a) => (
        <Card key={a.ref}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Badge label={a.kind === 'coran' ? 'Coran' : 'Hadith'} tone={a.kind === 'coran' ? 'success' : 'info'} />
            <Muted style={{ fontSize: 12 }}>{a.topic}</Muted>
          </Row>
          <Text style={{ color: t.text, marginTop: 8, lineHeight: 22 }}>{a.text}</Text>
          <Text style={{ color: t.primary, fontWeight: '700', marginTop: 6 }}>{a.ref}</Text>
        </Card>
      ))}
    </View>
  );
}
