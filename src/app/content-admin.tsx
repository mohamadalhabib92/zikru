import { useState } from 'react';
import { Text } from '@/ui/Text';
import { NEXT_STATUS, STATUS_LABEL, type ContentItem, type ContentStatus } from '@/lib/content';
import { useData } from '@/lib/data';
import { uid } from '@/lib/storage';
import { Badge, Button, Card, Field, H1, H2, Muted, Notice, Row, Screen, Segmented, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

const TONE: Record<ContentStatus, 'neutral' | 'warning' | 'success'> = { draft: 'neutral', in_review: 'warning', approved: 'success' };

/** Éditeur local du workflow draft → in_review → approved (en production : rôle éditeur Supabase). */
export default function ContentAdmin() {
  const { content, setContent } = useData();
  const [filter, setFilter] = useState<ContentStatus | 'all'>('all');
  const [arabic, setArabic] = useState('');
  const [translit, setTranslit] = useState('');
  const [source, setSource] = useState('');
  const list = content.filter((c) => filter === 'all' || c.status === filter);
  const move = (id: string, status: ContentStatus) => setContent((cs) => cs.map((c) => (c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c)));
  return (
    <Screen>
      <H1>Workflow de contenu</H1>
      <Notice tone="info" title="Mode éditeur local" text="Seuls les éléments « Approuvé » apparaissent dans l’app. Chaque contenu doit citer sa source. Ne saisissez que des traductions déjà validées." />
      <Spacer />
      <Segmented options={[{ label: 'Tous', value: 'all' as const }, { label: 'Brouillon', value: 'draft' as const }, { label: 'Relecture', value: 'in_review' as const }, { label: 'Approuvé', value: 'approved' as const }]} value={filter} onChange={setFilter} />
      <Spacer />
      {list.map((c: ContentItem) => (
        <Card key={c.id} style={{ marginBottom: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: t.text, fontSize: 22, writingDirection: 'rtl', flex: 1 }}>{c.arabic}</Text>
            <Badge label={STATUS_LABEL[c.status]} tone={TONE[c.status]} />
          </Row>
          <Muted>
            {c.transliteration} · {c.source}
          </Muted>
          <Spacer h={8} />
          <Row wrap>
            {NEXT_STATUS[c.status] ? <Button small title={`→ ${STATUS_LABEL[NEXT_STATUS[c.status]!]}`} onPress={() => move(c.id, NEXT_STATUS[c.status]!)} /> : null}
            {c.status !== 'draft' ? <Button small variant="ghost" title="Renvoyer en brouillon" onPress={() => move(c.id, 'draft')} /> : null}
          </Row>
        </Card>
      ))}
      <Spacer />
      <H2>Nouveau brouillon</H2>
      <Field label="Texte arabe (avec tashkīl)" value={arabic} onChangeText={setArabic} />
      <Field label="Translittération" value={translit} onChangeText={setTranslit} />
      <Field label="Source (obligatoire)" value={source} onChangeText={setSource} hint="Ex. référence de recueil et numéro" />
      <Button
        title="Créer le brouillon"
        disabled={!arabic.trim() || !source.trim()}
        onPress={() => {
          setContent((cs) => [...cs, { id: uid('c'), kind: 'dhikr', arabic: arabic.trim(), transliteration: translit.trim() || undefined, translations: {}, source: source.trim(), status: 'draft', updatedAt: new Date().toISOString() }]);
          setArabic('');
          setTranslit('');
          setSource('');
        }}
      />
    </Screen>
  );
}
