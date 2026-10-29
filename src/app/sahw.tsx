import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { APP_VERSION } from '@/components/zikru/Provenance';
import { SCHOOLS, SCHOOL_LABEL, citation, type FiqhSource } from '@/lib/fiqh-rulings';
import { useMadhab } from '@/lib/madhab';
import { reportUrl } from '@/lib/provenance';
import { REVIEW_LABEL, reviewFor } from '@/lib/reviews';
import { CASES, HOW, REFERENCE, SAHW_SOURCES, sahwUid, type SahwAnswer, type When } from '@/lib/sahw';
import { useSettings } from '@/lib/settings';
import { Badge, Card, Eyebrow, H1, H2, Ionicons, Muted, Notice, Row, Screen, Segmented, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

const WHEN: Record<When, { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' }> = {
  avant: { label: 'Avant le salam', tone: 'success' },
  après: { label: 'Après le salam', tone: 'info' },
  aucun: { label: 'Pas de prosternation', tone: 'neutral' },
  refaire: { label: 'Accomplir l’acte manqué', tone: 'warning' },
  selon: { label: 'Selon le cas', tone: 'warning' },
};

function SourceLine({ s, label = 'Source' }: { s: FiqhSource; label?: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => s.url && Linking.openURL(s.url)} style={{ paddingVertical: 3 }}>
      <Text style={{ color: t.muted, fontSize: 12, lineHeight: 17 }}>
        {label} : {s.book}, {s.chapter}, {s.page} <Text style={{ textDecorationLine: 'underline' }}>(ouvrir)</Text>
      </Text>
    </Pressable>
  );
}

function Answer({ a, uid, q }: { a: SahwAnswer; uid: string; q: string }) {
  const [ar, setAr] = useState(false);
  const w = WHEN[a.when];
  const st = reviewFor(uid).status;
  return (
    <View style={{ marginTop: 10 }}>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Badge label={w.label} tone={w.tone} />
        <Badge label={REVIEW_LABEL[st]} tone={st === 'valide' ? 'success' : 'warning'} />
      </Row>
      <Text style={{ color: t.text, marginTop: 8, lineHeight: 22 }}>{a.text}</Text>
      {a.note ? <Text style={{ color: t.muted, marginTop: 6, fontSize: 12, lineHeight: 17 }}>Remarque : {a.note}</Text> : null}
      <SourceLine s={a.source} />
      {a.also?.map((s, i) => <SourceLine key={i} s={s} label="Voir aussi" />)}
      <Pressable accessibilityRole="button" onPress={() => setAr(!ar)} style={{ paddingVertical: 4 }}>
        <Text style={{ color: t.primary, fontWeight: '700', fontSize: 12 }}>{ar ? 'Masquer le texte arabe' : 'Voir le texte arabe et l’édition'}</Text>
      </Pressable>
      {ar ? (
        <View>
          <Text style={{ color: t.text, fontSize: 17, lineHeight: 30, writingDirection: 'rtl', textAlign: 'right' }}>{a.textAr}</Text>
          <Text style={{ color: t.muted, fontSize: 12 }}>{citation(a.source)}</Text>
        </View>
      ) : null}
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(reportUrl(uid, q, APP_VERSION))} style={{ paddingVertical: 6 }}>
        <Text style={{ color: t.primary, fontWeight: '700', fontSize: 12, textDecorationLine: 'underline' }}>Signaler une erreur</Text>
      </Pressable>
    </View>
  );
}

export default function Sahw() {
  const { t: tr } = useSettings();
  const [madhab, setMadhab] = useMadhab();
  const [tab, setTab] = useState<'help' | 'how' | 'ref'>('help');
  const [sel, setSel] = useState<string | null>(null);
  const cases = CASES.filter((c) => c.by[madhab]);
  const gaps = CASES.filter((c) => !c.by[madhab]);
  return (
    <Screen>
      <Eyebrow>Sujud al-Sahw</Eyebrow>
      <H1>{tr.sahw}</H1>
      <Spacer />
      <Segmented label="École (réglage partagé avec le Fiqh et les Réglages)" options={SCHOOLS.map((s) => ({ label: SCHOOL_LABEL[s].fr, value: s }))} value={madhab} onChange={setMadhab} />
      <Segmented options={[{ label: 'Que s’est-il passé ?', value: 'help' }, { label: 'Comment', value: 'how' }, { label: 'Référence', value: 'ref' }]} value={tab} onChange={setTab} />

      {tab === 'help' ? (
        <View>
          <Muted>Choisissez la situation :</Muted>
          <Spacer h={8} />
          {cases.map((c) => {
            const open = sel === c.id;
            return (
              <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setSel(open ? null : c.id)}>
                <Card style={open ? { borderColor: t.primary } : undefined}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={{ color: t.text, fontWeight: '700', flex: 1, fontSize: 15 }}>{c.q}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
                  </Row>
                  {open ? <Answer a={c.by[madhab]!} uid={sahwUid(c.id, madhab)} q={`${c.q} (${madhab})`} /> : null}
                </Card>
              </Pressable>
            );
          })}
          {gaps.length ? (
            <Card>
              <H2>Cas non affichés pour cette école</H2>
              {gaps.map((c) => (
                <Muted key={c.id} style={{ marginTop: 4 }}>
                  • {c.q} — {c.gap?.[madhab] ?? 'non couvert par la source citée.'}
                </Muted>
              ))}
            </Card>
          ) : null}
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
          <Spacer h={6} />
          <Text style={{ color: t.text, fontSize: 16, lineHeight: 28, writingDirection: 'rtl', textAlign: 'right' }}>{HOW[madhab].textAr}</Text>
          <SourceLine s={HOW[madhab].source} />
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
          {REFERENCE[madhab].source.map((s, i) => (
            <SourceLine key={i} s={s} />
          ))}
        </View>
      ) : null}
      <Spacer />
      <Notice tone="info" icon="library-outline" title="Sources" text={SAHW_SOURCES} />
    </Screen>
  );
}
