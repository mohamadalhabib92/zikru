import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { BEScreen, Choice, Panel, softHaptic, useUthmani } from '@/components/bien-etre/common';
import { dayKey } from '@/lib/dates';
import { clozePuzzle, continuePuzzle, deckSummary, dueQueue, gradeOf, levelUp, OPTIONS, orderPuzzle, orderStepOk, record, rng, versesForLevel, type Deck, type GameLevel } from '@/lib/learn-games';
import { gIndex } from '@/lib/quran-nav';
import { usePersistentState } from '@/lib/storage';
import { SURAHS } from '@/lib/surahs';
import { arLang } from '@/ui/ar-lang';
import { FadeIn } from '@/ui/ds';
import { Button, IconButton } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { alpha, brand as b, fonts } from '@/ui/theme';
import { L } from '@/lib/l10n';

type Game = 'order' | 'cloze' | 'continue';
type Prefs = { game: Game; surah: number; level: Record<Game, GameLevel>; streak: Record<Game, number> };
const PREFS: Prefs = { game: 'order', surah: 1, level: { order: 0, cloze: 0, continue: 0 }, streak: { order: 0, cloze: 0, continue: 0 } };
const LEVEL_LABEL = ['Palier 1 · versets courts', 'Palier 2 · versets moyens', 'Palier 3 · tous les versets'];

/** Jeux du Coran : ordre des mots, mot manquant, suite du verset — rappel actif + répétition espacée (SM-2). */
export default function Jeux() {
  const uth = useUthmani();
  const [prefs, setPrefs] = usePersistentState<Prefs>('be-games', PREFS);
  const [deck, setDeck] = usePersistentState<Deck>('be-games-deck', {});
  const [round, setRound] = useState(0);
  const [free, setFree] = useState(false);
  const today = dayKey();
  const { game, surah } = prefs;
  const level = prefs.level[game] ?? 0;
  const n = SURAHS[surah - 1][4] as number;
  const verses = useMemo(() => (uth ? Array.from({ length: n }, (_, i) => uth[gIndex(surah, i + 1)]) : []), [uth, surah, n]);
  const eligible = useMemo(() => versesForLevel(verses, level), [verses, level]);
  const keys = useMemo(() => eligible.map((x) => `${game}:${surah}:${x.i + 1}`), [eligible, game, surah]);
  const queue = useMemo(() => dueQueue(deck, keys, today, 5), [deck, keys, today]);
  const sum = deckSummary(deck, keys, today);
  const current = useMemo(() => {
    const k = queue[0] ?? (free && keys.length ? keys[(round * 7) % keys.length] : undefined);
    if (!k) return null;
    const a = Number(k.split(':')[2]);
    return { key: k, a, v: verses[a - 1] };
  }, [queue, free, keys, round, verses]);

  const setSurah = (s: number) => {
    setFree(false);
    setPrefs((x) => ({ ...x, surah: Math.min(114, Math.max(1, s)) }));
  };
  const finish = (mistakes: number, revealed: boolean) => {
    if (!current) return;
    const g = gradeOf(mistakes, revealed);
    if (!free || !deck[current.key] || queue.includes(current.key)) setDeck((d) => record(d, current.key, g, today));
    setPrefs((x) => ({ ...x, streak: { ...x.streak, [game]: g === 'easy' ? (x.streak[game] ?? 0) + 1 : 0 } }));
  };
  const next = () => setRound((r) => r + 1);
  const offerUp = levelUp(prefs.streak[game] ?? 0, level) !== level;

  return (
    <BEScreen title="Jeux du Coran" sub="Retrouvez le texte de mémoire. Les versets reviennent selon la répétition espacée, comme pour la mémorisation.">
      <Choice
        label="Jeu"
        value={game}
        onChange={(g) => setPrefs((x) => ({ ...x, game: g }))}
        options={[
          { label: 'Ordre des mots', value: 'order' as const },
          { label: 'Mot manquant', value: 'cloze' as const },
          { label: 'Suite du verset', value: 'continue' as const },
        ]}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: b.paper, borderRadius: 18, borderWidth: 1, borderColor: b.line, paddingHorizontal: 6 }}>
        <IconButton icon="chevron-back" label="Sourate précédente" onPress={() => setSurah(surah - 1)} />
        <View style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ color: b.ink, fontWeight: '900' }}>{`${surah}. ${SURAHS[surah - 1][2]}`}</Text>
          <Text style={{ color: b.inkMuted, fontSize: 12 }}>{L(LEVEL_LABEL[level])}</Text>
        </View>
        <IconButton icon="chevron-forward" label="Sourate suivante" onPress={() => setSurah(surah + 1)} />
      </View>

      {!uth ? (
        <Text style={{ color: b.inkMuted }}>Chargement</Text>
      ) : current ? (
        <Puzzle key={`${current.key}:${round}`} game={game} verse={current.v} pool={verses} seed={(surah * 1000 + current.a) * 31 + round} options={OPTIONS[level]} refLabel={L('{s}, verset {a}', { s: SURAHS[surah - 1][2], a: current.a })} onFinish={finish} onNext={next} />
      ) : (
        <Panel tint={b.green}>
          <Text style={{ color: b.ink, fontWeight: '900' }}>{eligible.length ? 'Rien à revoir aujourd’hui pour cette sourate.' : 'Pas de verset à ce palier dans cette sourate.'}</Text>
          {eligible.length ? <Button variant="secondary" title="Continuer en entraînement libre" onPress={() => { setFree(true); next(); }} /> : null}
        </Panel>
      )}

      {offerUp ? (
        <Panel tint={b.goldDeep}>
          <Text style={{ color: b.ink, fontWeight: '800' }}>Huit réussites d’affilée. Passer au palier suivant ?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small title="Oui" onPress={() => setPrefs((x) => ({ ...x, level: { ...x.level, [game]: levelUp(8, level) }, streak: { ...x.streak, [game]: 0 } }))} />
            <Button small variant="ghost" title="Plus tard" onPress={() => setPrefs((x) => ({ ...x, streak: { ...x.streak, [game]: 0 } }))} />
          </View>
        </Panel>
      ) : null}
      <Choice label="Palier" value={level} onChange={(l) => setPrefs((x) => ({ ...x, level: { ...x.level, [game]: l } }))} options={[0, 1, 2].map((l) => ({ label: L('Palier {n}', { n: l + 1 }), value: l as GameLevel }))} color={b.teal} />
      <Text style={{ color: b.inkMuted, fontSize: 12 }}>{L('Progression privée : {s} verset(s) vus sur {t}, {d} à revoir, {m} bien ancré(s).', { s: sum.seen, t: sum.total, d: sum.due, m: sum.solid })}</Text>
    </BEScreen>
  );
}

