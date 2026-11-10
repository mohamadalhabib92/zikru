/**
 * Texte de la leçon, le même des deux côtés. Hafs Tanzil embarqué, recopié tel quel.
 * Les marques et le curseur passent par LiveKit pendant l’appel, sinon par Supabase Realtime.
 * Le rôle enseignant et le drapeau teaching.shared_reading (faux par défaut) ouvrent la conduite.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { useLoad } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { L } from '@/lib/l10n';
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
  decodeReading,
  encodeReading,
  marksOn,
  passageFromTanzil,
  verseIntact,
  type ReadingState,
  type VerseLine,
} from '@/lib/lessons/reading';
import { pageOf } from '@/lib/quran-nav';
import { SURAHS } from '@/lib/surahs';
import { Button, Card, Field, H2, Muted, Notice, Row, Spacer } from '@/ui/kit';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

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
      teacher: !!mine && me?.role === 'founder',
      members: members.filter((m) => m.user_id !== userId).map((m) => ({ id: m.user_id, name: m.display_name })),
    };
  }, [lessonId, userId]);

  const [state, setState] = useState<ReadingState | null>(null);
  const [lines, setLines] = useState<VerseLine[]>([]);
  const [surah, setSurah] = useState('1');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('7');
  const [comment, setComment] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const lesson = boot.data && 'lesson' in boot.data ? boot.data.lesson : null;
    if (!lesson) return;
    setSurah(String(lesson.surah));
    setFrom(String(lesson.ayah_from));
    setTo(String(lesson.ayah_to));
  }, [boot.data]);

  useEffect(() => {
    if (!boot.data?.on || !boot.data.lesson) return;
    let stop = false;
    let unsub = () => {};
    const pull = () =>
      fetchReading(lessonId)
        .then((row) => {
          if (stop || !row) return;
          setState((prev) => (!prev || row.revision >= prev.revision ? placed(row) : prev));
        })
        .catch((e) => {
          if (!stop) setErr(api.frError(e));
        });
    void pull();
    void watchReading(lessonId, () => void pull()).then((u) => {
      if (stop) u();
      else unsub = u;
    }).catch(() => {});
    return () => {
      stop = true;
      unsub();
    };
  }, [boot.data, lessonId]);

  useEffect(() => {
    if (!remoteRaw) return;
    const env = decodeReading(remoteRaw);
    if (!env || env.lessonId !== lessonId) return;
    setState((prev) => acceptRemote(prev, env) ?? prev);
  }, [remoteRaw, lessonId]);

  useEffect(() => {
    if (!state) return;
    let on = true;
    void import('@/lib/quran-uthmani').then(({ QURAN_UTHMANI }) => {
      if (!on) return;
      setLines(passageFromTanzil(QURAN_UTHMANI, state.surah, state.ayahFrom, state.ayahTo));
    });
    return () => {
      on = false;
    };
  }, [state?.surah, state?.ayahFrom, state?.ayahTo]);

  if (boot.loading) return null;
  if (!boot.data?.on) {
    if (embedded) return null;
    return <Notice tone="info" title="La lecture partagée n’est pas ouverte." />;
  }
  if (!boot.data.lesson) return embedded ? null : <Notice tone="warning" title="Cette leçon n’est plus disponible." />;

  const teacher = boot.data.teacher;
  const driving = !!state && (state.driverId === null ? teacher : state.driverId === userId);
  const publish = (row: ReadingRow) => {
    const next = placed(row);
    setState(next);
    onBroadcast?.(encodeReading(next));
  };
  const run = async (fn: () => Promise<ReadingRow>) => {
    setBusy(true);
    try {
      publish(await fn());
      setErr(null);
    } catch (e) {
      setErr(api.frError(e));
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <View>
      <H2>Lecture partagée</H2>
      <Muted>Le texte est le Hafs de Tanzil, embarqué, sans modification. Une marque ne change pas le verset. La caméra n’est pas nécessaire : le texte reste avec le son.</Muted>
      {state ? (
        <Muted>
          {L('Page {n}', { n: pageOf(state.surah, state.focusAyah) })}
          {driving ? ' · Vous conduisez le curseur.' : state.driverId === null ? ' · Vous suivez l’enseignant.' : ' · Vous suivez l’élève.'}
        </Muted>
      ) : (
        <Muted>{teacher ? 'Choisissez le passage, puis montrez-le.' : 'L’enseignant n’a pas encore affiché le passage.'}</Muted>
      )}
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
            loading={busy}
            onPress={() => {
              const p = passage(surah, from, to);
              if (!p) return setErr('Ce passage ne correspond pas à la sourate.');
              void run(() => openReading(lessonId, p.s, p.a, p.b));
            }}
          />
        </>
      ) : null}
      <Spacer h={8} />
      {lines.map((line) => {
        const intact = verseIntact(line);
        const ayahOn = state?.focusAyah === line.ayah && state.focusWord === null;
        return (
          <View key={line.ayah} style={{ marginBottom: 10 }}>
            <Pressable disabled={!driving} onPress={() => void run(() => setFocus(lessonId, line.ayah, null))}>
              <Text style={{ color: ayahOn ? t.primary : t.muted, fontSize: 13 }}>{L('Verset {n}', { n: line.ayah })}</Text>
            </Pressable>
            {intact ? (
              <RNText style={{ textAlign: 'right', writingDirection: 'rtl' }}>
                {line.words.map((word, i) => {
                  const on = state?.focusAyah === line.ayah && state.focusWord === i;
                  const marked = state ? marksOn(state, line.ayah, i).length > 0 : false;
                  return (
                    <RNText
                      key={`${line.ayah}-${i}`}
                      onPress={driving ? () => void run(() => setFocus(lessonId, line.ayah, i)) : undefined}
                      style={{
                        fontFamily: 'AmiriQuran_400Regular',
                        fontSize: 28,
                        lineHeight: 52,
                        color: t.text,
                        backgroundColor: on ? t.warningBg : marked ? t.dangerBg : 'transparent',
                      }}
                    >
                      {word}
                      {i < line.words.length - 1 ? ' ' : ''}
                    </RNText>
                  );
                })}
              </RNText>
            ) : (
              <RNText style={{ fontFamily: 'AmiriQuran_400Regular', fontSize: 28, lineHeight: 52, textAlign: 'right', writingDirection: 'rtl', color: t.text }}>{line.text}</RNText>
            )}
          </View>
        );
      })}
      {teacher && state ? (
        <>
          <Row gap={8} wrap>
            <Button
              small
              variant="secondary"
              title="Marque de tajwīd"
              onPress={() => void run(() => addMark(lessonId, state.focusAyah, state.focusWord, 'tajweed', ''))}
            />
            {boot.data.members.map((m) => (
              <Row key={m.id} gap={6} style={{ alignItems: 'center' }}>
                <Button small variant="ghost" title="Donner la main" onPress={() => void run(() => handReading(lessonId, m.id))} />
                <Muted>{m.name}</Muted>
              </Row>
            ))}
            {state.driverId ? <Button small variant="ghost" title="Reprendre la main" onPress={() => void run(() => handReading(lessonId, null))} /> : null}
          </Row>
          <Muted>{boot.data.members.length ? 'Donner la main laisse l’élève déplacer le curseur. Les marques restent à l’enseignant.' : 'Vous conduisez le curseur.'}</Muted>
          <Field label="Commentaire" value={comment} onChangeText={setComment} />
          <Button
            small
            title="Ajouter le commentaire"
            onPress={() => {
              const note = comment.trim();
              if (!note) return setErr('Écrivez le commentaire avant de l’ajouter.');
              void run(async () => {
                const row = await addMark(lessonId, state.focusAyah, state.focusWord, 'comment', note);
                setComment('');
                return row;
              });
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
              {teacher ? <Button small variant="ghost" title="Retirer la marque" onPress={() => void run(() => removeMark(m.id))} /> : null}
            </Row>
          ))}
        </>
      ) : state ? (
        <Muted>Aucune marque pour l’instant.</Muted>
      ) : null}
      {err ? <Notice tone="warning" title={err} /> : null}
    </View>
  );

  if (embedded) {
    return (
      <Card>
        <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      </Card>
    );
  }
  return <Card>{body}</Card>;
}
