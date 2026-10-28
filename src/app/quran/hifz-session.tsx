import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { AudioBar } from '@/components/quran/AudioBar';
import { HideText } from '@/components/quran/HideText';
import { QBtn, QChoice, QLabel, QStepper, Sheet } from '@/components/quran/Sheet';
import { useUthmani } from '@/components/quran/data';
import { useReaderKeepAwake } from '@/components/quran/keep-awake';
import { readerPalette, type Pal } from '@/components/quran/palette';
import { RATES } from '@/components/quran/ReaderSettings';
import { dayKey } from '@/lib/dates';
import { arNum, fromIndex, gIndex } from '@/lib/quran-nav';
import { gradeVerses, hifzCards, hifzPrefs, readerPrefs, startHifz, type HideMode } from '@/lib/quran-store';
import { buildQueue, RECITERS, reciterById, type Gap } from '@/lib/recitation';
import { useShared } from '@/lib/shared-state';
import { cardStatus, dailyQueue, type Grade } from '@/lib/srs';
import { SURAHS } from '@/lib/surahs';
import { useRecitation } from '@/lib/use-recitation';
import { alpha, fonts } from '@/ui/theme';

const HIDES: { label: string; value: HideMode; a11y: string }[] = [
  { label: 'Texte', value: 'none', a11y: 'Texte visible' },
  { label: '1er mot', value: 'first', a11y: 'Seul le premier mot visible' },
  { label: '1 sur 2', value: 'alt', a11y: 'Un mot sur deux masqué' },
  { label: 'Masqué', value: 'all', a11y: 'Tout masqué, touchez un mot pour le révéler' },
  { label: 'Flou', value: 'blur', a11y: 'Texte flouté' },
];
const GRADES: { g: Grade; label: string; sub: string; color: string }[] = [
  { g: 'hard', label: 'Difficile', sub: 'demain', color: '#C24D5C' },
  { g: 'medium', label: 'Moyen', sub: 'bientôt', color: '#D98A2B' },
  { g: 'easy', label: 'Facile', sub: 'plus tard', color: '#23946B' },
];

