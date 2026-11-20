import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { DhikrProps } from '../../src/lib/widget-data';

/** Dhikr du jour : uniquement un contenu approuvé ET sourcé ; la source est toujours affichée. */
const DailyDhikr = (p: DhikrProps, env: WidgetEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const bg = dark ? '#0F3D30' : '#F6F3EA';
  const fg = dark ? '#F6F3EA' : '#0F3D30';
  const accent = dark ? '#3DBE8B' : '#0E6B4F';
  const has = !!p && !!p.arabic;
  return (
    <Column verticalArrangement={{ spacedBy: 3 }} modifiers={[fillMaxSize(), background(bg), cornerRadius(20), paddingAll(14)]}>
      <Text color={accent} style={{ fontSize: 12, fontWeight: '600' }}>{p?.title ?? 'Zikru'}</Text>
      {has ? <Text color={fg} maxLines={2} style={{ fontSize: 22, textAlign: 'end' }}>{p.arabic}</Text> : <Text color={fg} style={{ fontSize: 13 }}>{p?.empty ?? ''}</Text>}
      {has && p.translit ? <Text color={fg} maxLines={1} style={{ fontSize: 12 }}>{p.translit}</Text> : null}
      {has && p.meaning ? <Text color={fg} maxLines={2} style={{ fontSize: 12 }}>{p.meaning}</Text> : null}
      {has ? <Text color={fg} maxLines={2} style={{ fontSize: 10 }}>{p.source}</Text> : null}
    </Column>
  );
};

export default createWidget<DhikrProps>('DailyDhikr', DailyDhikr);
