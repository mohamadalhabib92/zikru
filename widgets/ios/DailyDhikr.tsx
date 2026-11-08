import { Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, containerBackground, font, foregroundStyle, lineLimit, minimumScaleFactor, multilineTextAlignment, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { DhikrProps } from '../../src/lib/widget-data';

/** Dhikr du jour : uniquement un contenu approuvé ET sourcé ; la source est toujours affichée. */
const DailyDhikr = (p: DhikrProps, env: WidgetEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const bg = dark ? '#0F3D30' : '#F6F3EA';
  const fg = dark ? '#F6F3EA' : '#0F3D30';
  const accent = dark ? '#3DBE8B' : '#0E6B4F';
  const gold = '#D9B65C';
  const has = !!p && !!p.arabic;
  const big = env.widgetFamily === 'systemMedium' || env.widgetFamily === 'systemLarge';
  return (
    <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 2 }), containerBackground(bg, 'widget'), widgetURL(has ? p.url : 'zikru:///zikrs'), accessibilityLabel(has ? `${p.title} : ${p.translit}. ${p.source}` : (p?.empty ?? 'Zikru'))]}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent)]}>{p?.title ?? 'Zikru'}</Text>
      {has ? (
        <Text modifiers={[font({ size: big ? 24 : 20, design: 'serif' }), foregroundStyle(dark ? gold : fg), multilineTextAlignment('trailing'), lineLimit(2), minimumScaleFactor(0.6)]}>{p.arabic}</Text>
      ) : (
        <Text modifiers={[font({ size: 13 }), foregroundStyle(fg)]}>{p?.empty ?? ''}</Text>
      )}
      {has && p.translit ? <Text modifiers={[font({ size: 12 }), foregroundStyle(fg), lineLimit(1)]}>{p.translit}</Text> : null}
      {has && big && p.meaning ? <Text modifiers={[font({ size: 12 }), foregroundStyle(fg), lineLimit(2)]}>{p.meaning}</Text> : null}
      <Spacer />
      {has ? <Text modifiers={[font({ size: 10 }), foregroundStyle(fg), lineLimit(big ? 2 : 1), minimumScaleFactor(0.8)]}>{p.source}</Text> : null}
    </VStack>
  );
};

export default createWidget<DhikrProps>('DailyDhikr', DailyDhikr);
