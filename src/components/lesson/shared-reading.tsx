/**
 * Texte de la leçon, le même des deux côtés. Hafs Tanzil embarqué, recopié tel quel.
 * Le curseur part tout de suite sur le canal LiveKit ; le serveur confirme ensuite.
 * Le suivi se met en pause quand l’élève fait défiler, et reprend d’un toucher.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, interpolateColor, scrollTo, useAnimatedRef, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLoad } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { L } from '@/lib/l10n';
import { usePremium } from '@/lib/premium';
import { PremiumPaywall } from '@/components/premium/paywall';
import {
  addMark,
  fetchReading,
  getClassLesson,
  handReading,
  openReading,
  removeMark,
  rowToState,
  setFocus,
  sharedReadingEnabled,
  watchReading,
  type ReadingRow,
} from '@/lib/lessons/api';
import {
  acceptRemote,
  applyReadingOp,
  decodeReading,
  encodeReading,
  followAfterScroll,
  HIGHLIGHT_MS,
  marksOn,
  onReconnect,
  passageFromTanzil,
  reconcileReading,
  resumeFollow,
  revertIfCurrent,
  SCROLL_MS,
  verseIntact,
  type FollowMode,
  type ReadingState,
  type VerseLine,
} from '@/lib/lessons/reading';
import { pageOf } from '@/lib/quran-nav';
import { SURAHS } from '@/lib/surahs';
import { Button, Card, Field, H2, Muted, Notice, Row, Spacer } from '@/ui/kit';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

/** Horodatage d’un geste d’envoi (pas pendant le rendu). */
function readingSentAt() {
  return Date.now();
}

const ARABIC = {
  fontFamily: 'AmiriQuran_400Regular' as const,
  fontSize: 36,
  lineHeight: 68,
};

function passage(surah: string, from: string, to: string): { s: number; a: number; b: number } | null {
  const s = parseInt(surah, 10);
  const a = parseInt(from, 10);
  const b = parseInt(to, 10);
  const meta = SURAHS[s - 1];
  if (!meta || a < 1 || b < a || b > meta[4]) return null;
  return { s, a, b };
}

function placed(row: ReadingRow): ReadingState {
  return rowToState(row, pageOf(row.surah, row.focus_ayah));
}

const Word = memo(function Word({
  word,
  space,
  active,
  marked,
  onPress,
}: {
  word: string;
  space: string;
  active: boolean;
  marked: boolean;
  onPress?: () => void;
}) {
  const v = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    v.value = withTiming(active ? 1 : 0, { duration: HIGHLIGHT_MS, easing: Easing.out(Easing.cubic) });
  }, [active, v]);
  const hi = t.warningBg;
  const mark = t.dangerBg;
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [marked ? mark : 'transparent', hi]),
  }));
  return (
    <Animated.Text onPress={onPress} style={[ARABIC, { color: t.text }, style]}>
      {word}
      {space}
    </Animated.Text>
  );
});

