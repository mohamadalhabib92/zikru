import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Hub, type HubSection } from '@/components/Hub';
import { useSettings } from '@/lib/settings';
import { usePersistentState } from '@/lib/storage';
import { SURAHS } from '@/lib/surahs';
import { Ionicons } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { brand as b } from '@/ui/theme';

/** Onglet « Lire » : Coran, invocations, Noms, savoir. */
export default function Read() {
  const { t: tr } = useSettings();
  const router = useRouter();
  const [last] = usePersistentState<{ n: number; ayah: number } | null>('quran-last', null);
  const surah = last ? SURAHS.find((x) => x[0] === last.n) : undefined;
  const sections: HubSection[] = [
    {
      title: 'Coran & invocations',
      items: [
        { icon: 'book', title: 'Le Saint Coran', sub: '114 sourates · traduction Hamidullah', href: '/quran', color: b.green },
        { icon: 'hand-left', title: 'Du‘as prophétiques', sub: 'Matin, soir, voyage, épreuves…', href: '/duas', color: b.blue },
        { icon: 'sparkles', title: 'Les 99 Noms d’Allah', sub: 'Sens, translittération, abjad', href: '/names', color: b.goldDeep },
        { icon: 'albums', title: tr.my_zikrs, sub: 'Composer · pratiquer · abjad', href: '/zikrs', color: b.violet },
        { icon: 'reader', title: 'Adhkar', sub: 'Formules validées avec sources', href: '/dhikr', color: b.teal },
        { icon: 'headset', title: tr.kahf, sub: 'Sourate al-Kahf du vendredi', href: '/kahf', color: b.wirdGreen },
      ],
    },
    {
      title: 'Savoir',
      items: [
        { icon: 'library', title: 'Hadiths', sub: 'Collection choisie et référencée', href: '/hadiths', color: b.indigo },
        { icon: 'scale', title: 'Fiqh', sub: 'Maliki & Shafi‘i', href: '/fiqh', color: b.rust },
        { icon: 'construct', title: tr.sahw, sub: 'Prosternation de l’oubli', href: '/sahw', color: b.rust },
        { icon: 'calculator', title: 'Calculateur abjad', sub: 'Mashriqi & Maghribi', href: '/abjad', color: b.goldDeep },
        { icon: 'leaf', title: 'Tariqa Tijaniyya', sub: 'Wird, wazifa, haylala, adilla', href: '/tijani', color: b.green },
        { icon: 'musical-notes', title: tr.songs, sub: 'Qasa’id et nasheeds', href: '/songs', color: b.purple },
      ],
    },
  ];
  const top = surah ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tr.continue_where} : ${surah[2]}, verset ${last!.ayah}`}
      onPress={() => router.push(`/quran/${surah[0]}`)}
      style={({ pressed }) => ({ marginTop: 14, borderRadius: 20, backgroundColor: b.hero, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: pressed ? 0.92 : 1 })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: b.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }}>{tr.continue_where.toUpperCase()}</Text>
        <Text style={{ color: b.heroText, fontSize: 22, fontWeight: '800' }}>{surah[2]}</Text>
        <Text style={{ color: b.heroMuted }}>
          {surah[3]} · verset {last!.ayah} / {surah[4]}
        </Text>
      </View>
      <Arabic size={28} style={{ color: b.gold }}>
        {surah[1]}
      </Arabic>
      <Ionicons name="play-circle" size={36} color={b.gold} />
    </Pressable>
  ) : null;
  return <Hub title={tr.tab_read} eyebrow="Bibliothèque" sections={sections} top={top} />;
}
