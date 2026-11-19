import { ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, containerBackground, font, foregroundStyle, lineLimit, monospacedDigit, padding, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { TasbihProps } from '../../src/lib/widget-data';

/** Compteur du tasbih (lecture seule) : ouvre le tasbih au toucher. Le compteur durable reste dans l’app. */
const Tasbih = (p: TasbihProps, env: WidgetEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const bg = dark ? '#0F3D30' : '#F6F3EA';
  const fg = dark ? '#F6F3EA' : '#0F3D30';
  const accent = dark ? '#3DBE8B' : '#0E6B4F';
  const count = p && p.count > 0 ? p.count : 0;
  const target = p && p.target > 0 ? p.target : 0;
  const ratio = target > 0 ? Math.min(1, (count % target === 0 && count > 0 ? target : count % target) / target) : 0;
  const label = `${p?.title ?? 'Tasbih'} : ${count}${target ? ` / ${target}` : ''}`;
  if (env.widgetFamily === 'accessoryCircular') {
    return (
      <VStack spacing={0} modifiers={[widgetURL('zikru:///tasbih'), accessibilityLabel(label)]}>
        <Text modifiers={[font({ size: 16, weight: 'bold' }), monospacedDigit()]}>{String(count)}</Text>
        {target ? <Text modifiers={[font({ size: 10 }), monospacedDigit()]}>{`/${target}`}</Text> : null}
      </VStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 2 }), containerBackground(bg, 'widget'), widgetURL('zikru:///tasbih'), accessibilityLabel(label)]}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent)]}>{p?.title ?? 'Tasbih'}</Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(fg), lineLimit(1)]}>{p?.dhikr ?? ''}</Text>
      <Spacer />
      <Text modifiers={[font({ size: 34, weight: 'bold' }), foregroundStyle(fg), monospacedDigit()]}>{String(count)}</Text>
      {target ? <Text modifiers={[font({ size: 12 }), foregroundStyle(fg), monospacedDigit()]}>{`/ ${target}`}</Text> : null}
      {target ? <ProgressView value={ratio} modifiers={[tint(accent)]} /> : null}
    </VStack>
  );
};

export default createWidget<TasbihProps>('Tasbih', Tasbih);
