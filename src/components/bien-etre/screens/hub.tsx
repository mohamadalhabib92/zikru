import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { BEScreen, softHaptic } from '@/components/bien-etre/common';
import { Ionicons, type IconName } from '@/ui/kit';
import { alpha, brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

type Item = { icon: IconName; title: string; sub: string; href: Href; color: string };

/** Module « bien-être » : un geste pour commencer, progression privée, sans score public. */
export default function BienEtre() {
  const router = useRouter();
  const items: Item[] = [
    { icon: 'leaf-outline', title: 'Respirer', sub: 'Cohérence 6/min · carrée 4-4-4-4 · dhikr au souffle', href: '/bien-etre?s=respiration', color: b.teal },
    { icon: 'moon-outline', title: 'Tafakkur & murāqaba', sub: 'Contempler un verset, 3 à 10 min', href: '/bien-etre?s=meditation', color: b.indigo },
    { icon: 'extension-puzzle-outline', title: 'Jeux du Coran', sub: 'Ordre des mots · mot manquant · suite du verset', href: '/bien-etre?s=jeux', color: b.green },
    { icon: 'sparkles-outline', title: 'Cartes des 99 Noms', sub: 'Rappel actif avec répétition espacée', href: '/bien-etre?s=noms', color: b.goldDeep },
    { icon: 'heart-outline', title: 'Gratitude', sub: 'Trois bienfaits du soir · privé, sans série', href: '/bien-etre?s=gratitude', color: b.goldDeep },
    { icon: 'color-palette-outline', title: 'Tajwid', sub: 'Leçons par règle · quiz', href: '/bien-etre?s=tajwid', color: b.rust },
  ];
  return (
    <BEScreen title="Bien-être" sub="Des pauses courtes pour souffler, contempler et apprendre. Votre progression reste sur cet appareil.">
      <View style={{ gap: 10 }}>
        {items.map((x) => (
          <Pressable
            key={x.title}
            accessibilityRole="button"
            accessibilityLabel={L(x.title) + ', ' + L(x.sub)}
            onPress={() => {
              softHaptic('light');
              router.push(x.href);
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, padding: 14, borderRadius: 20, backgroundColor: b.paper, borderWidth: 1, borderColor: b.line, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(x.color, 0.14) }}>
              <Ionicons name={x.icon} size={24} color={x.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: b.ink, fontWeight: '900', fontSize: 16 }}>{x.title}</Text>
              <Text style={{ color: b.inkMuted, fontSize: 13, marginTop: 2 }}>{x.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={b.inkMuted} />
          </Pressable>
        ))}
      </View>
      <Text style={{ color: b.inkMuted, fontSize: 12, lineHeight: 18 }}>Ces exercices accompagnent la pratique ; ils ne remplacent ni un avis médical, ni un enseignant.</Text>
    </BEScreen>
  );
}