function WordChip({ w, onPress, state }: { w: string; onPress?: () => void; state?: 'wrong' | 'ok' }) {
  const c = state === 'wrong' ? b.rust : state === 'ok' ? b.green : b.line;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={w} {...arLang} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, minWidth: 48, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 16, borderWidth: state ? 2 : 1, borderColor: c, backgroundColor: state === 'wrong' ? alpha(b.rust, 0.1) : b.paper, justifyContent: 'center', transform: [{ scale: pressed ? 0.96 : 1 }] })}>
      <Text maxFontSizeMultiplier={1.5} style={{ fontFamily: fonts.quran, fontSize: 24, lineHeight: 44, color: b.ink, writingDirection: 'rtl', textAlign: 'center' }}>{w}</Text>
    </Pressable>
  );
}

function Puzzle({ game, verse, pool, seed, options, refLabel, onFinish, onNext }: { game: Game; verse: string; pool: string[]; seed: number; options: number; refLabel: string; onFinish: (mistakes: number, revealed: boolean) => void; onNext: () => void }) {
  const r = useMemo(() => rng(seed), [seed]);
  const P = useMemo(() => {
    if (game === 'order') return { kind: 'order' as const, p: orderPuzzle(verse, r) };
    if (game === 'cloze') {
      const c = clozePuzzle(verse, pool, r, options);
      return c ? { kind: 'cloze' as const, p: c } : { kind: 'order' as const, p: orderPuzzle(verse, r) };
    }
    const c = continuePuzzle(verse, pool, r, options - 1);
    return c ? { kind: 'continue' as const, p: c } : { kind: 'order' as const, p: orderPuzzle(verse, r) };
  }, [game, verse, pool, r, options]);
  const [picked, setPicked] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | string | null>(null);
  const [solved, setSolved] = useState<null | 'ok' | 'revealed'>(null);
  const win = (rev: boolean) => {
    setSolved(rev ? 'revealed' : 'ok');
    softHaptic(rev ? 'light' : 'success');
    onFinish(mistakes, rev);
  };
  const miss = (id: number | string) => {
    setWrong(id);
    setMistakes((m) => m + 1);
    softHaptic('medium');
    setTimeout(() => setWrong((w) => (w === id ? null : w)), 600);
  };

  let body;
  if (P.kind === 'order') {
    const p = P.p;
    const built = picked.map((i) => p.shuffled[i]);
    body = (
      <>
        <Text style={{ color: b.inkMuted, fontSize: 13 }}>Touchez les mots dans l’ordre du verset.</Text>
        <View style={{ minHeight: 60, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: b.line, padding: 10, justifyContent: 'center' }}>
          <Arabic quran size={24} style={{ textAlign: 'center' }}>
            <Text {...arLang}>{solved ? verse : built.join(' ') || ' '}</Text>
          </Arabic>
        </View>
        {!solved ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {p.shuffled.map((w, i) =>
              picked.includes(i) ? null : (
                <WordChip
                  key={i}
                  w={w}
                  state={wrong === i ? 'wrong' : undefined}
                  onPress={() => {
                    if (orderStepOk(p, built, w)) {
                      softHaptic('select');
                      const np = [...picked, i];
                      setPicked(np);
                      if (np.length === p.words.length) win(false);
                    } else miss(i);
                  }}
                />
              ),
            )}
          </View>
        ) : null}
      </>
    );
  } else if (P.kind === 'cloze') {
    const p = P.p;
    body = (
      <>
        <Text style={{ color: b.inkMuted, fontSize: 13 }}>Quel mot manque ?</Text>
        <Arabic quran size={24} style={{ textAlign: 'center' }}>
          <Text {...arLang}>{solved ? verse : [...p.before, '…', ...p.after].join(' ')}</Text>
        </Arabic>
        {!solved ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {p.options.map((o) => (
              <WordChip key={o} w={o} state={wrong === o ? 'wrong' : undefined} onPress={() => (o === p.answer ? win(false) : miss(o))} />
            ))}
          </View>
        ) : null}
      </>
    );
  } else {
    const p = P.p;
    body = (
      <>
        <Text style={{ color: b.inkMuted, fontSize: 13 }}>Comment le verset continue-t-il ?</Text>
        <Arabic quran size={24} style={{ textAlign: 'center' }}>
          <Text {...arLang}>{solved ? verse : p.start + ' …'}</Text>
        </Arabic>
        {!solved ? (
          <View style={{ gap: 8 }}>
            {p.options.map((o) => (
              <WordChip key={o} w={o} state={wrong === o ? 'wrong' : undefined} onPress={() => (o === p.answer ? win(false) : miss(o))} />
            ))}
          </View>
        ) : null}
      </>
    );
  }
  return (
    <Panel>
      {body}
      {solved ? (
        <FadeIn style={{ gap: 8, alignItems: 'center' }}>
          <Text style={{ color: solved === 'ok' ? b.green : b.inkMuted, fontWeight: '900', fontSize: 16 }}>{solved === 'revealed' ? 'Voici le verset. Il reviendra bientôt.' : mistakes === 0 ? 'Du premier coup !' : 'Trouvé.'}</Text>
          <Text style={{ color: b.inkMuted, fontSize: 12 }}>{refLabel}</Text>
          <Button title="Suivant" icon="arrow-forward" onPress={onNext} />
        </FadeIn>
      ) : (
        <Button small variant="ghost" title="Voir la réponse" onPress={() => win(true)} />
      )}
    </Panel>
  );
}
