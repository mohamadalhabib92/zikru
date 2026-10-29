import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { GRADE_LABEL, GRADINGS_CHECKED_AT, dorarSearchUrl, gradeTone, provenanceFor, reportUrl } from '@/lib/provenance';
import type { ProvenanceItem, ProvenanceSet } from '@/lib/provenance-types';
import { REVIEW_LABEL } from '@/lib/reviews';
import { Badge, Ionicons } from '@/ui/kit';
import { brand as b } from '@/ui/theme';

export const APP_VERSION = Constants.expoConfig?.version ?? 'web';

/** Jugements résumés : un par (hadith, savant), dans l’ordre des sources. */
export function gradingSummary(p: ProvenanceItem) {
  const seen = new Set<string>();
  return p.gradings.filter((g) => {
    const k = g.key + '|' + g.grader;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function Link({ label, url, icon = 'open-outline' }: { label: string; url: string; icon?: 'open-outline' | 'mail-outline' | 'search-outline' }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => Linking.openURL(url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, minHeight: 32 }}>
      <Ionicons name={icon} size={15} color={b.brown} />
      <Text style={{ color: b.brown, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline', flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** Badges de provenance (jugement + statut de validation) et détail dépliable avec « Signaler une erreur ». */
export function ProvenanceBadges({ set, id, item }: { set?: ProvenanceSet; id?: string; item?: ProvenanceItem }) {
  const p = item ?? (set && id !== undefined ? provenanceFor(set, id) : undefined);
  const [open, setOpen] = useState(false);
  if (!p) return null;
  const sum = gradingSummary(p);
  const hasQuran = p.sources.some((s) => s.kind === 'coran');
  const hasTariqa = p.sources.some((s) => s.kind === 'tariqa');
  const hasUsage = p.sources.some((s) => s.kind === 'usage');
  return (
    <View style={{ marginTop: 8 }} testID={`prov-${p.uid}`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {sum.slice(0, 3).map((g) => (
          <Badge key={g.key + g.grader} label={`${GRADE_LABEL[g.grade]} · ${g.grader.replace(/ \(recueil.*\)/, '')}`} tone={gradeTone(g.grade)} />
        ))}
        {sum.length > 3 ? <Badge label={`+${sum.length - 3}`} tone="neutral" /> : null}
        {p.gradingState === 'non_verifie' ? <Badge label="Grading non vérifié" tone="warning" /> : null}
        {hasQuran ? <Badge label="Coran" tone="success" /> : null}
        {hasTariqa ? <Badge label="Tradition tijanie (pas un hadith)" tone="neutral" /> : null}
        {hasUsage ? <Badge label="Formule usuelle" tone="neutral" /> : null}
        {p.divergence ? <Badge label="Jugements divergents" tone="warning" /> : null}
        <Badge label={REVIEW_LABEL[p.review.status]} tone={p.review.status === 'valide' ? 'success' : p.review.status === 'a_corriger' ? 'danger' : 'neutral'} />
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="Sources et jugements" onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, minHeight: 32 }}>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={b.inkMuted} />
        <Text style={{ color: b.inkMuted, fontSize: 12, fontWeight: '700' }}>Sources, jugements et signalement</Text>
      </Pressable>
      {open ? (
        <View style={{ borderTopWidth: 1, borderColor: b.line, paddingTop: 6 }}>
          {p.sources.map((s, i) => (
            <View key={i}>
              {s.url ? <Link label={s.label} url={s.url} /> : <Text style={{ color: b.ink, fontSize: 13, paddingVertical: 4 }}>• {s.label}</Text>}
              {s.kind === 'hadith' && s.key
                ? p.gradings
                    .filter((g) => g.key === s.key)
                    .map((g, j) => (
                      <Pressable key={j} accessibilityRole="link" onPress={() => Linking.openURL(g.url)} style={{ paddingLeft: 21, paddingVertical: 2 }}>
                        <Text style={{ color: b.inkMuted, fontSize: 12 }}>
                          {g.raw} — {g.site}
                          {g.book ? ` (${g.book})` : ''}
                        </Text>
                      </Pressable>
                    ))
                : null}
              {s.kind === 'hadith' && s.key && !p.gradings.some((g) => g.key === s.key) ? (
                <Text style={{ color: b.rust, fontSize: 12, paddingLeft: 21 }}>Grading non vérifié : aucun jugement recopié pour cette référence.</Text>
              ) : null}
            </View>
          ))}
          {p.arabic && p.sources.some((s) => s.kind === 'hadith') ? <Link icon="search-outline" label="Rechercher ce texte sur dorar.net" url={dorarSearchUrl(p.arabic)} /> : null}
          <Text style={{ color: b.inkMuted, fontSize: 11, marginTop: 2 }}>
            Jugements recopiés tels qu’affichés par sunnah.com / dorar.net (consultés le {GRADINGS_CHECKED_AT}). Statut : {REVIEW_LABEL[p.review.status]}
            {p.review.role ? ` par ${p.review.role}` : ''}
            {p.review.date ? `, ${p.review.date}` : ''}
            {p.review.version ? ` (v${p.review.version})` : ''}.
          </Text>
          <Link icon="mail-outline" label="Signaler une erreur" url={reportUrl(p.uid, p.title, APP_VERSION)} />
        </View>
      ) : null}
    </View>
  );
}
