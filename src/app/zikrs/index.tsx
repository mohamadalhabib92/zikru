import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { LBtn, ZCOLOR, fmt, shareZikr } from '@/components/zikr/parts';
import { PatternBg } from '@/components/zikru/Pattern';
import { compositionTotals, dayKey, exportText, type Zikr } from '@/lib/zikr';
import { useZikrs } from '@/lib/zikrs';
import { Ionicons, Screen } from '@/ui/kit';
import { Arabic, LCard, LMuted, LText } from '@/ui/light';
import { brand as b } from '@/ui/theme';

function confirm(msg: string, ok: () => void) {
  if (Platform.OS === 'web') {
    if ((globalThis as { confirm?: (m: string) => boolean }).confirm?.(msg) ?? true) ok();
    return;
  }
  Alert.alert('Confirmer', msg, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: ok },
  ]);
}

export default function Zikrs() {
  const router = useRouter();
  const { zikrs, create, remove, systems, opts, ready } = useZikrs();
  const [msg, setMsg] = useState<string | null>(null);
  const today = dayKey();
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2000);
  };
  const share = async (z: Zikr) => {
    const r = await shareZikr(exportText(z, systems, opts), z.name);
    if (r === 'copied') flash('Texte copié dans le presse-papiers');
  };

  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={ZCOLOR} style={{ padding: 20, alignItems: 'center' }}>
        <Ionicons name="albums" size={26} color="#fff" />
        <Text
          style={{
            color: '#fff',
            fontSize: 26,
            writingDirection: 'rtl',
            marginTop: 4,
          }}
        >
          أذكاري
        </Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Mes zikrs</Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.88)',
            textAlign: 'center',
            marginTop: 2,
          }}
        >
          Composez vos propres zikrs : Noms d’Allah, du‘as coraniques et prophétiques, ṣalawāt, texte libre — abjad calculé automatiquement.
        </Text>
      </PatternBg>
      <View style={{ padding: 16, gap: 12 }}>
        <LBtn
          icon="add-circle"
          label="Nouvelle composition"
          solid
          onPress={() => {
            const z = create('Mon zikr');
            router.push({ pathname: '/zikrs/edit', params: { id: z.id } });
          }}
        />
        {msg ? <Text style={{ color: b.green, fontWeight: '700', textAlign: 'center' }}>{msg}</Text> : null}
        {ready && !zikrs.length ? (
          <LCard>
            <LText style={{ fontWeight: '800' }}>Aucune composition pour l’instant</LText>
            <LMuted style={{ marginTop: 4 }}>
              Créez un zikr puis ajoutez-y des éléments, chacun avec son nombre de répétitions. Vous pouvez aussi utiliser « Ajouter à un zikr » depuis les Noms d’Allah, les Du‘as ou le Coran.
            </LMuted>
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 10,
              }}
            >
              <LBtn icon="sparkles-outline" label="Les 99 Noms" onPress={() => router.push('/names')} />
              <LBtn icon="hand-left-outline" label="Du‘as" onPress={() => router.push('/duas')} />
              <LBtn icon="book-outline" label="Coran" onPress={() => router.push('/quran')} />
            </View>
          </LCard>
        ) : null}
        {zikrs.map((z) => {
          const t = systems.map((s) => ({
            s,
            ...compositionTotals(z.items, s, opts),
          }));
          const doneToday = z.done?.[today] ?? 0;
          return (
            <LCard key={z.id}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: b.ink, fontWeight: '800', fontSize: 17 }}>{z.name}</Text>
                  {z.niyya ? <LMuted style={{ fontStyle: 'italic', marginTop: 2 }}>{`Intention : ${z.niyya}`}</LMuted> : null}
                  <LMuted style={{ fontSize: 12, marginTop: 4 }}>{`${z.items.length} élément${z.items.length > 1 ? 's' : ''} · ${fmt(t[0]?.totalReps ?? 0)} répétitions`}</LMuted>
                </View>
                {z.goal ? (
                  <View
                    style={{
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                      backgroundColor: doneToday >= z.goal.perDay ? b.green + '1A' : b.gold + '26',
                    }}
                  >
                    <Text
                      style={{
                        color: doneToday >= z.goal.perDay ? b.green : b.brown,
                        fontWeight: '900',
                      }}
                    >{`${doneToday}/${z.goal.perDay}`}</Text>
                    <Text style={{ color: b.inkMuted, fontSize: 10 }}>{z.goal.moment && z.goal.moment !== 'Libre' ? z.goal.moment : 'aujourd’hui'}</Text>
                  </View>
                ) : doneToday ? (
                  <Text style={{ color: b.green, fontWeight: '800', fontSize: 12 }}>{`✓ ${doneToday}× aujourd’hui`}</Text>
                ) : null}
              </View>
              {z.items[0] ? (
                <Arabic size={20} style={{ marginTop: 8 }}>
                  {z.items
                    .slice(0, 3)
                    .map((i) => i.ar.split(' ').slice(0, 6).join(' '))
                    .join(' • ')}
                </Arabic>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 8,
                }}
              >
                {t.map((x) => (
                  <Text
                    key={x.s}
                    style={{
                      color: x.s === 'mashriqi' ? '#2F7FD0' : '#2E8B57',
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >{`Abjad ${x.s} : ${fmt(x.perRecitation)} · × rép. ${fmt(x.withReps)}`}</Text>
                ))}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <LBtn
                  icon="play"
                  label="Pratiquer"
                  solid
                  disabled={!z.items.length}
                  onPress={() =>
                    router.push({
                      pathname: '/zikrs/practice',
                      params: { id: z.id },
                    })
                  }
                />
                <LBtn
                  icon="create-outline"
                  label="Modifier"
                  onPress={() =>
                    router.push({
                      pathname: '/zikrs/edit',
                      params: { id: z.id },
                    })
                  }
                />
                <LBtn icon="share-outline" label="Partager" onPress={() => void share(z)} />
                <LBtn icon="trash-outline" label="Supprimer" color="#B3261E" onPress={() => confirm(`Supprimer « ${z.name} » ?`, () => remove(z.id))} />
              </View>
            </LCard>
          );
        })}
        <LMuted style={{ fontSize: 12 }}>Vos compositions sont enregistrées sur cet appareil. Les sessions pratiquées apparaissent dans l’historique du tasbih.</LMuted>
      </View>
    </Screen>
  );
}
