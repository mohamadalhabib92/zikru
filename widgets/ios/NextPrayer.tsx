import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, containerBackground, font, foregroundStyle, lineLimit, minimumScaleFactor, monospacedDigit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { NextPrayerProps } from '../../src/lib/widget-data';

/** Prochaine prière + compte à rebours système (écran d’accueil et écran verrouillé). Aucune donnée réseau. */
const NextPrayer = (p: NextPrayerProps, env: WidgetEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const bg = dark ? '#0F3D30' : '#F6F3EA';
  const fg = dark ? '#F6F3EA' : '#0F3D30';
  const accent = dark ? '#3DBE8B' : '#0E6B4F';
  const gold = '#D9B65C';
  const has = !!p && p.at > 0;
  const range = { lower: new Date(has ? p.from : Date.now()), upper: new Date(has ? p.at : Date.now()) };
  const label = has ? `${p.title} : ${p.name}, ${p.time}` : 'Zikru';
  const fam = env.widgetFamily;
  if (fam === 'accessoryInline') {
    return <Text modifiers={[widgetURL('zikru:///prayers'), accessibilityLabel(label)]}>{has ? `${p.name} ${p.time}` : 'Zikru'}</Text>;
  }
  if (fam === 'accessoryCircular') {
    return (
      <VStack spacing={0} modifiers={[widgetURL('zikru:///prayers'), accessibilityLabel(label)]}>
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), lineLimit(1), minimumScaleFactor(0.6)]}>{has ? p.name : 'Zikru'}</Text>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), monospacedDigit()]}>{has ? p.time : '–'}</Text>
      </VStack>
    );
  }
  if (fam === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL('zikru:///prayers'), accessibilityLabel(label)]}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{has ? `${p.name} · ${p.time}` : 'Zikru'}</Text>
        {has ? <Text timerInterval={range} countsDown modifiers={[font({ size: 15, weight: 'bold' }), monospacedDigit()]} /> : null}
        <Text modifiers={[font({ size: 11 }), lineLimit(1)]}>{has ? p.place : ''}</Text>
      </VStack>
    );
  }
  const big = fam === 'systemMedium';
  return (
    <VStack alignment="leading" spacing={4} modifiers={[padding({ all: big ? 4 : 2 }), containerBackground(bg, 'widget'), widgetURL('zikru:///prayers'), accessibilityLabel(label)]}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent), lineLimit(1)]}>{has ? p.title : 'Zikru'}</Text>
      <HStack spacing={6}>
        <Text modifiers={[font({ size: big ? 26 : 22, weight: 'bold' }), foregroundStyle(fg), lineLimit(1), minimumScaleFactor(0.7)]}>{has ? p.name : '–'}</Text>
        {big && has ? <Spacer /> : null}
        {big && has ? <Text modifiers={[font({ size: 20, design: 'serif' }), foregroundStyle(gold)]}>{p.nameAr}</Text> : null}
      </HStack>
      <Text modifiers={[font({ size: big ? 20 : 17, weight: 'semibold' }), foregroundStyle(fg), monospacedDigit()]}>{has ? p.time : ''}</Text>
      {has ? <Text timerInterval={range} countsDown modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle(accent), monospacedDigit()]} /> : null}
      <Spacer />
      <Text modifiers={[font({ size: 11 }), foregroundStyle(fg), lineLimit(1)]}>{has ? p.place : ''}</Text>
    </VStack>
  );
};

export default createWidget<NextPrayerProps>('NextPrayer', NextPrayer);