export function SharedReading({
  lessonId,
  embedded,
  onBroadcast,
  remoteRaw,
}: {
  lessonId: string;
  embedded?: boolean;
  onBroadcast?: (json: string) => void;
  remoteRaw?: string | null;
}) {
  const { userId } = useAuth();
  const premium = usePremium();
  const boot = useLoad(async () => {
    const on = await sharedReadingEnabled();
    if (!on) return { on: false as const };
    const lesson = await getClassLesson(lessonId);
    if (!lesson || lesson.cancelled_at) return { on: true as const, lesson: null, teacher: false, members: [] as { id: string; name: string }[] };
    const [mine, members] = await Promise.all([api.amITeacher(), api.circleMembers(lesson.circle_id)]);
    const me = members.find((m) => m.user_id === userId);
    return {
      on: true as const,
      lesson,
      teacher: !!mine && me?.role === 'founder' && (!premium.ready || premium.canCreate),
      founder: me?.role === 'founder',
      members: members.filter((m) => m.user_id !== userId).map((m) => ({ id: m.user_id, name: m.display_name })),
    };
  }, [lessonId, userId, premium.canCreate]);

  const [state, setState] = useState<ReadingState | null>(null);
  const [lines, setLines] = useState<VerseLine[]>([]);
  const [surah, setSurah] = useState('1');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('7');
  const [comment, setComment] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [follow, setFollow] = useState<FollowMode>('live');
  const ayahY = useRef<Record<number, number>>({});
  const programmatic = useRef(false);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const lesson = boot.data && 'lesson' in boot.data ? boot.data.lesson : null;
  const lessonSig = lesson ? `${lesson.surah}:${lesson.ayah_from}:${lesson.ayah_to}` : '';
  const [seenLesson, setSeenLesson] = useState('');
  if (lesson && seenLesson !== lessonSig) {
    setSeenLesson(lessonSig);
    setSurah(String(lesson.surah));
    setFrom(String(lesson.ayah_from));
    setTo(String(lesson.ayah_to));
  }

  useEffect(() => {
    if (!boot.data?.on || !boot.data.lesson || (premium.ready && !premium.canCreate)) return;
    let stop = false;
    let unsub = () => {};
    const pull = () =>
      fetchReading(lessonId)
        .then((row) => {
          if (stop) return;
          setState((prev) => onReconnect(prev, row ? placed(row) : null));
        })
        .catch((e) => {
          if (!stop) setErr(api.frError(e));
        });
    void pull();
    void watchReading(lessonId, () => void pull())
      .then((u) => {
        if (stop) u();
        else unsub = u;
      })
      .catch(() => {});
    return () => {
      stop = true;
      unsub();
    };
  }, [boot.data, lessonId, premium.ready, premium.canCreate]);

  const [seenRemote, setSeenRemote] = useState<typeof remoteRaw>(null);
  if (seenRemote !== remoteRaw) {
    setSeenRemote(remoteRaw);
    const env = remoteRaw ? decodeReading(remoteRaw) : null;
    if (env && env.lessonId === lessonId) setState((prev) => acceptRemote(prev, env) ?? prev);
  }

  const rangeSurah = state?.surah;
  const rangeFrom = state?.ayahFrom;
  const rangeTo = state?.ayahTo;
  useEffect(() => {
    if (rangeSurah == null || rangeFrom == null || rangeTo == null) return;
    let on = true;
    void import('@/lib/quran-uthmani').then(({ QURAN_UTHMANI }) => {
      if (!on) return;
      setLines(passageFromTanzil(QURAN_UTHMANI, rangeSurah, rangeFrom, rangeTo));
    });
    return () => {
      on = false;
    };
  }, [rangeSurah, rangeFrom, rangeTo]);

  const teacher = !!(boot.data && boot.data.on && boot.data.lesson && boot.data.teacher);
  const driving = !!state && !!userId && (state.driverId === null ? teacher : state.driverId === userId);

  const glideTo = (ayah: number) => {
    const y = ayahY.current[ayah];
    if (y == null) return;
    programmatic.current = true;
    scrollTo(scrollRef, 0, Math.max(0, y - 8), true);
    setTimeout(() => {
      programmatic.current = false;
    }, SCROLL_MS + 40);
  };

  const focusAyah = state?.focusAyah ?? null;
  useEffect(() => {
    if (focusAyah == null || follow !== 'live') return;
    const y = ayahY.current[focusAyah];
    if (y == null) return;
    programmatic.current = true;
    scrollTo(scrollRef, 0, Math.max(0, y - 8), true);
    const id = setTimeout(() => {
      programmatic.current = false;
    }, SCROLL_MS + 40);
    return () => clearTimeout(id);
  }, [focusAyah, follow, lines.length, scrollRef]);

  const publishNow = (next: ReadingState) => {
    setState(next);
    onBroadcast?.(encodeReading(next, readingSentAt()));
  };

  const focusAt = (ayah: number, word: number | null) => {
    if (!state || !driving || !userId) return;
    const count = lines.find((l) => l.ayah === ayah)?.words.length ?? 1;
    const op = applyReadingOp(state, {
      type: 'focus',
      ayah,
      word,
      wordCount: count,
      actorId: userId,
      teacher,
      page: pageOf(state.surah, ayah),
    });
    if (!op.ok) return;
    const snapshot = state;
    const attempted = op.state;
    publishNow(attempted);
    void setFocus(lessonId, ayah, word)
      .then((row) => {
        setState((prev) => reconcileReading(prev ?? placed(row), placed(row)));
        setErr(null);
      })
      .catch((e) => {
        setState((prev) => (prev ? revertIfCurrent(prev, attempted, snapshot) : snapshot));
        setErr(api.frError(e));
      });
  };

  const run = (fn: () => Promise<ReadingRow>, optimistic?: ReadingState) => {
    const snapshot = state;
    if (optimistic) publishNow(optimistic);
    void fn()
      .then((row) => {
        setState((prev) => reconcileReading(prev ?? placed(row), placed(row)));
        setErr(null);
      })
      .catch((e) => {
        if (snapshot && optimistic) setState((prev) => (prev ? revertIfCurrent(prev, optimistic, snapshot) : snapshot));
        setErr(api.frError(e));
      });
  };

  const pause = () => {
    if (programmatic.current || driving) return;
    setFollow((mode) => followAfterScroll(mode, true));
  };

  if (boot.loading) return null;
  if (!boot.data?.on) {
    if (embedded) return null;
    return <Notice tone="info" title="La lecture partagée n’est pas ouverte." />;
  }
  if (!boot.data.lesson) return embedded ? null : <Notice tone="warning" title="Cette leçon n’est plus disponible." />;
  if (premium.ready && !premium.canCreate) {
    return <PremiumPaywall title="Cette lecture demande Zikru Premium." text="Tout le monde dans la leçon doit avoir Zikru Premium, y compris les élèves." />;
  }

  const verses = (
    <Animated.ScrollView
      ref={scrollRef}
      style={embedded ? { maxHeight: 420 } : undefined}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={pause}
    >
      <View style={{ direction: 'rtl' }}>
        {lines.map((line) => {
          const intact = verseIntact(line);
          const ayahOn = state?.focusAyah === line.ayah && state.focusWord === null;
          return (
            <View
              key={line.ayah}
              onLayout={(e: LayoutChangeEvent) => {
                ayahY.current[line.ayah] = e.nativeEvent.layout.y;
              }}
              style={{ marginBottom: 12 }}
            >
              <Pressable disabled={!driving} onPress={() => focusAt(line.ayah, null)} hitSlop={6}>
                <Text style={{ color: ayahOn ? t.primary : t.muted, fontSize: 13, textAlign: 'right' }}>{L('Verset {n}', { n: line.ayah })}</Text>
              </Pressable>
              {intact ? (
                <Animated.Text style={{ textAlign: 'right', writingDirection: 'rtl' }}>
                  {line.words.map((word, i) => (
                    <Word
                      key={`${line.ayah}-${i}`}
                      word={word}
                      space={i < line.words.length - 1 ? ' ' : ''}
                      active={state?.focusAyah === line.ayah && state.focusWord === i}
                      marked={state ? marksOn(state, line.ayah, i).length > 0 : false}
                      onPress={driving ? () => focusAt(line.ayah, i) : undefined}
                    />
                  ))}
                </Animated.Text>
              ) : (
                <Animated.Text style={[ARABIC, { textAlign: 'right', writingDirection: 'rtl' }]}>{line.text}</Animated.Text>
              )}
            </View>
          );
        })}
      </View>
    </Animated.ScrollView>
  );

  const body = (
    <View>
      <H2>Lecture partagée</H2>
      {boot.data.founder && premium.ready && !premium.canCreate ? (
        <Muted>Conduire la lecture demande aussi la validation Bissabi. Tout le monde dans la leçon doit avoir Zikru Premium.</Muted>
      ) : null}
      <Muted>Le texte est le Hafs de Tanzil, embarqué, sans modification. Une marque ne change pas le verset. La caméra n’est pas nécessaire : le texte reste avec le son.</Muted>
      {state ? (
        <Muted>
          {L('Page {n}', { n: pageOf(state.surah, state.focusAyah) })}
          {driving ? ' · Vous conduisez le curseur.' : follow === 'paused' ? ' · Vous lisez à votre rythme.' : state.driverId === null ? ' · Vous suivez l’enseignant.' : ' · Vous suivez l’élève.'}
        </Muted>
      ) : (
        <Muted>{teacher ? 'Choisissez le passage, puis montrez-le.' : 'L’enseignant n’a pas encore affiché le passage.'}</Muted>
      )}
      {!driving && follow === 'paused' && state ? (
        <Button
          small
          title="Reprendre le suivi"
          onPress={() => {
            setFollow(resumeFollow());
            glideTo(state.focusAyah);
          }}
        />
      ) : null}
      {teacher ? (
        <>
          <Row gap={8}>
            <View style={{ flex: 1 }}><Field label="Sourate" keyboardType="number-pad" value={surah} onChangeText={setSurah} /></View>
            <View style={{ flex: 1 }}><Field label="Du verset" keyboardType="number-pad" value={from} onChangeText={setFrom} /></View>
            <View style={{ flex: 1 }}><Field label="Au verset" keyboardType="number-pad" value={to} onChangeText={setTo} /></View>
          </Row>
          <Button
            small
            title="Montrer ce passage"
            onPress={() => {
              const p = passage(surah, from, to);
              if (!p) return setErr('Ce passage ne correspond pas à la sourate.');
              const base = state ?? {
                lessonId,
                surah: p.s,
                ayahFrom: p.a,
                ayahTo: p.b,
                focusAyah: p.a,
                focusWord: null,
                driverId: null,
                revision: 0,
                page: pageOf(p.s, p.a),
                marks: [],
              };
              const op = applyReadingOp({ ...base, revision: Math.max(1, base.revision) }, {
                type: 'passage',
                surah: p.s,
                from: p.a,
                to: p.b,
                actorTeacher: true,
                page: pageOf(p.s, p.a),
              });
              if (!op.ok) return setErr('Ce passage ne correspond pas à la sourate.');
              run(() => openReading(lessonId, p.s, p.a, p.b), op.state);
            }}
          />
        </>
      ) : null}
      <Spacer h={8} />
      {verses}
      {teacher && state ? (
        <>
          <Row gap={8} wrap>
            <Button small variant="secondary" title="Marque de tajwīd" onPress={() => run(() => addMark(lessonId, state.focusAyah, state.focusWord, 'tajweed', ''))} />
            {boot.data.members.map((m) => (
              <Row key={m.id} gap={6} style={{ alignItems: 'center' }}>
                <Button small variant="ghost" title="Donner la main" onPress={() => run(() => handReading(lessonId, m.id))} />
                <Muted>{m.name}</Muted>
              </Row>
            ))}
            {state.driverId ? <Button small variant="ghost" title="Reprendre la main" onPress={() => run(() => handReading(lessonId, null))} /> : null}
          </Row>
          <Muted>{boot.data.members.length ? 'Donner la main laisse l’élève déplacer le curseur. Les marques restent à l’enseignant.' : 'Vous conduisez le curseur.'}</Muted>
          <Field label="Commentaire" value={comment} onChangeText={setComment} />
          <Button
            small
            title="Ajouter le commentaire"
            onPress={() => {
              const note = comment.trim();
              if (!note) return setErr('Écrivez le commentaire avant de l’ajouter.');
              setComment('');
              run(() => addMark(lessonId, state.focusAyah, state.focusWord, 'comment', note));
            }}
          />
        </>
      ) : null}
      {state && state.marks.length ? (
        <>
          <Spacer h={8} />
          <H2>Marques de la leçon</H2>
          {state.marks.map((m) => (
            <Row key={m.id} gap={8} style={{ marginBottom: 6, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Muted>
                  {m.kind === 'tajweed' ? 'Tajwīd' : 'Commentaire'}
                  {` · ${m.ayah}`}
                  {m.word !== null ? ` · ${m.word + 1}` : ''}
                  {m.comment ? ` · ${m.comment}` : ''}
                </Muted>
              </View>
              {teacher ? <Button small variant="ghost" title="Retirer la marque" onPress={() => run(() => removeMark(m.id))} /> : null}
            </Row>
          ))}
        </>
      ) : state ? (
        <Muted>Aucune marque pour l’instant.</Muted>
      ) : null}
      {err ? <Notice tone="warning" title={err} /> : null}
    </View>
  );

  return <Card>{body}</Card>;
}
