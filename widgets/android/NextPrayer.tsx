import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { NextPrayerProps } from '../../src/lib/widget-data';

/**
 * Android : pas de chronologie ni de minuterie système dans les widgets — on affiche l’heure
 * de la prochaine prière (jamais un compte à rebours figé qui deviendrait faux).
 */
const NextPrayer = (p: NextPrayerProps, env: WidgetEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const bg = dark ? '#0F3D30' : '#F6F3EA';
  const fg = dark ? '#F6F3EA' : '#0F3D30';
  const accent = dark ? '#3DBE8B' : '#0E6B4F';
  const has = !!p && p.at > 0;
  return (
    <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[fillMaxSize(), background(bg), cornerRadius(20), paddingAll(14)]}>
      <Text color={accent} style={{ fontSize: 12, fontWeight: '600' }}>{has ? p.title : 'Zikru'}</Text>
      <Text color={fg} maxLines={1} style={{ fontSize: 22, fontWeight: 'bold' }}>{has ? p.name : '–'}</Text>
      <Text color={fg} style={{ fontSize: 18, fontWeight: '600' }}>{has ? p.time : ''}</Text>
      <Text color={fg} maxLines={1} style={{ fontSize: 11 }}>{has ? p.place : ''}</Text>
    </Column>
  );
};

export default createWidget<NextPrayerProps>('NextPrayer', NextPrayer);
