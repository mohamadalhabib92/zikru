import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { approvedOnly } from '@/lib/content';
import { useData } from '@/lib/data';
import { ring } from '@/lib/ring';
import { useSettings } from '@/lib/settings';
import { Badge, Button, Card, Chip, Eyebrow, H2, Muted, Row, Screen, Segmented, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

export default function TasbihScreen() {
  const { t: tr } = useSettings();
  const { tasbih, setTasbih, increment, saveSession, content } = useData();
  const router = useRouter();
  const approved = approvedOnly(content);
  const current = approved.find((c) => c.id === tasbih.dhikrId) ?? approved[0];
  const scale = useRef(new Animated.Value(1)).current;
  const done = tasbih.target > 0 && tasbih.count > 0 && tasbih.count % tasbih.target === 0;

  const tap = () => {
    increment();
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 40 }),
    ]).start();
    if (Platform.OS !== 'web') {
      const next = tasbih.count + 1;
      void (tasbih.target > 0 && next % tasbih.target === 0 ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync()).catch(() => {});
    }
  };
  // Appui anneau (simulation) → +1
  const tapRef = useRef(tap);
  tapRef.current = tap;
  useEffect(() => ring.subscribe((e) => e.type === 'tap' && tapRef.current()), []);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow>{tr.tasbih_title}</Eyebrow>
        {ring.isConnected ? <Badge label={`${tr.ring} · ${tr.simulation}`} tone="warning" /> : null}
      </Row>
      {current ? (
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <Text style={{ color: t.text, fontSize: 34, writingDirection: 'rtl', textAlign: 'center' }}>{current.arabic}</Text>
          {current.transliteration ? <Muted>{current.transliteration}</Muted> : null}
        </View>
      ) : null}
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            onPress={tap}
            accessibilityRole="button"
            accessibilityLabel={`${tr.tap_to_count}. ${tasbih.count} / ${tasbih.target || '∞'}`}
            style={{ width: 240, height: 240, borderRadius: 120, backgroundColor: t.surface, borderWidth: 3, borderColor: done ? t.success : t.primary, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: t.text, fontSize: 64, fontWeight: '200', fontVariant: ['tabular-nums'] }}>{tasbih.count}</Text>
            <Muted>{tasbih.target ? `/ ${tasbih.target}` : '∞'}</Muted>
            <Muted style={{ marginTop: 6 }}>{done ? tr.cycle_done : tr.tap_to_count}</Muted>
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
      <Row>
        <Button title={tr.save_session} icon="bookmark-outline" onPress={saveSession} disabled={tasbih.count === 0} style={{ flex: 1 }} />
        <Button title={tr.reset} icon="refresh" variant="ghost" onPress={() => setTasbih((x) => ({ ...x, count: 0 }))} disabled={tasbih.count === 0} />
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
              <Muted>{new Date(s.at).toLocaleString('fr-CH')}</Muted>
            </Card>
          );
        })
      )}
      <Spacer />
      <Button title={`${tr.ring} (${tr.simulation})`} variant="ghost" icon="radio-outline" onPress={() => router.push('/ring')} />
    </Screen>
  );
}
