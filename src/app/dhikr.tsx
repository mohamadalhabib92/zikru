import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { approvedOnly } from '@/lib/content';
import { useData } from '@/lib/data';
import { isPending } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { Badge, Button, Card, Empty, Eyebrow, Muted, Notice, Row, Screen, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

export default function Dhikr() {
  const { s, t: tr } = useSettings();
  const { content, setTasbih } = useData();
  const router = useRouter();
  const items = approvedOnly(content); // ← l'UI n'affiche que le contenu approuvé
  const tl = (s.lang === 'de-CH' ? 'de' : s.lang) as 'fr' | 'en' | 'de' | 'ff' | 'wo' | 'ar';
  return (
    <Screen>
      <Eyebrow>{tr.dhikr_title}</Eyebrow>
      {isPending(s.lang) ? <Notice tone="warning" title={tr.translation_pending} text="Interface affichée en français en attendant." /> : null}
      <Spacer h={8} />
      {items.some((i) => i.seedExample) ? <Notice tone="info" title="Contenu d’exemple" text="Formules d’amorçage à faire valider par un référent avant publication." icon="flask-outline" /> : null}
      <Spacer h={8} />
      {items.length === 0 ? <Empty icon="book-outline" title={tr.no_content} /> : null}
      {items.map((i) => {
        const translation = tl !== 'ar' ? i.translations[tl] : undefined;
        return (
          <Card key={i.id} style={{ marginBottom: 12 }}>
            <Text style={{ color: t.text, fontSize: 32, lineHeight: 56, textAlign: 'center', writingDirection: 'rtl' }} accessibilityLanguage="ar">
              {i.arabic}
            </Text>
            {i.transliteration ? <Text style={{ color: t.primary, textAlign: 'center', fontSize: 16 }}>{i.transliteration}</Text> : null}
            <Spacer h={8} />
            {tl === 'ar' ? null : translation ? <Text style={{ color: t.text, textAlign: 'center' }}>{translation}</Text> : <Muted style={{ textAlign: 'center' }}>{tr.translation_pending}</Muted>}
            <Spacer h={8} />
            <Row style={{ justifyContent: 'space-between' }} wrap>
              <Muted style={{ flex: 1 }}>
                {tr.source} : {i.source}
              </Muted>
              {i.seedExample ? <Badge label="Exemple" tone="info" /> : null}
            </Row>
            <Spacer h={8} />
            <Button
              title={`${tr.tasbih_title}${i.defaultCount ? ` × ${i.defaultCount}` : ''}`}
              small
              variant="secondary"
              icon="ellipse-outline"
              onPress={() => {
                setTasbih((x) => ({ ...x, dhikrId: i.id, count: 0, target: i.defaultCount && i.defaultCount > 1 ? i.defaultCount : x.target }));
                router.push('/tasbih');
              }}
            />
          </Card>
        );
      })}
    </Screen>
  );
}
