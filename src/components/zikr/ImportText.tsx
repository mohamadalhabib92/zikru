/**
 * « Coller / photo » : importer un verset ou un zikr par copier-coller ou par photo.
 * - Le texte n’est jamais modifié sans action explicite (« Modifier », « Utiliser le texte officiel »).
 * - Le rapprochement avec le Coran (Tanzil, hors ligne) se fait sur l’appareil ; seule la sourate reconnue
 *   peut être demandée à api.alquran.cloud pour la traduction si elle n’est pas déjà en cache.
 * - La reconnaissance de texte (photo) est faite sur l’appareil (Apple Vision) ; la photo reste locale.
 */
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, TextInput, View } from 'react-native';
import { Text } from '@/ui/Text';
import { L, useUiLang } from '@/lib/l10n';
import { keepPhoto, ocrSupport, recognizeArabic } from '@/lib/ocr';
import { translationFor } from '@/lib/quran';
import { normAr } from '@/lib/ar-norm';
import { loadQuranIndex, matchQuran, type MatchResult, type QuranProposal } from '@/lib/quran-match';
import { surahEdition } from '@/lib/quran-reader-data';
import { SURAHS } from '@/lib/surahs';
import { Arabic, LMuted } from '@/ui/light';
import { brand as b, theme as t } from '@/ui/theme';
import { AbjadBadge, LBtn, type DraftItem } from './parts';

const field = () =>
  ({
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: b.line,
    backgroundColor: b.paper,
    paddingHorizontal: 12,
    color: b.ink,
  }) as const;
const card = () => ({ backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, padding: 12, marginTop: 10 }) as const;
const firstWords = (s: string) => s.trim().split(/\s+/).slice(0, 4).join(' ');

