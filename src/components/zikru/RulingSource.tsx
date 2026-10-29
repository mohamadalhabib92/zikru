import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import type { FiqhRuling } from '@/lib/fiqh-rulings';
import { reportUrl } from '@/lib/provenance';
import { REVIEW_LABEL, reviewFor } from '@/lib/reviews';
import { Badge, Ionicons } from '@/ui/kit';
import { brand as b } from '@/ui/theme';
import { APP_VERSION } from './Provenance';
import { FIQH_EN } from '@/lib/i18n-content/fiqh';
import { L, useUiLang } from '@/lib/l10n';

export const rulingUid = (r: Pick<FiqhRuling, 'id'>) => `fiqh:${r.id}`;
export function rulingStatus(r: FiqhRuling) {
  return reviewFor(rulingUid(r)).status ?? r.status;
}

function Link({ label, url, icon }: { label: string; url: string; icon: 'open-outline' | 'mail-outline' }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => Linking.openURL(url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, minHeight: 32 }}>
      <Ionicons name={icon} size={15} color={b.brown} />
      <Text style={{ color: b.brown, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline', flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** Ligne de source d’un jugement de fiqh + extrait arabe, preuves, remarque, statut et « Signaler une erreur ». */
export function RulingSource({ r }: { r: FiqhRuling }) {
  const [open, setOpen] = useState(false);
  const st = rulingStatus(r);
  const uid = rulingUid(r);
  const lang = useUiLang();
  // Remarque du relecteur : anglais si disponible ; en arabe, la remarque française reste (destinée au relecteur).
  const note = lang === 'en' ? (FIQH_EN[r.id]?.note ?? r.note) : r.note;
  return (
    <View testID={`ruling-${r.id}`} style={{ marginTop: 6 }}>
      <Text style={{ color: b.inkMuted, fontSize: 12, lineHeight: 17 }}>
        Source : {r.source.book}, {r.source.chapter}, {r.source.page}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, alignItems: 'center' }}>
        <Badge label={REVIEW_LABEL[st]} tone={st === 'valide' ? 'success' : st === 'a_corriger' ? 'danger' : 'warning'} />
        {r.note ? <Badge label="Remarque du relecteur" tone="info" /> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ paddingVertical: 4, minHeight: 32, justifyContent: 'center' }}>
          <Text style={{ color: b.brown, fontWeight: '700', fontSize: 12 }}>{open ? 'Masquer le texte source' : 'Texte arabe, édition et signalement'}</Text>
        </Pressable>
      </View>
      {open ? (
        <View style={{ marginTop: 6, padding: 10, borderRadius: 12, backgroundColor: b.cream, borderWidth: 1, borderColor: b.line }}>
          <Text style={{ color: b.ink, fontSize: 17, lineHeight: 30, writingDirection: 'rtl', textAlign: 'right' }}>{r.textAr}</Text>
          <Text style={{ color: b.inkMuted, fontSize: 12, marginTop: 6 }}>
            {r.source.author}. {r.source.edition}.
          </Text>
          {r.also?.map((a, i) => (
            <Text key={i} style={{ color: b.inkMuted, fontSize: 12, marginTop: 4 }}>
              Voir aussi : {a.book}, {a.chapter}, {a.page}.
            </Text>
          ))}
          {r.evidence?.length ? <Text style={{ color: b.inkMuted, fontSize: 12, marginTop: 4 }}>Preuves : {r.evidence.join(' ; ')}</Text> : null}
          {note ? <Text style={{ color: b.ink, fontSize: 12, marginTop: 4 }}>{L('Remarque : {n}', { n: note })}</Text> : null}
          {r.source.url ? <Link label="Ouvrir la page de l’édition" url={r.source.url} icon="open-outline" /> : null}
          <Link label="Signaler une erreur" url={reportUrl(uid, `${r.title.fr} (${r.school})`, APP_VERSION)} icon="mail-outline" />
        </View>
      ) : null}
    </View>
  );
}
