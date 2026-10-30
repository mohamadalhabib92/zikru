import { BleStatusChip } from '@/components/BleStatusChip';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { approvedOnly } from '@/lib/content';
import { useData } from '@/lib/data';
import { useBleCounter } from '@/lib/ble/manager';
import { useSettings } from '@/lib/settings';
import { Button, Card, Chip, Eyebrow, H2, Muted, Row, Screen, Segmented, Spacer } from '@/ui/kit';
import { ProgressRing, tapHaptic, useLayout } from '@/ui/ds';
import { Arabic } from '@/ui/light';
import { brand as b, theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';
import { uid } from '@/lib/storage';
import { closeSession, groupSessions, resetCount, switchDhikr } from '@/lib/tasbih-core';

export default function TasbihScreen() {
  const { t: tr } = useSettings();
  const { tasbih, setTasbih, increment, saveSession, content, ready } = useData();
  const router = useRouter();
  const approved = approvedOnly(content);
  const current = approved.find((c) => c.id === tasbih.dhikrId) ?? approved[0];
  // Historique affiché : lignes consécutives du même dhikr et de la même source (< 5 min) regroupées.
  // Non destructif : les lignes enregistrées, le journal des appuis et le total ne changent pas.
  const history = useMemo(() => groupSessions(tasbih.sessions), [tasbih.sessions]);
  // Libellé « composition · étape » resté après un arrêt brutal pendant une pratique : à l'arrivée sur
  // l'onglet, la séance en cours est enregistrée sous ce libellé puis le tasbih revient sur un dhikr connu.
  const known = useRef({ ids: new Set<string>(), fallback: 'subhanallah' });
  useEffect(() => {
    known.current = { ids: new Set(content.map((c) => c.id)), fallback: approved[0]?.id ?? 'subhanallah' };
  }, [content, approved]);
  const onFocus = useCallback(() => {
    if (!ready) return;
    const k = known.current;
    if (k.ids.size === 0) return;
    setTasbih((x) => (k.ids.has(x.dhikrId) ? x : switchDhikr(closeSession(x, uid('s'), new Date().toISOString()), k.fallback, 33)));
  }, [ready, setTasbih]);
  useFocusEffect(onFocus);
  const ble = useBleCounter();
  const bleOn = ble.status === 'connecté';
  const [scale] = useState(() => new Animated.Value(1));
  const done = tasbih.target > 0 && tasbih.count > 0 && tasbih.count % tasbih.target === 0;

  const { width } = useLayout({ inTabs: true });
  const ring = Math.min(300, Math.max(220, width - 80));
  const progress = tasbih.target > 0 ? (tasbih.count % tasbih.target === 0 && tasbih.count > 0 ? 1 : (tasbih.count % tasbih.target) / tasbih.target) : 0;
  const prev = useRef(tasbih.count);
  useEffect(() => {
    // Vibration de réussite à chaque cycle complété (appui écran, Bluetooth ou clavier)
    if (tasbih.count > prev.current && done) tapHaptic('success');
    prev.current = tasbih.count;
  }, [tasbih.count, done]);

  const tap = () => {
    tapHaptic('light');
    increment();
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 40 }),
    ]).start();
  };
  // Les appuis du compteur Bluetooth / clavier arrivent via DataProvider (aucun double comptage ici).

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow>{tr.tasbih_title}</Eyebrow>
        <BleStatusChip showIdle />
      </Row>
      {current ? (
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <Arabic size={32} style={{ color: t.text, textAlign: 'center' }}>
            {current.arabic}
          </Arabic>
          {current.transliteration ? <Muted>{current.transliteration}</Muted> : null}
        </View>
      ) : null}
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            onPress={tap}
            accessibilityRole="button"
            accessibilityLabel={`${tr.tap_to_count}. ${tasbih.count} / ${tasbih.target || '∞'}`}
            style={{ width: ring, height: ring, borderRadius: ring / 2, alignItems: 'center', justifyContent: 'center' }}
          >
            <ProgressRing size={ring} stroke={10} progress={progress} color={done ? b.gold : t.primary}>
              <View style={{ width: ring - 36, height: ring - 36, borderRadius: (ring - 36) / 2, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border }}>
                <Text style={{ color: t.text, fontSize: ring / 3.6, fontWeight: '200', fontVariant: ['tabular-nums'] }}>{tasbih.count}</Text>
                <Muted>{tasbih.target ? `/ ${tasbih.target}` : '∞'}</Muted>
                <Muted style={{ marginTop: 6, color: done ? t.accent : t.muted, fontWeight: done ? '700' : '400' }}>{done ? tr.cycle_done : tr.tap_to_count}</Muted>
              </View>
            </ProgressRing>
          </Pressable>
        </Animated.View>
      </View>
      <Segmented
        label={tr.target}
        options={[{ label: '33', value: 33 }, { label: '99', value: 99 }, { label: '100', value: 100 }, { label: '∞', value: 0 }]}
        value={tasbih.target}
        onChange={(v) => setTasbih((x) => ({ ...x, target: v }))}
      />
      <Spacer />
      <Row wrap>
        {approved.map((c) => (
          <Chip key={c.id} label={c.transliteration ?? c.arabic} active={c.id === current?.id} onPress={() => setTasbih((x) => switchDhikr(x, c.id, c.defaultCount && c.defaultCount > 1 ? c.defaultCount : x.target))} />
        ))}
      </Row>
      <Spacer />
      <Button title={tr.my_zikrs} icon="albums-outline" variant="secondary" onPress={() => router.push('/zikrs')} />
      <Spacer h={8} />
      <Row>
        <Button title={tr.save_session} icon="bookmark-outline" onPress={saveSession} disabled={tasbih.count === 0} style={{ flex: 1 }} />
        <Button title={tr.reset} icon="refresh" variant="ghost" onPress={() => setTasbih(resetCount)} disabled={tasbih.count === 0} />
      </Row>
      <Spacer h={20} />
      <H2>{tr.history}</H2>
      <Muted>Total : {tasbih.total}</Muted>
      <Spacer h={8} />
      {history.length === 0 ? (
        <Muted>{tr.no_history}</Muted>
      ) : (
        history.slice(0, 20).map((s) => {
          const c = content.find((x) => x.id === s.dhikrId);
          const end = new Date(s.at).toLocaleString('fr-CH');
          const start = s.start && s.start !== s.at ? new Date(s.start).toLocaleString('fr-CH') : null;
          const when = start ? (start.slice(0, 10) === end.slice(0, 10) ? `${start} – ${end.slice(-8)}` : `${start} – ${end}`) : end;
          return (
            <Card key={s.id} style={{ marginBottom: 8, paddingVertical: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: t.text, fontWeight: '600' }}>{c?.transliteration ?? s.dhikrId}</Text>
                <Text style={{ color: t.primary, fontWeight: '700' }}>{s.count}</Text>
              </Row>
              <Muted>
                {when}
                {s.source && s.source !== 'manuel' ? ` · ${s.source === 'bluetooth' ? L('compteur Bluetooth') : L('mixte ({n} via compteur)', { n: s.deviceCount ?? 0 })}` : ''}
                {(s.parts ?? 1) > 1 ? ` · ${L('{n} enregistrements regroupés', { n: s.parts ?? 1 })}` : ''}
              </Muted>
            </Card>
          );
        })
      )}
      <Spacer />
      <Button title={bleOn ? `${tr.ring} : ${L('connecté')}` : tr.ring} variant="ghost" icon="bluetooth-outline" onPress={() => router.push('/ring')} />
    </Screen>
  );
}
