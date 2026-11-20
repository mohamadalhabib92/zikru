import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, lineLimit, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { PrayerActivityProps } from '../../src/lib/widget-data';

/** Activité en direct / Dynamic Island : prochaine prière (opt-in), ou suhur/iftar pendant Ramadan (opt-in). */
const PrayerActivity = (p: PrayerActivityProps, env: LiveActivityEnvironment) => {
  'widget';
  const accent = env.isLuminanceReduced ? '#FFFFFF' : '#3DBE8B';
  const gold = '#D9B65C';
  const icon = p.kind === 'iftar' ? 'sunset.fill' : p.kind === 'suhur' ? 'moon.stars.fill' : 'clock.fill';
  const range = { lower: new Date(p.from), upper: new Date(p.at) };
  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 14 })]}>
        <Image systemName={icon} color={gold} />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent)]}>{p.title}</Text>
          <Text modifiers={[font({ size: 18, weight: 'bold' }), lineLimit(1)]}>{`${p.name} · ${p.time}`}</Text>
          <Text modifiers={[font({ size: 11 }), lineLimit(1)]}>{p.place}</Text>
        </VStack>
        <Spacer />
        <Text timerInterval={range} countsDown modifiers={[font({ size: 22, weight: 'bold' }), monospacedDigit(), foregroundStyle(accent)]} />
      </HStack>
    ),
    compactLeading: <Image systemName={icon} color={gold} />,
    compactTrailing: <Text timerInterval={range} countsDown modifiers={[monospacedDigit(), font({ size: 13 })]} />,
    minimal: <Image systemName={icon} color={gold} />,
    expandedLeading: (
      <VStack alignment="leading" modifiers={[padding({ all: 8 })]}>
        <Image systemName={icon} color={gold} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{p.name}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 18, weight: 'bold' }), monospacedDigit()]}>{p.time}</Text>
        <Text timerInterval={range} countsDown modifiers={[font({ size: 12 }), monospacedDigit(), foregroundStyle(accent)]} />
      </VStack>
    ),
    expandedBottom: <Text modifiers={[font({ size: 11 }), lineLimit(1), padding({ horizontal: 8 })]}>{p.place}</Text>,
  };
};

export default createLiveActivity<PrayerActivityProps>('PrayerActivity', PrayerActivity);