function GradeRow({ onGrade, pal, small }: { onGrade: (g: Grade) => void; pal: Pal; small?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {GRADES.map((x) => (
        <Pressable
          key={x.g}
          accessibilityRole="button"
          accessibilityLabel={`${x.label} : prochaine révision ${x.sub}`}
          onPress={() => onGrade(x.g)}
          style={({ pressed }) => ({ flex: 1, minHeight: small ? 36 : 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(x.color, pressed ? 0.3 : 0.15), borderWidth: 1, borderColor: alpha(x.color, 0.5) })}
        >
          <Text style={{ color: pal.dark ? '#fff' : x.color, fontWeight: '900', fontSize: small ? 13 : 15 }}>{x.label}</Text>
          {small ? null : <Text style={{ color: pal.muted, fontSize: 11 }}>{x.sub}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

/** Séance de mémorisation : apprentissage d’une plage (répétitions, masquage) ou révision du jour (cartes SM-2). */
export default function HifzSession() {
  const p = useLocalSearchParams<{ s?: string; from?: string; to?: string; mode?: string }>();
  const review = p.mode === 'review';
  const [rp] = useShared(readerPrefs);
  const pal = readerPalette(rp.theme);
  useReaderKeepAwake(rp.keepAwake, 'hifz');
  const title = review ? 'Révision du jour' : 'Mémorisation';
  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <Stack.Screen options={{ title, headerStyle: { backgroundColor: pal.bg }, headerTintColor: pal.ink, headerTitleStyle: { color: pal.ink } }} />
      {review ? <Review pal={pal} /> : <Learn pal={pal} s={Math.min(114, Math.max(1, +(p.s ?? 1) || 1))} from={+(p.from ?? 1) || 1} to={+(p.to ?? 0) || 0} />}
    </View>
  );
}

function Learn({ pal, s, from: f0, to: t0 }: { pal: Pal; s: number; from: number; to: number }) {
  const router = useRouter();
  const meta = SURAHS[s - 1];
  const [from, setFrom] = useState(Math.min(meta[4], Math.max(1, f0)));
  const [to, setTo] = useState(Math.min(meta[4], Math.max(from, t0 || from + 4)));
  const [hp, setHp] = useShared(hifzPrefs);
  const [rp] = useShared(readerPrefs);
  const [cards] = useShared(hifzCards);
  const all = useUthmani();
  const reciter = hp.reciter ?? rp.reciter;
  const rec = useRecitation({ reciter, rate: hp.rate, gap: hp.gap });
  const [reveal, setReveal] = useState(false);
  const [settings, setSettings] = useState(false);
  const [graded, setGraded] = useState<string | null>(null);
  const started = useRef(false);
  const verses = useMemo(() => Array.from({ length: to - from + 1 }, (_, i) => from + i), [from, to]);
  const today = dayKey();
  const set = (patch: Partial<typeof hp>) => setHp((v) => ({ ...v, ...patch }));
  const begin = (at = 0) => {
    if (!started.current) {
      startHifz(gIndex(s, from), gIndex(s, to) + 1);
      started.current = true;
    }
    const q = buildQueue(verses.map((a) => [s, a] as [number, number]), hp.each, hp.times || 1);
    const pos = Math.max(0, q.findIndex((x) => x.a === verses[at]));
    rec.start(q, pos, hp.times === 0);
  };
  // les réglages audio (répétitions) s’appliquent à la prochaine lecture : on arrête si la plage change
  useEffect(() => {
    rec.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);
  const gradeAll = (g: Grade) => {
    startHifz(gIndex(s, from), gIndex(s, to) + 1);
    gradeVerses(verses.map((a) => gIndex(s, a)), g);
    setGraded(GRADES.find((x) => x.g === g)!.label);
    rec.stop();
  };
  const step = rec.step;
  const size = rp.arSize + 2;
  const info = step ? `Verset ${step.a} · répétition ${step.rep}/${hp.each}${hp.times !== 1 ? ` · passage ${step.pass}${hp.times ? `/${hp.times}` : ''}` : ''}` : undefined;

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 150, gap: 14, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
        <View style={{ backgroundColor: pal.card, borderRadius: 20, borderWidth: 1, borderColor: pal.line, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: pal.ink, fontWeight: '900', fontSize: 18 }}>{`${meta[2]} · ${from}–${to}`}</Text>
              <Text style={{ color: pal.muted, fontSize: 13 }}>{`${reciterById(reciter).name} · ${hp.each}× chaque verset · ${hp.times ? `${hp.times}× la plage` : 'en boucle'}`}</Text>
            </View>
            <QBtn icon="options-outline" onPress={() => setSettings(true)} pal={pal} a11y="Réglages de répétition" small />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            <View style={{ gap: 4 }}>
              <QLabel pal={pal}>Début (A)</QLabel>
              <QStepper label="Verset de début" value={from} min={1} max={meta[4]} onChange={(v) => { setFrom(v); if (to < v) setTo(v); }} pal={pal} />
            </View>
            <View style={{ gap: 4 }}>
              <QLabel pal={pal}>Fin (B)</QLabel>
              <QStepper label="Verset de fin" value={to} min={from} max={meta[4]} onChange={setTo} pal={pal} />
            </View>
          </View>
          <QLabel pal={pal}>Masquer le texte</QLabel>
          <QChoice options={HIDES} value={hp.hide} onChange={(v) => { set({ hide: v }); setReveal(false); }} pal={pal} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {rec.playing ? <QBtn icon="pause" label="Pause" onPress={rec.pause} pal={pal} solid /> : <QBtn icon="play" label={rec.pos >= 0 ? 'Reprendre' : 'Écouter et répéter'} onPress={() => (rec.pos >= 0 ? rec.resume() : begin())} pal={pal} solid />}
            {hp.hide !== 'none' ? <QBtn icon={reveal ? 'eye-off-outline' : 'eye-outline'} label={reveal ? 'Masquer' : 'Révéler'} onPress={() => setReveal((v) => !v)} pal={pal} active={reveal} /> : null}
          </View>
        </View>

        {!all ? (
          <ActivityIndicator color={pal.accent} style={{ marginTop: 30 }} />
        ) : (
          verses.map((a, i) => {
            const k = gIndex(s, a);
            const playing = step?.s === s && step?.a === a;
            const st = cardStatus(cards[k], today);
            return (
              <Pressable
                key={a}
                accessibilityRole="button"
                accessibilityLabel={`Verset ${a}. Toucher pour écouter à partir d’ici`}
                onPress={() => begin(i)}
                style={{ backgroundColor: playing ? alpha(pal.accent, 0.1) : pal.card, borderRadius: 18, borderWidth: playing ? 2 : 1, borderColor: playing ? pal.accent : pal.line, padding: 14, gap: 8 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: pal.accent, fontWeight: '900' }}>{`${s}:${a}`}</Text>
                  {st !== 'none' ? <Text style={{ color: pal.muted, fontSize: 12 }}>{st === 'memorised' ? '· mémorisé' : st === 'review' ? '· à réviser' : '· en cours'}</Text> : null}
                  <View style={{ flex: 1 }} />
                  {playing ? <Text style={{ color: pal.accent, fontSize: 12, fontWeight: '800' }}>{`${step!.rep}/${hp.each}`}</Text> : null}
                </View>
                <HideText text={all[k]} mode={hp.hide} revealAll={reveal} size={size} lineH={rp.lineH} color={pal.ink} suffix={`۝${arNum(a)}`} />
                <GradeRow small pal={pal} onGrade={(g) => { startHifz(k, k + 1); gradeVerses([k], g); }} />
              </Pressable>
            );
          })
        )}

        <View style={{ backgroundColor: pal.card, borderRadius: 20, borderWidth: 1, borderColor: pal.line, padding: 16, gap: 10 }}>
          <Text style={{ color: pal.ink, fontWeight: '900', fontSize: 16 }}>Comment s’est passée la récitation de mémoire ?</Text>
          <Text style={{ color: pal.muted, fontSize: 13 }}>Masquez tout, récitez, puis évaluez-vous honnêtement : la date de révision est calculée pour chaque verset (SM-2).</Text>
          <GradeRow pal={pal} onGrade={gradeAll} />
          {graded ? (
            <View style={{ gap: 8 }}>
              <Text accessibilityLiveRegion="polite" style={{ color: pal.accent, fontWeight: '800' }}>{`Enregistré (${graded}). Les versets rejoignent votre révision.`}</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {to < meta[4] ? <QBtn icon="arrow-forward" label="Versets suivants" onPress={() => { const n = Math.min(meta[4], to + 1 + (to - from)); setFrom(to + 1); setTo(n); setGraded(null); started.current = false; }} pal={pal} solid /> : null}
                <QBtn icon="grid-outline" label="Mémorisation" onPress={() => router.back()} pal={pal} />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <AudioBar rec={rec} pal={pal} extra={info} />
      <Sheet visible={settings} onClose={() => setSettings(false)} title="Répétitions" subtitle="Appliquées à la prochaine lecture" pal={pal}>
        <QLabel pal={pal}>Répéter chaque verset</QLabel>
        <QChoice options={[1, 3, 5, 7, 10, 20].map((v) => ({ label: `${v}×`, value: v }))} value={hp.each} onChange={(v) => set({ each: v })} pal={pal} />
        <QLabel pal={pal}>Répéter toute la plage</QLabel>
        <QChoice options={[1, 2, 3, 5, 0].map((v) => ({ label: v ? `${v}×` : '∞', value: v, a11y: v ? `${v} fois` : 'En boucle' }))} value={hp.times} onChange={(v) => set({ times: v })} pal={pal} />
        <QLabel pal={pal}>Pause entre les répétitions (pour répéter soi-même)</QLabel>
        <QChoice<string> options={([0, 2, 5, 'x1', 'x1.5'] as Gap[]).map((v) => ({ label: v === 'x1' ? '= verset' : v === 'x1.5' ? '1,5× verset' : `${v} s`, value: String(v) }))} value={String(hp.gap)} onChange={(v) => set({ gap: (v === 'x1' || v === 'x1.5' ? v : +v) as Gap })} pal={pal} />
        <QLabel pal={pal}>Vitesse</QLabel>
        <QChoice options={RATES.map((v) => ({ label: `${String(v).replace('.', ',')}×`, value: v }))} value={hp.rate} onChange={(v) => set({ rate: v })} pal={pal} />
        <QLabel pal={pal}>Récitateur</QLabel>
        <QChoice<string>
          options={[{ label: 'Comme la lecture', value: '' }, ...RECITERS.filter((r) => r.riwaya === 'Hafs').map((r) => ({ label: r.name.replace('Mahmoud Khalil ', '').replace('Muhammad Siddiq ', '').replace('Mishary Rashid ', ''), value: r.id }))]}
          value={hp.reciter ?? ''}
          onChange={(v) => set({ reciter: v || null })}
          pal={pal}
        />
      </Sheet>
    </>
  );
}

function Review({ pal }: { pal: Pal }) {
  const router = useRouter();
  const [cards, , ready] = useShared(hifzCards);
  const [hp, setHp] = useShared(hifzPrefs);
  const [rp] = useShared(readerPrefs);
  const all = useUthmani();
  const rec = useRecitation({ reciter: hp.reciter ?? rp.reciter, rate: hp.rate, gap: 0 });
  const [items, setItems] = useState<{ k: number; part: string }[] | null>(null);
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [tally, setTally] = useState<Record<Grade, number>>({ easy: 0, medium: 0, hard: 0 });
  useEffect(() => {
    if (!ready || items) return;
    const q = dailyQueue(cards, dayKey());
    setItems([...q.sabaq.map((k) => ({ k, part: 'Sabaq · leçon du jour' })), ...q.sabqi.map((k) => ({ k, part: 'Sabqi · révision récente' })), ...q.manzil.map((k) => ({ k, part: 'Manzil · révision ancienne' }))]);
  }, [ready, cards, items]);
  const mode: HideMode = hp.hide === 'none' ? 'all' : hp.hide;
  if (!items || !all) return <ActivityIndicator color={pal.accent} style={{ marginTop: 60 }} />;
  const done = i >= items.length;
  const size = rp.arSize + 4;
  if (done)
    return (
      <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontSize: 48 }} accessibilityElementsHidden>
          ✓
        </Text>
        <Text style={{ color: pal.ink, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>{items.length ? 'Révision terminée' : 'Rien à réviser aujourd’hui'}</Text>
        <Text style={{ color: pal.muted, textAlign: 'center', maxWidth: 420 }}>
          {items.length ? `${items.length} verset${items.length > 1 ? 's' : ''} : ${tally.easy} facile, ${tally.medium} moyen, ${tally.hard} difficile. Qu’Allah vous facilite la préservation de Son Livre.` : 'Commencez une nouvelle leçon pour alimenter la révision.'}
        </Text>
        <QBtn icon="grid-outline" label="Retour à la mémorisation" onPress={() => router.back()} pal={pal} solid />
      </View>
    );
  const it = items[i];
  const [s, a] = fromIndex(it.k);
  const prev = a > 1 ? all[it.k - 1] : null;
  const grade = (g: Grade) => {
    gradeVerses([it.k], g);
    setTally((t) => ({ ...t, [g]: t[g] + 1 }));
    setReveal(false);
    rec.stop();
    setI(i + 1);
  };
  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 150, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: pal.muted, fontWeight: '700' }}>{it.part}</Text>
            <Text style={{ color: pal.muted, fontWeight: '700' }}>{`${i + 1} / ${items.length}`}</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: pal.line, overflow: 'hidden' }}>
            <View style={{ width: `${(i / items.length) * 100}%`, height: 6, backgroundColor: pal.accent }} />
          </View>
        </View>
        <View style={{ backgroundColor: pal.card, borderRadius: 22, borderWidth: 1, borderColor: pal.line, padding: 18, gap: 14 }}>
          <Text style={{ color: pal.accent, fontWeight: '900', fontSize: 16 }}>{`${SURAHS[s - 1][2]} · verset ${a}`}</Text>
          {prev ? (
            <View style={{ gap: 4 }}>
              <Text style={{ color: pal.muted, fontSize: 12 }}>Verset précédent (indice)</Text>
              <Text style={{ color: pal.muted, fontFamily: fonts.quran, fontSize: size - 8, lineHeight: (size - 8) * 2, textAlign: 'right', writingDirection: 'rtl' }}>{`${prev} ۝${arNum(a - 1)}`}</Text>
            </View>
          ) : null}
          <HideText key={it.k} text={all[it.k]} mode={mode} revealAll={reveal} size={size} lineH={rp.lineH} color={pal.ink} suffix={`۝${arNum(a)}`} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <QBtn icon={rec.playing ? 'pause' : 'volume-high-outline'} label={rec.playing ? 'Pause' : 'Écouter'} onPress={() => (rec.playing ? rec.pause() : rec.start([{ s, a, rep: 1, pass: 1 }], 0))} pal={pal} />
            <QBtn icon={reveal ? 'eye-off-outline' : 'eye-outline'} label={reveal ? 'Masquer' : 'Révéler'} onPress={() => setReveal((v) => !v)} pal={pal} active={reveal} />
            <QBtn icon="swap-horizontal" label={mode === 'blur' ? 'Flou' : mode === 'first' ? '1er mot' : mode === 'alt' ? '1 sur 2' : 'Masqué'} a11y="Changer le masquage" onPress={() => setHp((v) => ({ ...v, hide: mode === 'all' ? 'first' : mode === 'first' ? 'alt' : mode === 'alt' ? 'blur' : 'all' }))} pal={pal} />
          </View>
        </View>
        <Text style={{ color: pal.muted, textAlign: 'center' }}>Récitez le verset de mémoire, révélez pour vérifier, puis évaluez-vous.</Text>
        <GradeRow pal={pal} onGrade={grade} />
      </ScrollView>
      <AudioBar rec={rec} pal={pal} />
    </>
  );
}
