import { Column, LinearProgressIndicator, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { TasbihProps } from '../../src/lib/widget-data';

const Tasbih = (p: TasbihProps, env: WidgetEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const bg = dark ? '#0F3D30' : '#F6F3EA';
  const fg = dark ? '#F6F3EA' : '#0F3D30';
  const accent = dark ? '#3DBE8B' : '#0E6B4F';
  const count = p && p.count > 0 ? p.count : 0;
  const target = p && p.target > 0 ? p.target : 0;
  const ratio = target > 0 ? Math.min(1, (count % target === 0 && count > 0 ? target : count % target) / target) : 0;
  return (
    <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[fillMaxSize(), background(bg), cornerRadius(20), paddingAll(14)]}>
      <Text color={accent} style={{ fontSize: 12, fontWeight: '600' }}>{p?.title ?? 'Tasbih'}</Text>
      <Text color={fg} maxLines={1} style={{ fontSize: 13 }}>{p?.dhikr ?? ''}</Text>
      <Text color={fg} style={{ fontSize: 30, fontWeight: 'bold' }}>{target ? `${count} / ${target}` : String(count)}</Text>
      {target ? <LinearProgressIndicator progress={ratio} color={accent} modifiers={[fillMaxWidth()]} /> : null}
    </Column>
  );
};

export default createWidget<TasbihProps>('Tasbih', Tasbih);
