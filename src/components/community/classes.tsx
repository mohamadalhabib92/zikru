import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useLoad } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { sharedReadingEnabled } from '@/lib/lessons/api';
import { useAuth } from '@/lib/community/auth';
import { L } from '@/lib/l10n';
import { usePremium } from '@/lib/premium';
import { SURAHS } from '@/lib/surahs';
import { Button, Card, Field, H2, Muted, Notice, Row, Spacer, Toggle } from '@/ui/kit';

function passage(surah: string, from: string, to: string): { s: number; a: number; b: number } | null {
  const s = parseInt(surah, 10);
  const a = parseInt(from, 10);
  const b = parseInt(to, 10);
  const meta = SURAHS[s - 1];
  if (!meta || a < 1 || b < a || b > meta[4]) return null;
  return { s, a, b };
}

function parseWhen(s: string): string | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const surahLabel = (n: number) => SURAHS[n - 1]?.[2] ?? String(n);

/** Liste et création. Cachée tant que la migration n’est pas sur le serveur. */
export function ClassesHome() {
  const { displayName } = useAuth();
  const premium = usePremium();
  const teacher = useLoad(() => api.amITeacher(), []);
  const list = useLoad(() => api.listClasses(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (teacher.loading || teacher.data === null) return null;
  if (!teacher.data && !list.data?.length && !premium.canCreate) return null;

  return (
    <View>
      <H2>Classes</H2>
      <Muted>Un enseignant validé par Bissabi, avec Zikru Premium, ouvre une classe. Personne ne s’accorde ce rôle soi-même. Rejoindre reste gratuit.</Muted>
      {list.data?.map((c) => (
        <Card key={c.id} onPress={() => router.push(`/circle/${c.id}`)}>
          <H2>{c.name}</H2>
          <Muted>{c.description || 'Classe de Coran'}</Muted>
        </Card>
      ))}
      {teacher.data ? (
        creating ? (
          <Card>
            <Field label="Nom de la classe" value={name} onChangeText={setName} />
            <Field label="Description (facultatif)" value={desc} onChangeText={setDesc} error={err} />
            <Row gap={8}>
              <Button
                title="Créer"
                icon="add"
                loading={busy}
                onPress={async () => {
                  if (!name.trim()) return setErr('Nom requis.');
                  if (!premium.ready) return;
                  if (!premium.canCreate) return router.push('/premium');
                  setBusy(true);
                  try {
                    const id = await api.createClass(name.trim(), desc.trim(), displayName);
                    setCreating(false);
                    router.push(`/circle/${id}`);
                  } catch (e) {
                    setErr(api.frError(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <Button title="Annuler" variant="ghost" onPress={() => setCreating(false)} />
            </Row>
          </Card>
        ) : (
          <Button small variant="secondary" icon="book-outline" title="Créer une classe" onPress={() => { if (!premium.ready) return; if (!premium.canCreate) return router.push('/premium'); setCreating(true); }} />
        )
      ) : premium.canCreate ? (
        <Notice tone="info" title="Enseignant" text="Bissabi doit d’abord valider votre rôle. Ce n’est pas une case dans l’application." />
      ) : null}
      <Spacer />
    </View>
  );
}

/** Leçon en direct (l’appel du groupe) et récitation à préparer. L’app n’écoute pas la voix. */
export function ClassRoom({ id, isTeacher, allowMinors, allowMixed, onChanged }: { id: string; isTeacher: boolean; allowMinors: boolean; allowMixed: boolean; onChanged: () => void }) {
  const lessons = useLoad(() => api.listClassLessons(id), [id]);
  const reading = useLoad(() => sharedReadingEnabled(), [id]);
  const duties = useLoad(() => api.listClassAssignments(id), [id]);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [surah, setSurah] = useState('1');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('7');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saveOptions = (minors: boolean, mixed: boolean) =>
    void api.setClassOptions(id, minors, mixed).then(onChanged).catch((e) => setErr(api.frError(e)));

  return (
    <Card>
      <H2>Classe</H2>
      <Muted>La leçon en direct utilise l’appel du groupe. Le micro et la caméra restent éteints tant que chacun ne les ouvre pas. Zikru n’écoute pas et ne note pas la récitation.</Muted>
      {isTeacher ? (
        <>
          <Toggle label="Accueillir des mineurs" hint="Fermé par défaut. Un parent doit aussi l’autoriser pour son enfant." value={allowMinors} onChange={(v) => saveOptions(v, allowMixed)} />
          <Toggle label="Vidéo mixte" hint="Fermée par défaut. Tant qu’elle est fermée, l’appel de la classe reste en audio." value={allowMixed} onChange={(v) => saveOptions(allowMinors, v)} />
        </>
      ) : (
        <Muted>{allowMixed ? 'La vidéo est ouverte par l’enseignant.' : 'La vidéo de cette classe est fermée. L’enseignant peut l’ouvrir.'}</Muted>
      )}
      <Spacer h={8} />
      <H2>Leçons</H2>
      {(lessons.data ?? []).filter((l) => !l.cancelled_at).map((l) => (
        <View key={l.id} style={{ marginBottom: 8 }}>
          <Muted>{l.title} · {surahLabel(l.surah)} {l.ayah_from}–{l.ayah_to} · {new Date(l.starts_at).toLocaleString()}</Muted>
          <Row gap={8} wrap>
            {reading.data ? <Button small icon="book-outline" title="Lire le passage ensemble" onPress={() => router.push(`/lesson/${l.id}`)} /> : null}
            <Button small icon="call-outline" title="Rejoindre l’appel de la leçon" onPress={() => router.push({ pathname: '/call', params: { scope: 'circle', id, name: l.title, ...(reading.data ? { lesson: l.id } : {}) } })} />
          </Row>
        </View>
      ))}
      {isTeacher ? (
        <>
          <Field label="Titre de la leçon" value={title} onChangeText={setTitle} />
          <Field label="Début (AAAA-MM-JJ HH:MM)" placeholder={L('2026-11-12 18:00')} value={when} onChangeText={setWhen} />
          <Row gap={8}>
            <View style={{ flex: 1 }}><Field label="Sourate" keyboardType="number-pad" value={surah} onChangeText={setSurah} /></View>
            <View style={{ flex: 1 }}><Field label="Du verset" keyboardType="number-pad" value={from} onChangeText={setFrom} /></View>
            <View style={{ flex: 1 }}><Field label="Au verset" keyboardType="number-pad" value={to} onChangeText={setTo} /></View>
          </Row>
          <Button
            small
            title="Programmer la leçon"
            loading={busy}
            onPress={async () => {
              const at = parseWhen(when);
              const p = passage(surah, from, to);
              if (!title.trim() || !at || !p) return setErr('Indiquez un titre, une date AAAA-MM-JJ HH:MM et un passage valide.');
              setBusy(true);
              try {
                await api.scheduleClassLesson(id, title.trim(), at, p.s, p.a, p.b);
                setTitle('');
                setErr(null);
                await lessons.reload();
              } catch (e) {
                setErr(api.frError(e));
              } finally {
                setBusy(false);
              }
            }}
          />
          <Spacer h={8} />
          <Field label="Consigne (facultatif)" value={note} onChangeText={setNote} />
          <Button
            small
            variant="secondary"
            title="Donner ce passage à réciter"
            onPress={async () => {
              const p = passage(surah, from, to);
              if (!p) return setErr('Ce passage ne correspond pas à la sourate.');
              try {
                await api.assignRecitation(id, p.s, p.a, p.b, note.trim());
                setNote('');
                setErr(null);
                await duties.reload();
              } catch (e) {
                setErr(api.frError(e));
              }
            }}
          />
        </>
      ) : null}
      <Spacer h={8} />
      <H2>Récitations à préparer</H2>
      {(duties.data ?? []).length ? null : <Muted>Aucune récitation pour l’instant.</Muted>}
      {(duties.data ?? []).map((d) => (
        <Row key={d.id} gap={8} style={{ marginBottom: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Muted>{surahLabel(d.surah)} {d.ayah_from}–{d.ayah_to}{d.note ? ` · ${d.note}` : ''}</Muted>
          </View>
          <Button small title="J’ai récité" onPress={() => void api.markRecitationDone(d.id).catch((e) => setErr(api.frError(e)))} />
        </Row>
      ))}
      {err ? <Notice tone="warning" title={err} /> : null}
    </Card>
  );
}
