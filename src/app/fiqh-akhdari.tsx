import { useRouter } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import raw from '../../assets/fiqh/akhdari.json';
import { akhdariChapters, AKHDARI_AUTHOR, type AkhdariItem } from '@/lib/akhdari-view';
import { Screen } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

const ITEMS = raw as AkhdariItem[];
const CHAPTERS = akhdariChapters(ITEMS);
const NOTE_AR = ITEMS.find((x) => x.kind === 'edition-note-ar')?.text;
const NOTE_FR = ITEMS.find((x) => x.kind === 'edition-note-fr')?.text;

export default function AkhdariChapters() {
  const router = useRouter();
  return (
    <Screen padded={false} bg={b.cream}>
      <FlatList
        data={CHAPTERS}
        keyExtractor={(c) => c.title}
        initialNumToRender={8}
        windowSize={5}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: b.ink, fontSize: 22, fontWeight: '900' }}>{L('Matn d’al-Akhdarī')}</Text>
            <Text style={{ color: b.brown, fontWeight: '800', marginTop: 4 }}>{L(AKHDARI_AUTHOR)}</Text>
            <Text style={{ color: b.inkMuted, marginTop: 2 }}>{L('École malikite')}</Text>
            <Text style={{ alignSelf: 'flex-start', marginTop: 8, fontSize: 12, fontWeight: '800', color: b.brown, backgroundColor: b.goldSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
              {L('à vérifier — relecture par un savant requise avant publication')}
            </Text>
            {NOTE_AR ? <Arabic size={20} style={{ color: b.ink, textAlign: 'right', marginTop: 12 }}>{NOTE_AR}</Arabic> : null}
            {NOTE_FR ? <Text style={{ color: b.ink, marginTop: 8, lineHeight: 21 }}>{NOTE_FR}</Text> : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/fiqh-akhdari-read', params: { i: String(index) } })}
            style={{ backgroundColor: b.paper, borderRadius: 16, borderWidth: 1, borderColor: b.line, padding: 14, marginBottom: 10 }}
          >
            <Arabic size={22} style={{ color: b.ink, textAlign: 'right' }}>{item.title}</Arabic>
            {item.subs.map((s) => (
              <Arabic key={s.title} size={16} style={{ color: b.inkMuted, textAlign: 'right', marginTop: 4 }}>{s.title}</Arabic>
            ))}
          </Pressable>
        )}
      />
    </Screen>
  );
}
