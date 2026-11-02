import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { FAST_KINDS, nextMonThu, upcomingHijriEvents, type HijriEventKind } from '@/lib/hijri-events';
import { formatHijri, HIJRI_MONTHS } from '@/lib/hijri';
import { L, useUiLang } from '@/lib/l10n';
import { useSettings } from '@/lib/settings';
import { usePersistentState } from '@/lib/storage';
import { Badge, Button, Ionicons, Screen, Toggle, type IconName } from '@/ui/kit';
import { LCard, LMuted, LText, LTitle, SectionLabel } from '@/ui/light';
import { brand as b } from '@/ui/theme';

const META: Record<HijriEventKind, { title: string; icon: IconName; color: string }> = {
  'new-year': { title: 'Nouvel an hégirien', icon: 'calendar', color: b.teal },
  ashura: { title: 'Achoura', icon: 'water', color: b.blue },
  mawlid: { title: 'Mawlid (selon votre école)', icon: 'star', color: b.goldDeep },
  ramadan: { title: 'Début du Ramadan', icon: 'moon', color: b.green },
  'eid-fitr': { title: 'Aïd al-Fitr', icon: 'sparkles', color: b.green },
  'eid-adha': { title: 'Aïd al-Adha', icon: 'sparkles', color: b.green },
  'white-days': { title: 'Jours blancs (13, 14, 15)', icon: 'ellipse-outline', color: b.indigo },
};
const LOCALE: Record<string, string> = { ar: 'ar', en: 'en-GB', de: 'de-DE', 'de-CH': 'de-CH' };

/** v2 §3 — Calendrier hégirien : dates des événements (aucun texte religieux ajouté), Mawlid sur option. */
export default function HijriCalendar() {
  const { s } = useSettings();
  const lang = useUiLang();
  const router = useRouter();
  const [prefs, setPrefs] = usePersistentState<{ mawlid: boolean }>('hijri-events', { mawlid: false });
  const today = useMemo(() => new Date(), []);
  const events = useMemo(() => upcomingHijriEvents(today, { offset: s.hijriOffset, mawlid: prefs.mawlid }), [today, s.hijriOffset, prefs.mawlid]);
  const monThu = useMemo(() => nextMonThu(today, { offset: s.hijriOffset }), [today, s.hijriOffset]);
  const fmt = (k: string) => new Date(k + 'T12:00:00').toLocaleDateString(LOCALE[lang] ?? 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const when = (n: number) => (n === 0 ? L('Aujourd’hui') : n === 1 ? L('Demain') : L('Dans {n} jours', { n }));
  const month = (m: number) => (lang === 'ar' ? HIJRI_MONTHS.ar[m - 1] : HIJRI_MONTHS.translit[m - 1]);

  return (
    <Screen bg={b.cream}>
      <LCard>
        <LMuted>{L('Aujourd’hui')}</LMuted>
        <LTitle>{formatHijri(today, lang, s.hijriOffset)}</LTitle>
        <LMuted>{L('Les dates suivent le calendrier et le décalage choisis dans les réglages. L’observation locale du croissant peut décaler d’un jour : votre mosquée fait foi.')}</LMuted>
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <Button title={L('Régler le décalage hégirien')} variant="ghost" onPress={() => router.push('/settings')} />
        </View>
      </LCard>

      <SectionLabel>{L('Prochains événements')}</SectionLabel>
      {events.map((e) => {
        const m = META[e.kind];
        return (
          <LCard key={e.kind + e.day}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name={m.icon} size={22} color={m.color} />
              <View style={{ flex: 1 }}>
                <LText style={{ fontWeight: '800' }}>{L(m.title)}</LText>
                <LMuted>{`${e.hijri.day} ${month(e.hijri.month)} ${e.hijri.year} · ${fmt(e.day)}`}</LMuted>
                <Text style={{ color: b.inkMuted, fontWeight: '700' }}>{when(e.inDays)}</Text>
              </View>
            </View>
            {FAST_KINDS.has(e.kind) ? (
              <View style={{ marginTop: 6, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Badge label={L('Jeûne surérogatoire')} />
                <Badge tone="warning" label={L('Source à compléter')} />
              </View>
            ) : null}
          </LCard>
        );
      })}

      <SectionLabel>{L('Lundi et jeudi')}</SectionLabel>
      <LCard>
        <LText style={{ fontWeight: '800' }}>{L('Prochain lundi ou jeudi')}</LText>
        <LMuted>{monThu ? `${fmt(monThu.day)} · ${when(monThu.inDays)}` : '—'}</LMuted>
        <View style={{ marginTop: 6, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Badge label={L('Jeûne surérogatoire')} />
          <Badge tone="warning" label={L('Source à compléter')} />
        </View>
        <LMuted>{L('Aucune suggestion pendant le Ramadan ni les jours de l’Aïd. Références à compléter par un savant avant publication.')}</LMuted>
      </LCard>

      <SectionLabel>{L('Options')}</SectionLabel>
      <LCard>
        <Toggle
          label={L('Afficher le Mawlid')}
          hint={L('Selon votre école : désactivé par défaut.')}
          value={prefs.mawlid}
          onChange={(v) => setPrefs({ ...prefs, mawlid: v })}
        />
      </LCard>
    </Screen>
  );
}
