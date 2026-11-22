import { router } from 'expo-router';
import { useMemo } from 'react';
import { TvBack, TvButton, TvMuted, TvPremiumGate, TvRow, TvTitle, TvVirtualList } from '@/components/tv/ui';
import { AQIDA_SCHOLAR_FLAG, AQIDA_SECTIONS } from '@/lib/aqida-murshid';
import { L } from '@/lib/l10n';

type Section = (typeof AQIDA_SECTIONS)[number];

/** Liste des chapitres du matn. Gratuit, comme le Coran. Les explications Premium de l’iPhone ne sont pas ouvertes ici. */
export default function TvAqidaIndex() {
  const header = useMemo(
    () => (
      <>
        <TvTitle>{L('Aqida (Ibn ʿĀshir)')}</TvTitle>
        <TvMuted>{L('Ce que l’on doit croire d’Allah')}</TvMuted>
        <TvMuted>{L('ʿAqīda ashʿarite, selon le matn d’Ibn ʿĀshir')}</TvMuted>
        <TvMuted>{L(AQIDA_SCHOLAR_FLAG)}</TvMuted>
        <TvRow>
          <TvBack />
        </TvRow>
      </>
    ),
    [],
  );
  return (
    <TvPremiumGate feature="aqida">
      <TvVirtualList
        data={AQIDA_SECTIONS}
        keyExtractor={(s) => s.id}
        header={header}
        renderItem={(s: Section) => (
          <TvButton
            block
            label={L(s.title)}
            hint={s.sanusi ? L('Bloc distinct : structure d’Umm al-Barāhīn. Ce n’est pas un vers d’Ibn ʿĀshir.') : L(AQIDA_SCHOLAR_FLAG)}
            onPress={() => router.push(`/tv/aqida/${s.id}`)}
          />
        )}
      />
    </TvPremiumGate>
  );
}
