import { BleStatusChip } from '@/components/BleStatusChip';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { approvedOnly } from '@/lib/content';
import { useData } from '@/lib/data';
import { useBleCounter } from '@/lib/ble/manager';
import { useSettings } from '@/lib/settings';
import { Button, Card, Chip, Eyebrow, H2, Muted, Row, Screen, Segmented, Spacer } from '@/ui/kit';
import { ProgressRing, tapHaptic, useLayout } from '@/ui/ds';
import { Arabic } from '@/ui/light';
import { brand as b, theme as t } from '@/ui/theme';

export default function TasbihScreen() {
  const { t: tr } = useSettings();
  const { tasbih, setTasbih, increment, saveSession, content } = useData();
  const router = useRouter();
  const approved = approvedOnly(content);
  const current = approved.find((c) => c.id === tasbih.dhikrId) ?? approved[0];
  const ble = useBleCounter();
  const bleOn = ble.status === 'connecté';
  const [scale] = useState(() => new Animated.Value(1));
  const done = tasbih.target > 0 && tasbih.count > 0 && tasbih.count % tasbih.target === 0;

  const { width } = useLayout();
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
          <Chip key={c.id} label={c.transliteration ?? c.arabic} active={c.id === current?.id} onPress={() => setTasbih((x) => ({ ...x, dhikrId: c.id, target: c.defaultCount && c.defaultCount > 1 ? c.defaultCount : x.target }))} />
        ))}
      </Row>
      <Spacer />
      <Button title={tr.my_zikrs} icon="albums-outline" variant="secondary" onPress={() => router.push('/zikrs')} />
      <Spacer h={8} />
      <Row>
        <Button title={tr.save_session} icon="bookmark-outline" onPress={saveSession} disabled={tasbih.count === 0} style={{ flex: 1 }} />
        <Button title={tr.reset} icon="refresh" variant="ghost" onPress={() => setTasbih((x) => ({ ...x, count: 0, deviceCount: 0 }))} disabled={tasbih.count === 0} />
      </Row>
      <Spacer h={20} />
      <H2>{tr.history}</H2>
      <Muted>Total : {tasbih.total}</Muted>
      <Spacer h={8} />
      {tasbih.sessions.length === 0 ? (
        <Muted>{tr.no_history}</Muted>
      ) : (
        tasbih.sessions.slice(0, 20).map((s) => {
          const c = content.find((x) => x.id === s.dhikrId);
          return (
            <Card key={s.id} style={{ marginBottom: 8, paddingVertical: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: t.text, fontWeight: '600' }}>{c?.transliteration ?? s.dhikrId}</Text>
                <Text style={{ color: t.primary, fontWeight: '700' }}>{s.count}</Text>
              </Row>
              <Muted>
                {new Date(s.at).toLocaleString('fr-CH')}
                {s.source && s.source !== 'manuel' ? ` · ${s.source === 'bluetooth' ? 'compteur Bluetooth' : `mixte (${s.deviceCount ?? 0} via compteur)`}` : ''}
              </Muted>
            </Card>
          );
        })
      )}
      <Spacer />
      <Button title={bleOn ? `${tr.ring} : connecté` : tr.ring} variant="ghost" icon="bluetooth-outline" onPress={() => router.push('/ring')} />
    </Screen>
  );
}
