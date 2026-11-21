import { StyleSheet, Text, View } from 'react-native';
import { DUA_CATS, DUAS_LIST, SEED_CONTENT, approvedOnly } from '@/lib/phone';
import { useTv } from '@/lib/settings';
import { Arabic, Muted, Screen, Title, ink } from '@/ui/focus';

export default function Dhikr() {
  const { t } = useTv();
  const items = approvedOnly(SEED_CONTENT);
  return (
    <Screen>
      <Title>{t.dhikr}</Title>
      <Muted>{t.dhikrHint}</Muted>
      {items.length === 0 ? <Muted>{t.empty}</Muted> : null}
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Arabic size={40}>{item.arabic}</Arabic>
          {item.transliteration ? <Text style={styles.tr}>{item.transliteration}</Text> : null}
          <Muted>
            {t.source} : {item.source}
          </Muted>
          {item.seedExample ? <Text style={styles.badge}>{t.exampleBadge}</Text> : null}
        </View>
      ))}
      <Title>{t.duas}</Title>
      <Muted>{t.pending}</Muted>
      {DUA_CATS.map((cat) => {
        const rows = DUAS_LIST.filter((d) => d.cat === cat.id);
        if (!rows.length) return null;
        return (
          <View key={cat.id}>
            <Text style={styles.cat}>{cat.label}</Text>
            {rows.map((d) => (
              <View key={d.id} style={styles.card}>
                <Text style={styles.h}>{d.title}</Text>
                {d.when ? <Muted>{d.when}</Muted> : null}
                <Arabic size={32}>{d.ar}</Arabic>
                {d.tr ? <Text style={styles.tr}>{d.tr}</Text> : null}
                <Text style={styles.fr}>{d.fr}</Text>
                <Muted>
                  {t.source} : {d.ref}
                </Muted>
                {d.note ? <Muted>{d.note}</Muted> : null}
              </View>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: ink.card, borderRadius: 16, padding: 18, marginTop: 14, gap: 6 },
  tr: { color: ink.gold, fontSize: 18, textAlign: 'center' },
  fr: { color: ink.text, fontSize: 20, lineHeight: 30 },
  badge: { color: ink.gold, fontSize: 16, fontWeight: '700' },
  cat: { color: ink.gold, fontSize: 22, fontWeight: '800', marginTop: 28 },
  h: { color: ink.text, fontSize: 22, fontWeight: '700' },
});
