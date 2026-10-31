import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { BEScreen, Panel, softHaptic } from '@/components/bien-etre/common';
import { dayKey } from '@/lib/dates';
import { deckSummary, dueQueue, record, type Deck } from '@/lib/learn-games';
import { NAMES, NAMES_REF } from '@/lib/names';
import { usePersistentState } from '@/lib/storage';
import type { Grade } from '@/lib/srs';
import { arLang } from '@/ui/ar-lang';
import { FadeIn } from '@/ui/ds';
import { Badge, Button } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { L, useUiLang } from '@/lib/l10n';

const KEYS = NAMES.map((x) => `name:${x.n}`);

/** Cartes des 99 Noms : rappel actif (on cherche le sens avant de retourner), puis auto-évaluation SM-2. */
export default function Noms() {
  const lang = useUiLang();
  const [deck, setDeck] = usePersistentState<Deck>('be-names-deck', {});
  const [flip, setFlip] = useState(false);
  const [extra, setExtra] = useState(0);
  const today = dayKey();
  const queue = useMemo(() => dueQueue(deck, KEYS, today, 5 + extra), [deck, today, extra]);
  const sum = deckSummary(deck, KEYS, today);
  const key = queue[0];
  const nm = key ? NAMES[Number(key.slice(5)) - 1] : null;
  const grade = (g: Grade) => {
    if (!key) return;
    softHaptic(g === 'easy' ? 'success' : 'light');
    setDeck((d) => record(d, key, g, today));
    setFlip(false);
  };
  const en = useNamesEn(lang === 'en');
  const meaning = nm ? (lang === 'en' ? en?.[nm.n - 1] ?? nm.fr : nm.fr) : '';

  return (
    <BEScreen title="Cartes des 99 Noms" sub="Lisez le Nom, cherchez son sens de mémoire, puis retournez la carte.">
      {nm ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={flip ? `${nm.tr}. ${meaning}` : L('Nom n° {n}, touchez pour retourner', { n: nm.n })}
          onPress={() => {
            softHaptic('select');
            setFlip((f) => !f);
          }}
          style={({ pressed }) => ({ minHeight: 260, borderRadius: 28, borderWidth: 1, borderColor: b.line, backgroundColor: b.paper, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8, transform: [{ scale: pressed ? 0.99 : 1 }] })}
        >
          <Text style={{ color: b.inkMuted, fontSize: 12, fontWeight: '800' }}>{L('Nom n° {n}', { n: nm.n })}</Text>
          <Arabic size={44} style={{ textAlign: 'center', lineHeight: 84 }}>
            <Text {...arLang}>{nm.ar}</Text>
          </Arabic>
          {flip ? (
            <FadeIn style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ color: b.ink, fontSize: 20, fontWeight: '900' }}>{nm.tr}</Text>
              {lang === 'ar' ? null : <Text style={{ color: b.ink, fontSize: 16, textAlign: 'center' }}>{meaning}</Text>}
              <Badge tone="warning" label={L('Sens à relire')} />
            </FadeIn>
          ) : (
            <Text style={{ color: b.inkMuted }}>Touchez pour retourner</Text>
          )}
        </Pressable>
      ) : (
        <Panel tint={b.green}>
          <Text style={{ color: b.ink, fontWeight: '900' }}>Rien à revoir aujourd’hui.</Text>
          {sum.seen < KEYS.length ? <Button variant="secondary" title="Ajouter 5 nouveaux Noms" onPress={() => setExtra((e) => e + 5)} /> : null}
        </Panel>
      )}
      {nm && flip ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} variant="secondary" title="À revoir" onPress={() => grade('hard')} />
          <Button style={{ flex: 1 }} variant="secondary" title="Hésitant" onPress={() => grade('medium')} />
          <Button style={{ flex: 1 }} title="Je savais" onPress={() => grade('easy')} />
        </View>
      ) : null}
      <Text style={{ color: b.inkMuted, fontSize: 12 }}>{L('Progression privée : {s} Nom(s) vus sur 99, {d} à revoir, {m} bien ancré(s).', { s: sum.seen, d: sum.due, m: sum.solid })}</Text>
      <Text style={{ color: b.inkMuted, fontSize: 12, lineHeight: 18 }}>{L('Les sens affichés sont une traduction Zikru, sans source par sens : à relire par un savant.')}</Text>
      <Text style={{ color: b.inkMuted, fontSize: 12, lineHeight: 18 }}>{NAMES_REF}</Text>
    </BEScreen>
  );
}

/** Sens anglais des Noms, chargés à la demande (partagés avec l’écran des 99 Noms sans alourdir le chargement initial). */
function useNamesEn(on: boolean): string[] | null {
  const [v, setV] = useState<string[] | null>(null);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    void import('@/lib/i18n-content/names').then((m) => alive && setV(m.NAMES_EN));
    return () => {
      alive = false;
    };
  }, [on]);
  return v;
}
