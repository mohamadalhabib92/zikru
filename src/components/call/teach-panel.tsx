/**
 * Lecture partagée d’un appel : le texte en grand, la vidéo du professeur en dessous.
 * L’enseignant choisit. Les autres suivent, et peuvent seulement agrandir chez eux.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { L } from '@/lib/l10n';
import { arNum } from '@/lib/quran-nav';
import { loadSurahRaw } from '@/lib/quran-sura/load';
import {
  canHostTeaching,
  drive,
  nextZoom,
  quranCite,
  quranSlices,
  teachChip,
  teachPlate,
  type DriveOp,
  type QuranBoard,
  type TeachBoard,
} from '@/lib/calls/teach';
import { Button, Field, Muted, Row, Segmented } from '@/ui/kit';
import { Text } from '@/ui/Text';
import { currentScheme } from '@/ui/theme';

const ARABIC = { fontFamily: 'AmiriQuran_400Regular' as const };

type Line = { surah: number; ayah: number; index: number; text: string };

export function TeachLayout({
  callId,
  board,
  host,
  premium,
  video,
  onBoard,
}: {
  callId: string;
  board: TeachBoard | null;
  host: boolean;
  premium: boolean;
  video: ReactNode;
  onBoard: (b: TeachBoard) => void;
}) {
  const { width, height } = useWindowDimensions();
  const wide = width > height && width >= 700;
  const teacher = canHostTeaching(host, premium);
  const shown = board && board.kind !== 'off' ? board : null;
  const [picker, setPicker] = useState(false);
  const send = (op: DriveOp) => {
    const r = drive(shown, callId, op, teacher);
    if (r.ok) {
      onBoard(r.board);
      if (op.type !== 'off') setPicker(false);
    }
    return r;
  };

  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
      <View style={{ flex: 1, minHeight: wide ? 0 : 220 }}>
        {shown ? <Reading board={shown} /> : null}
        {teacher && (picker || !shown) ? <Picker onDrive={send} /> : null}
        {host && !premium ? <Muted>{L('Conduire la lecture demande Zikru Premium. Les personnes déjà dans l’appel la voient sans nouvel achat.')}</Muted> : null}
        <Row wrap gap={6} style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          {teacher && shown?.kind === 'quran' ? (
            <>
              <Button small variant="ghost" title={L('Verset précédent')} onPress={() => send({ type: 'ayah', dir: -1 })} />
              <Button small variant="ghost" title={L('Verset suivant')} onPress={() => send({ type: 'ayah', dir: 1 })} />
              <Button small variant="ghost" title={L('Page précédente')} onPress={() => send({ type: 'pageStep', dir: -1 })} />
              <Button small variant="ghost" title={L('Page suivante')} onPress={() => send({ type: 'pageStep', dir: 1 })} />
              <Button small variant="ghost" title={shown.highlight ? L('Masquer le surlignage') : L('Surligner le verset')} onPress={() => send({ type: 'highlight', on: !shown.highlight })} />
            </>
          ) : null}
          {teacher ? (
            <Button small variant="ghost" title={picker ? L('Fermer le choix') : L('Choisir un passage')} onPress={() => setPicker((v) => !v)} />
          ) : null}
          {teacher && shown ? <Button small variant="ghost" title={L('Fermer la lecture')} onPress={() => send({ type: 'off' })} /> : null}
        </Row>
      </View>
      <View style={{ flex: wide ? 0.9 : 1, minHeight: 200 }}>{video}</View>
    </View>
  );
}

function Reading({ board }: { board: Exclude<TeachBoard, { kind: 'off' }> }) {
  const plate = teachPlate(currentScheme());
  const [zoom, setZoom] = useState(1);
  const size = Math.round(34 * zoom);
  return (
    <View style={{ flex: 1, backgroundColor: plate.bg, margin: 8, borderRadius: 16, overflow: 'hidden' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {board.kind === 'quran' ? <QuranBody board={board} plate={plate} size={size} /> : <PasteBody board={board} plate={plate} size={size} />}
      </ScrollView>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10 }}>
        <Row gap={8}>
          <Pressable accessibilityRole="button" accessibilityLabel={L('Réduire')} onPress={() => setZoom((z) => nextZoom(z, -1))} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text style={{ color: plate.muted, fontWeight: '700' }}>A−</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={L('Agrandir')} onPress={() => setZoom((z) => nextZoom(z, 1))} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text style={{ color: plate.muted, fontWeight: '700' }}>A+</Text>
          </Pressable>
        </Row>
        {board.kind === 'quran' ? <Chip plate={plate} hizb={teachChip(board).hizb} page={teachChip(board).page} /> : (
          <View style={{ backgroundColor: plate.chip, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: plate.fg, fontSize: 12, fontWeight: '700' }}>{L(board.hadith ? 'Hadith fourni par l’enseignant' : 'Texte fourni par l’enseignant')}</Text>
          </View>
        )}
      </Row>
    </View>
  );
}

function Chip({ plate, hizb, page }: { plate: ReturnType<typeof teachPlate>; hizb: string; page: number }) {
  return (
    <View style={{ backgroundColor: plate.chip, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ color: plate.fg, fontSize: 12, fontWeight: '700' }}>{`${hizb} · ${L('page {n}', { n: page })}`}</Text>
    </View>
  );
}

function QuranBody({ board, plate, size }: { board: QuranBoard; plate: ReturnType<typeof teachPlate>; size: number }) {
  const [lines, setLines] = useState<Line[]>([]);
  const held = useRef(board);
  held.current = board;
  const sig = `${board.start}:${board.end}`;
  useEffect(() => {
    let on = true;
    const current = held.current;
    const slices = quranSlices(current);
    void Promise.all(
      slices.map(async (sl) => {
        const ayahs = await loadSurahRaw(sl.surah);
        return ayahs.slice(sl.from - 1, sl.to).map((text, i) => ({ surah: sl.surah, ayah: sl.from + i, text }));
      }),
    ).then((parts) => {
      if (!on) return;
      let index = current.start;
      const flat: Line[] = [];
      for (const part of parts) for (const line of part) flat.push({ ...line, index: index++ });
      setLines(flat);
    });
    return () => {
      on = false;
    };
  }, [sig]);
  return (
    <View>
      <Text style={{ color: plate.muted, fontSize: 13, marginBottom: 10 }}>{quranCite(board)}</Text>
      <Text style={{ color: plate.fg, textAlign: 'right', writingDirection: 'rtl' }}>
        {lines.map((line) => {
          const on = board.highlight && line.index === board.focus;
          return (
            <Text key={`${line.surah}:${line.ayah}`} style={[ARABIC, { fontSize: size, lineHeight: Math.round(size * 1.85), color: plate.fg, backgroundColor: on ? plate.hi : 'transparent' }]}>
              {line.text}
              {` \u06DD${arNum(line.ayah)} `}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

function PasteBody({ board, plate, size }: { board: Extract<TeachBoard, { kind: 'paste' }>; plate: ReturnType<typeof teachPlate>; size: number }) {
  return (
    <View>
      <Text style={{ color: plate.muted, fontSize: 13, marginBottom: 10 }}>{board.source}</Text>
      <Text style={[ARABIC, { color: plate.fg, fontSize: size, lineHeight: Math.round(size * 1.7), textAlign: 'right', writingDirection: 'rtl' }]}>{board.text}</Text>
    </View>
  );
}

function Picker({ onDrive }: { onDrive: (op: DriveOp) => { ok: true } | { ok: false; reason: string } }) {
  const [mode, setMode] = useState<'quran' | 'hadith' | 'text'>('quran');
  const [surah, setSurah] = useState('1');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('7');
  const [page, setPage] = useState('');
  const [hizb, setHizb] = useState('');
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const fail = (reason?: string) => setErr(reason === 'source' ? L('Indiquez la source : recueil et numéro.') : reason === 'range' ? L('Ce passage n’existe pas.') : L('Le texte est vide, ou trop long.'));
  return (
    <View style={{ paddingHorizontal: 12, gap: 8 }}>
      <Segmented
        label={L('Passage à enseigner')}
        value={mode}
        onChange={setMode}
        options={[
          { label: L('Coran'), value: 'quran' },
          { label: L('Hadith'), value: 'hadith' },
          { label: L('Texte'), value: 'text' },
        ]}
      />
      {mode === 'quran' ? (
        <>
          <Row gap={8}>
            <View style={{ flex: 1 }}><Field label={L('Sourate')} value={surah} onChangeText={setSurah} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label={L('Du verset')} value={from} onChangeText={setFrom} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label={L('Au verset')} value={to} onChangeText={setTo} keyboardType="number-pad" /></View>
          </Row>
          <Button title={L('Afficher ce passage')} onPress={() => {
            const r = onDrive({ type: 'surah', surah: +surah, from: +from, to: +to });
            if (!r.ok) fail(r.reason);
            else setErr(null);
          }} />
          <Row gap={8}>
            <View style={{ flex: 1 }}><Field label={L('Numéro de page')} value={page} onChangeText={setPage} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label={L('Numéro de hizb')} value={hizb} onChangeText={setHizb} keyboardType="number-pad" /></View>
          </Row>
          <Row gap={8}>
            <Button small title={L('Afficher la page')} onPress={() => {
              const r = onDrive({ type: 'page', page: +page });
              if (!r.ok) fail(r.reason);
              else setErr(null);
            }} />
            <Button small title={L('Afficher le hizb')} onPress={() => {
              const r = onDrive({ type: 'hizb', hizb: +hizb });
              if (!r.ok) fail(r.reason);
              else setErr(null);
            }} />
          </Row>
        </>
      ) : (
        <>
          {mode === 'hadith' ? <Muted>{L('Aucun recueil de hadith n’est proposé ici : leur licence de redistribution n’est pas établie. Collez le texte et indiquez le recueil et le numéro.')}</Muted> : null}
          <Field label={L('Texte à afficher')} value={text} onChangeText={setText} multiline />
          <Field label={L('Source (recueil et numéro)')} value={source} onChangeText={setSource} />
          <Button title={L('Afficher ce texte')} onPress={() => {
            const r = onDrive({ type: 'paste', hadith: mode === 'hadith', text, source });
            if (!r.ok) fail(r.reason);
            else setErr(null);
          }} />
        </>
      )}
      {err ? <Muted>{err}</Muted> : null}
    </View>
  );
}
