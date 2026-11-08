import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { PatternBg } from '@/components/zikru/Pattern';
import { ProvenanceBadges } from '@/components/zikru/Provenance';
import { ADHKAR_MOMENTS, ADHKAR_TO_COMPLETE, adhkarFor, MOMENT_ICON, MOMENT_LABEL, momentAt, momentDone, repsOf, type AdhkarMoment } from '@/lib/adhkar';
import { adhkarToday, bump, progressOf } from '@/lib/adhkar-store';
import { useData } from '@/lib/data';
import { duaView } from '@/lib/i18n-content';
import { L, useUiLang } from '@/lib/l10n';
import { computeDay } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { useShared } from '@/lib/shared-state';
import { resetCount } from '@/lib/tasbih-core';
import { Ionicons, Screen, type IconName } from '@/ui/kit';
import { Arabic, LCard, LMuted, LText, Pill } from '@/ui/light';
import { brand as b } from '@/ui/theme';

const isMoment = (x: unknown): x is AdhkarMoment => typeof x === 'string' && (ADHKAR_MOMENTS as string[]).includes(x);

/**
 * Adhkar du matin, du soir, après la prière et avant de dormir : uniquement les invocations déjà sourcées de l’app
 * (voir src/lib/adhkar.ts). Compteur du jour enregistré sur l’appareil, hors-ligne.
 */
export default function Adhkar() {
  const { s } = useSettings();
  const router = useRouter();
  const qp = useLocalSearchParams<{ m?: string }>();
  const lang = useUiLang();
  const { tasbih, setTasbih, saveSession } = useData();
  useShared(adhkarToday); // re-rendu à chaque compte
  const initial = useMemo<AdhkarMoment>(() => {
    if (isMoment(qp.m)) return qp.m;
    const t = Object.fromEntries(computeDay(new Date(), s.place, s.method, s.madhab, s.prayer).map((x) => [x.key, x.time]));
    return momentAt(new Date(), t);
  }, [qp.m, s.place, s.method, s.madhab, s.prayer]);
  const [m, setM] = useState<AdhkarMoment>(initial);
  const list = adhkarFor(m);
  const prog = progressOf(m);
  const { done, total } = momentDone(m, prog);
  const todo = ADHKAR_TO_COMPLETE.filter((x) => x.moments.includes(m));

  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={b.teal} style={{ padding: 20, alignItems: 'center' }}>
        <Ionicons name={MOMENT_ICON[m] as IconName} size={28} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 }} accessibilityRole="header">
          {L(MOMENT_LABEL[m])}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.92)', textAlign: 'center' }}>{L('{a} sur {b} terminées aujourd’hui', { a: done, b: total })}</Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 12 }}>
          {ADHKAR_MOMENTS.map((x) => (
            <Pill key={x} label={L(MOMENT_LABEL[x])} active={m === x} onPress={() => setM(x)} color={b.teal} />
          ))}
        </ScrollView>
        {list.map((d) => {
          const v = duaView(d, lang);
          const reps = repsOf(d);
          const n = prog[d.id] ?? 0;
          const ok = n >= reps;
          return (
            <LCard key={d.id}>
              <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{v.title}</Text>
              {v.when ? <LMuted style={{ fontSize: 12, marginTop: 2 }}>{v.when}</LMuted> : null}
              <Arabic size={22} style={{ marginTop: 8 }}>
                {d.ar}
              </Arabic>
              <Text style={{ color: b.brownSoft, fontStyle: 'italic', marginTop: 4, lineHeight: 20 }}>{d.tr}</Text>
              {v.meaning ? <LText style={{ marginTop: 6 }}>{v.meaning}</LText> : null}
              {v.meaning ? <LMuted style={{ fontSize: 11, marginTop: 4 }}>{v.toReview ? v.translation : L('Traduction : Zikru, à relire par une personne de savoir')}</LMuted> : null}
              {v.note ? <LMuted style={{ marginTop: 6 }}>{v.note}</LMuted> : null}
              <Text style={{ color: b.brown, fontWeight: '800', marginTop: 8, fontSize: 13 }}>{d.ref}</Text>
              <ProvenanceBadges set="duas" id={d.id} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={L('Compter : {n} sur {r}', { n, r: reps })}
                  accessibilityHint={L('Appui long pour remettre à zéro')}
                  onPress={() => bump(m, d.id, 1, reps)}
                  onLongPress={() => bump(m, d.id, -reps, reps)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, minWidth: 96, paddingHorizontal: 16, borderRadius: 22, backgroundColor: ok ? b.green : b.teal, opacity: pressed ? 0.85 : 1, justifyContent: 'center' })}
                >
                  <Ionicons name={ok ? 'checkmark-circle' : 'add-circle-outline'} size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{reps > 1 ? `${n} / ${reps}` : ok ? L('Fait') : L('Marquer comme fait')}</Text>
                </Pressable>
                {reps > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={L('Compter avec le tasbih')}
                    onPress={() => {
                      if (tasbih.count > 0) saveSession();
                      setTasbih((t) => ({ ...resetCount(t), target: reps }));
                      router.push('/tasbih');
                    }}
                    style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: b.line, backgroundColor: b.paper, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Ionicons name="ellipse-outline" size={16} color={b.ink} />
                    <Text style={{ color: b.ink, fontWeight: '700' }}>Tasbih</Text>
                  </Pressable>
                ) : null}
              </View>
            </LCard>
          );
        })}
        {todo.length ? (
          <LCard>
            <Text style={{ color: b.ink, fontWeight: '800' }}>{L('Source à compléter')}</Text>
            <LMuted style={{ marginTop: 4 }}>{L('Ces adhkar ne sont pas encore affichés : leur source doit d’abord être vérifiée par une personne de savoir (fiche de validation).')}</LMuted>
            {todo.map((x) => (
              <LMuted key={x.uid} style={{ marginTop: 6 }}>
                {`• ${L(x.title)}`}
              </LMuted>
            ))}
          </LCard>
        ) : null}
        <LMuted style={{ marginTop: 8 }}>
          {L('Sélection d’invocations déjà sourcées dans Zikru, classées par moment d’après leur indication et dans l’esprit de Ḥiṣn al-Muslim. Chaque carte garde sa référence et le jugement vérifié ; le classement reste à valider.')}
        </LMuted>
      </View>
    </Screen>
  );
}
