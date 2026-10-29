import { useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { APP_VERSION } from '@/components/zikru/Provenance';
import type { ReviewStatus } from '@/lib/provenance-types';
import { REVIEW_LABEL } from '@/lib/reviews';
import { reviewCsv, reviewMarkdown, reviewRows, type ReviewRow } from '@/lib/review-sheet';
import { Badge, Button, Card, Eyebrow, H1, H2, Muted, Row, Screen, Segmented, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

type Kind = 'all' | ReviewRow['kind'];
const STATUSES: ReviewStatus[] = ['a_valider', 'source_a_completer', 'a_corriger', 'valide'];

function download(name: string, text: string, type: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Écran discret pour les relecteurs : tout le contenu religieux par statut de validation, avec export. */
export default function Validation() {
  const rows = useMemo(() => reviewRows(), []);
  const [kind, setKind] = useState<Kind>('all');
  const [status, setStatus] = useState<ReviewStatus>('a_valider');
  const [limit, setLimit] = useState(40);
  const scoped = rows.filter((r) => kind === 'all' || r.kind === kind);
  const shown = scoped.filter((r) => r.status === status);
  const n = (k: ReviewRow['kind']) => rows.filter((r) => r.kind === k).length;
  const verified = rows.filter((r) => r.gradingState === 'verifie').length;
  const unverified = rows.filter((r) => r.gradingState === 'non_verifie').length;
  return (
    <Screen>
      <Eyebrow>Pour les relecteurs</Eyebrow>
      <H1>Validation savante</H1>
      <Muted>
        Chaque texte, jugement de fiqh et réponse de sujud as-sahw, avec sa source et son statut. Par défaut, tout est « à valider ». Un élément n’est marqué « validé » qu’après relecture par une personne de savoir (rôle, date et version notés).
      </Muted>
      <Spacer />
      <Card>
        <H2>Couverture</H2>
        <Text style={{ color: t.text, lineHeight: 22 }}>
          {rows.length} éléments : {n('texte')} textes (invocations, hadiths, salawat, Noms…), {n('fiqh')} jugements de fiqh, {n('sahw')} réponses sahw.
        </Text>
        <Text style={{ color: t.text, lineHeight: 22 }}>
          Textes avec jugement de hadith recopié : {verified} · non vérifiés : {unverified} · sans objet (Coran, tradition) : {n('texte') - verified - unverified}.
        </Text>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {STATUSES.map((s) => (
            <Badge key={s} label={`${REVIEW_LABEL[s]} : ${scoped.filter((r) => r.status === s).length}`} tone={s === 'valide' ? 'success' : s === 'a_corriger' || s === 'source_a_completer' ? 'danger' : 'warning'} />
          ))}
        </Row>
        {Platform.OS === 'web' ? (
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 12 }}>
            <Button title="Exporter CSV" variant="secondary" icon="download-outline" onPress={() => download('zikru-validation-savante.csv', reviewCsv(rows), 'text/csv;charset=utf-8')} />
            <Button title="Exporter Markdown" variant="secondary" icon="document-text-outline" onPress={() => download('zikru-validation-savante.md', reviewMarkdown(rows, APP_VERSION), 'text/markdown;charset=utf-8')} />
          </Row>
        ) : (
          <Muted style={{ marginTop: 8 }}>L’export CSV / Markdown est disponible sur la version web.</Muted>
        )}
      </Card>
      <Segmented options={[{ label: 'Tout', value: 'all' }, { label: 'Textes', value: 'texte' }, { label: 'Fiqh', value: 'fiqh' }, { label: 'Sahw', value: 'sahw' }]} value={kind} onChange={(v) => { setKind(v); setLimit(40); }} />
      <Segmented options={STATUSES.map((s) => ({ label: REVIEW_LABEL[s], value: s }))} value={status} onChange={(v) => { setStatus(v); setLimit(40); }} />
      {shown.length === 0 ? <Muted>Aucun élément avec ce statut.</Muted> : null}
      {shown.slice(0, limit).map((r) => (
        <Card key={r.uid}>
          <Text style={{ color: t.muted, fontSize: 12 }}>
            {r.group} · {r.uid}
          </Text>
          <Text style={{ color: t.text, fontWeight: '700', marginTop: 2 }}>{r.title}</Text>
          <Text style={{ color: r.source ? t.muted : t.danger, fontSize: 12, marginTop: 4, lineHeight: 17, fontWeight: r.source ? '400' : '700' }}>Source : {r.source || 'à compléter (aucune source précise pour l’instant)'}</Text>
          {r.grading ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{r.grading}</Text> : null}
          {r.note ? <Text style={{ color: t.text, fontSize: 12, marginTop: 2, lineHeight: 17 }}>Remarque : {r.note}</Text> : null}
        </Card>
      ))}
      {shown.length > limit ? <Button title={`Afficher plus (${shown.length - limit} restants)`} variant="secondary" onPress={() => setLimit(limit + 40)} /> : null}
      <View style={{ height: 20 }} />
    </Screen>
  );
}
