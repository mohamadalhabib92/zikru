import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { L } from '@/lib/l10n';
import { Ionicons } from '@/ui/kit';
import { LCard, LMuted } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { View } from 'react-native';

/** Lien vers les objectifs du jour (planificateur, parcours). */
export function GoalsLink() {
  const router = useRouter();
  return (
    <LCard onPress={() => router.push('/goals')} label={L('Objectifs du jour')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <Ionicons name="flag" size={22} color={b.green} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: b.ink, fontWeight: '900' }}>{L('Objectifs du jour')}</Text>
          <LMuted>{L('Prières, wird, Coran, tasbih · série douce, privée')}</LMuted>
        </View>
        <Ionicons name="chevron-forward" size={18} color={b.brownSoft} />
      </View>
    </LCard>
  );
}