/** Traduction et translittération d’un passage reconnu (cache puis réseau, sourate entière). */
function useVerseExtras(p: QuranProposal | null, lang: string) {
  const ed = translationFor(lang);
  const key = p ? `${p.s}:${p.a}-${p.b}:${ed.id}` : '';
  const [st, setSt] = useState<{ key: string; tr?: string; tl?: string; label: string } | null>(null);
  useEffect(() => {
    if (!p) return;
    let alive = true;
    const pick = (l: string[] | null) => (l ? l.slice(p.a - 1, p.b).join(' ') : undefined);
    Promise.all([surahEdition(p.s, ed.id).catch(() => null), surahEdition(p.s, 'en.transliteration').catch(() => null)]).then(([t, tl]) => {
      if (alive) setSt({ key, tr: pick(t), tl: pick(tl), label: ed.label });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return st && st.key === key ? st : null;
}

function Proposal({ p, text, onOfficial, onKeep }: { p: QuranProposal; text: string; onOfficial: (extra: { tr?: string; fr?: string }) => void; onKeep: () => void }) {
  const pl = useUiLang();
  const x = useVerseExtras(p, pl);
  const near = p.level === 'near';
  const surah = SURAHS[p.s - 1][2];
  const same = text.trim() === p.official;
  const spellingDiffers = !near && !same && normAr(text) !== normAr(p.official);
  const kindLabel = p.kind === 'partial' ? L('extrait de {r}', { r: p.ref }) : p.kind === 'range' ? L('versets {r}', { r: p.ref }) : L('verset {r}', { r: p.ref });
  const tone = near ? t.warning : b.green;
  // Traduction gardée seulement pour des versets entiers (une traduction d’extrait serait inexacte) ; en arabe c’est un tafsir.
  const keepTr = p.whole && pl !== 'ar' ? x?.tr : undefined;
  return (
    <View style={[card(), { borderColor: tone, borderWidth: 2 }]} accessible={false}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
        <Text style={{ color: tone, fontWeight: '900', fontSize: 15 }} accessibilityRole="header">
          {near ? '⚠ ' : '✓ '}
        </Text>
        <Text style={{ color: tone, fontWeight: '800', flex: 1 }}>
          {near ? L('Ressemble à {s} {r}, mais ce n’est pas le texte exact ({n} mot(s) diffèrent).', { s: surah, r: p.ref, n: p.diff }) : L('Reconnu dans le Coran : {s}, {k}.', { s: surah, k: kindLabel })}
        </Text>
      </View>
      {p.also.length ? <LMuted style={{ fontSize: 12, marginTop: 4 }}>{L('Le même texte se trouve aussi en : {l}', { l: p.also.slice(0, 6).join(', ') + (p.also.length > 6 ? '…' : '') })}</LMuted> : null}
      {p.basmala ? <LMuted style={{ fontSize: 12, marginTop: 4 }}>La basmala en tête est reprise telle quelle (Coran 1:1).</LMuted> : null}
      <LMuted style={{ fontSize: 12, fontWeight: '700', marginTop: 10 }}>Texte officiel (Tanzil, écriture uthmani)</LMuted>
      <Arabic quran size={22} style={{ marginTop: 4 }}>
        {p.official}
      </Arabic>
      {p.whole && x?.tl ? (
        <Text style={{ color: b.brownSoft, fontStyle: 'italic', marginTop: 4 }}>{x.tl}</Text>
      ) : null}
      {x?.tr ? (
        <View style={{ marginTop: 6 }}>
          <LMuted style={{ fontSize: 12 }}>{x.tr}</LMuted>
          <LMuted style={{ fontSize: 11, marginTop: 2 }}>{p.whole ? x.label : L('{t} · verset entier', { t: x.label })}</LMuted>
        </View>
      ) : !x ? (
        <ActivityIndicator color={b.green} style={{ marginTop: 6, alignSelf: 'flex-start' }} />
      ) : null}
      {near ? (
        <View style={{ backgroundColor: t.warningBg, borderRadius: 10, padding: 10, marginTop: 10 }}>
          <Text style={{ color: t.warning, fontSize: 13 }}>Votre texte ne correspond pas mot pour mot au Coran. Il ne sera pas présenté comme un verset sauf si vous choisissez le texte officiel.</Text>
        </View>
      ) : spellingDiffers ? (
        <LMuted style={{ fontSize: 12, marginTop: 8 }}>Mêmes mots que le Coran, mais l’écriture diffère.</LMuted>
      ) : !same ? (
        <LMuted style={{ fontSize: 12, marginTop: 8 }}>Mêmes mots que le Coran ; les signes (voyelles, hamza) peuvent différer de votre texte.</LMuted>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <LBtn icon="checkmark-circle-outline" label={same ? 'Ajouter ce verset' : 'Utiliser le texte officiel'} solid onPress={() => onOfficial({ tr: p.whole ? x?.tl : undefined, fr: keepTr })} />
        {same ? null : <LBtn icon="create-outline" label="Garder mon texte (non vérifié)" onPress={onKeep} />}
      </View>
      <LMuted style={{ fontSize: 11, marginTop: 6 }}>Texte : Tanzil (tanzil.net), comparé sur l’appareil.</LMuted>
    </View>
  );
}

export function ImportText({ onAdd }: { onAdd: (d: DraftItem) => void }) {
  const [text, setText] = useState('');
  const [orig, setOrig] = useState<string | null>(null); // texte reconnu sur la photo, tel quel
  const [via, setVia] = useState<'paste' | 'photo'>('paste');
  const [photo, setPhoto] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [ocr, setOcr] = useState<'idle' | 'busy' | 'done' | 'failed' | 'unsupported'>('idle');
  const [conf, setConf] = useState(1);
  const [title, setTitle] = useState('');
  const [found, setFound] = useState<{ q: string; r: MatchResult } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const support = useMemo(() => ocrSupport(), []);
  const canPhoto = Platform.OS !== 'web';

  // Analyse (lecture seule) du texte : le résultat n’est valable que pour le texte exact analysé.
  const res = found && found.q === text && text.trim() ? found.r : null;
  const checking = !!text.trim() && !res;
  useEffect(() => {
    if (!text.trim()) return;
    let alive = true;
    const h = setTimeout(() => {
      loadQuranIndex()
        .then((idx) => alive && setFound({ q: text, r: matchQuran(idx, text) }))
        .catch(() => {});
    }, 350);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [text]);

  const reset = () => {
    setText('');
    setOrig(null);
    setPhoto(null);
    setVia('paste');
    setEditing(true);
    setOcr('idle');
    setTitle('');
  };
  const paste = async () => {
    setNote(null);
    const s = await Clipboard.getStringAsync().catch(() => '');
    if (!s.trim()) return setNote(L('Le presse-papiers est vide.'));
    reset();
    setText(s);
  };
  const shoot = async (camera: boolean) => {
    setNote(null);
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setNote(L('Accès à l’appareil photo refusé. Vous pouvez l’autoriser dans les Réglages.'));
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false, base64: false };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.[0]) return;
    reset();
    setVia('photo');
    setPhoto(r.assets[0].uri);
    if (!support.ok) {
      setOcr('unsupported');
      setEditing(true);
      return;
    }
    setOcr('busy');
    setEditing(false);
    try {
      const o = await recognizeArabic(r.assets[0].uri);
      setOrig(o.text);
      setText(o.text);
      setConf(o.minConfidence);
      setOcr(o.text ? 'done' : 'failed');
      if (!o.text) setEditing(true);
    } catch {
      setOcr('failed');
      setEditing(true);
    }
  };
  const extra = (): Pick<DraftItem, 'via' | 'photo'> => ({ via, photo: photo ? keepPhoto(photo) : undefined });
  const done = () => reset(); // le sélecteur affiche déjà « ✓ Ajouté »
  const addOfficial = (p: QuranProposal, x: { tr?: string; fr?: string }) => {
    const ref = p.kind === 'partial' ? L('{r} (extrait)', { r: p.ref }) : p.ref;
    const label = title.trim() || `${SURAHS[p.s - 1][2]} ${ref}`;
    onAdd({ kind: 'verse', ref: 'Coran ' + ref, label, ar: p.official, tr: x.tr, fr: x.fr, reps: 1, ...extra() });
    done();
  };
  const addMine = () => {
    const label = title.trim() || firstWords(text);
    onAdd({ kind: 'free', ref: 'Texte personnel', label, ar: text.trim(), reps: 1, unverified: true, ...extra() });
    done();
  };

  const ocrMsg =
    support.ok
      ? null
      : support.reason === 'web'
        ? 'Sur le web, Zikru ne lit pas les photos. Sur iPhone, ouvrez la photo et utilisez « Texte en direct » (ou Google Lens sur Android) pour copier le texte, puis touchez « Coller ».'
        : support.reason === 'android'
          ? 'Sur Android, la reconnaissance de l’écriture arabe sur l’appareil n’est pas encore disponible. Vous pouvez joindre la photo et recopier le texte, ou copier le texte avec Google Lens puis le coller.'
          : support.reason === 'no-arabic'
            ? 'Cette version d’iOS ne reconnaît pas l’écriture arabe. Vous pouvez joindre la photo et recopier le texte, ou utiliser « Texte en direct » puis « Coller ».'
            : 'La reconnaissance de texte arrivera avec la prochaine version de l’app. En attendant, joignez la photo et recopiez le texte, ou utilisez « Texte en direct » puis « Coller ».';
  const best = res && res.level !== 'none' ? res.best : null;
  const hasText = !!text.trim();

  return (
    <View style={{ gap: 8 }}>
      <LMuted>Collez un verset ou un zikr, ou photographiez un texte. Votre texte n’est jamais modifié sans votre accord.</LMuted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <LBtn icon="clipboard-outline" label="Coller" solid onPress={paste} />
        {canPhoto ? <LBtn icon="camera-outline" label="Photographier" onPress={() => shoot(true)} /> : null}
        {canPhoto ? <LBtn icon="image-outline" label="Choisir une photo" onPress={() => shoot(false)} /> : null}
        {hasText || photo ? <LBtn icon="close" label="Effacer" onPress={reset} /> : null}
      </View>
      {ocrMsg ? (
        <View style={{ backgroundColor: t.warningBg, borderRadius: 10, padding: 10 }}>
          <Text style={{ color: t.warning, fontSize: 13 }}>{ocrMsg}</Text>
        </View>
      ) : null}
      {note ? <Text style={{ color: b.green, fontWeight: '700' }} accessibilityLiveRegion="polite">{note}</Text> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
        {photo ? (
          <View style={{ flexGrow: 1, flexBasis: 150, minWidth: 140 }}>
            <Image source={{ uri: photo }} resizeMode="contain" style={{ width: '100%', height: 240, borderRadius: 12, backgroundColor: b.paper }} accessible accessibilityRole="image" accessibilityLabel={L('Photo d’origine (gardée sur l’appareil)')} />
            <LMuted style={{ fontSize: 11, marginTop: 4 }}>La photo reste sur votre appareil.</LMuted>
          </View>
        ) : null}
        <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 180 }}>
          {photo && ocr === 'busy' ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color={b.green} />
              <LMuted style={{ marginTop: 6 }}>Lecture du texte sur l’appareil…</LMuted>
            </View>
          ) : editing ? (
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="ألصق النص هنا"
              placeholderTextColor={b.inkMuted}
              multiline
              autoCorrect={false}
              spellCheck={false}
              style={[field(), { minHeight: 110, fontSize: 22, textAlign: 'right', writingDirection: 'rtl', paddingVertical: 8 }]}
              accessibilityLabel={L('Texte arabe à vérifier')}
            />
          ) : (
            <View style={card()}>
              <LMuted style={{ fontSize: 12, fontWeight: '700' }}>Texte reconnu (lecture seule)</LMuted>
              <Arabic size={22} style={{ marginTop: 4 }}>
                {text}
              </Arabic>
              {conf < 0.5 ? <Text style={{ color: t.warning, fontSize: 12, marginTop: 4 }}>Lecture incertaine : comparez avec la photo.</Text> : null}
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <LBtn icon="create-outline" label="Modifier" onPress={() => setEditing(true)} />
              </View>
            </View>
          )}
          {photo && editing && orig !== null && text !== orig ? (
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              <LBtn icon="arrow-undo-outline" label="Revenir au texte reconnu" onPress={() => setText(orig)} />
            </View>
          ) : null}
          {photo && ocr === 'failed' ? <LMuted style={{ fontSize: 12, marginTop: 4 }}>Aucun texte lu sur la photo. Vous pouvez le recopier.</LMuted> : null}
        </View>
      </View>

      {hasText ? (
        <TextInput value={title} onChangeText={setTitle} placeholder={L('Titre (facultatif)')} placeholderTextColor={b.inkMuted} style={field()} accessibilityLabel={L('Titre')} />
      ) : null}
      {hasText && checking && !res ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <ActivityIndicator color={b.green} />
          <LMuted>Recherche dans le Coran (sur l’appareil)…</LMuted>
        </View>
      ) : null}
      {best ? <Proposal p={best} text={text} onOfficial={(x) => addOfficial(best, x)} onKeep={addMine} /> : null}
      {hasText && res && res.level === 'none' ? (
        <View style={card()}>
          <Text style={{ color: b.ink, fontWeight: '800' }}>
            {res.reason === 'not-arabic' ? 'Aucun texte arabe détecté.' : res.reason === 'too-short' ? 'Trop court pour être reconnu avec certitude (au moins 3 mots pour un extrait).' : 'Non trouvé dans le Coran.'}
          </Text>
          <LMuted style={{ marginTop: 4 }}>Si c’est une du‘a ou un zikr, vérifiez sa source : il sera ajouté avec la mention « non vérifié ».</LMuted>
          <View style={{ marginTop: 8 }}>
            <AbjadBadge ar={text} />
          </View>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <LBtn icon="add" label="Ajouter (non vérifié)" solid onPress={addMine} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
