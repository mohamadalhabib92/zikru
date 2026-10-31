/**
 * Importer un programme de zikr (photo, PDF ou texte collé) : chaque formule, son nombre et l’ordre sont détectés,
 * puis montrés à côté de leur page source. Rien n’est enregistré sans validation : chaque étape se modifie,
 * se déplace ou se supprime. Le rapprochement (Coran Tanzil, catalogue Zikru) est exact ; le reste est « non vérifié ».
 * Un programme importé reste personnel : il n’est jamais présenté comme validé par une voie.
 * Tout se fait sur l’appareil : aucun fichier, photo ou texte n’est envoyé.
 */
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { LBtn } from '@/components/zikr/parts';
import { L } from '@/lib/l10n';
import { keepPhoto, ocrSupport, recognizeArabic } from '@/lib/ocr';
import { ocrToLines } from '@/lib/ocr-lines';
import { closePdf, ocrPdfPage, openPdf, pdfSupport, renderPdfPage, type PdfDoc } from '@/lib/pdf';
import { pageIsScanned } from '@/lib/pdf-types';
import { latinDigits, parseProgram, type IgnoredLine, type ProgramStep } from '@/lib/program-parse';
import { matchStepText, stepToItem, type CatalogEntry, type ImportVia, type StepMatch } from '@/lib/program-match';
import { loadQuranIndex, type QuranIndex } from '@/lib/quran-match';
import { uid } from '@/lib/storage';
import { moveItem } from '@/lib/zikr';
import { useZikrs } from '@/lib/zikrs';
import { Ionicons, Screen, type IconName } from '@/ui/kit';
import { Arabic, LMuted } from '@/ui/light';
import { Text } from '@/ui/Text';
import { brand as b, theme as t } from '@/ui/theme';

/** garbled : la page contient du texte, mais mal encodé dans le PDF (lettres arabes perdues) : traitée comme scannée. */
type Page = { image: string | null; text: string; state: 'text' | 'scanned' | 'busy' | 'failed' | 'empty'; on: boolean; garbled?: boolean };
type EStep = {
  key: string;
  page: number;
  /** Lignes source (telles qu’elles ont été lues). */
  src: string[];
  ar: string;
  latin: string;
  hint: string;
  count: string;
  /** Nombre lu sans marque explicite : à confirmer par l’utilisateur. */
  unsure: boolean;
  alt: number[];
  /** Texte officiel (catalogue / Coran) utilisé quand il y a correspondance exacte. */
  official: boolean;
  /** Choix de l’utilisateur pour une étape ambiguë (id du catalogue, ou « own »). */
  pick: string | null;
};

const field = () => ({ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: b.line, backgroundColor: b.paper, paddingHorizontal: 12, color: b.ink }) as const;
const card = () => ({ backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, padding: 12 }) as const;
const parseCount = (s: string) => {
  const n = parseInt(latinDigits(s).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= 100000 ? n : null;
};
const toEdit = (s: ProgramStep, pages: Page[]): EStep => {
  const lines = (pages[s.page]?.text ?? '').split('\n');
  return {
    key: uid(),
    page: s.page,
    src: s.lines.map((i) => lines[i] ?? '').filter((x) => x.trim()),
    ar: s.ar,
    latin: s.latin,
    hint: s.hint,
    count: s.count ? String(s.count) : '',
    unsure: s.count !== null && !s.sure,
    alt: s.alt,
    official: true,
    pick: null,
  };
};

function Icon({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      hitSlop={4}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: b.line, backgroundColor: b.paper, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon} size={18} color={b.inkMuted} />
    </Pressable>
  );
}

function Badge({ m, s }: { m: StepMatch; s: EStep }) {
  let icon: IconName = 'alert-circle-outline';
  let color: string = t.warning;
  let label: string;
  if (s.pick === 'own') label = L('Texte personnel · non vérifié');
  else if (m.type === 'catalog') {
    icon = 'checkmark-circle';
    color = b.green;
    label = m.entry.kind === 'name' ? L('Catalogue Zikru · Nom d’Allah') : L('Catalogue Zikru · {r}', { r: m.entry.ref });
    if (m.loose) label += ' · ' + L('mêmes lettres, espaces du texte lu ignorés');
  } else if (m.type === 'quran') {
    icon = 'checkmark-circle';
    color = b.green;
    label = L('Coran {r} (Tanzil)', { r: m.p.ref });
    if (m.loose) label += ' · ' + L('mêmes lettres, espaces du texte lu ignorés');
  } else if (m.type === 'near') label = L('Ressemble à Coran {r}, mais ce n’est pas le texte exact · non vérifié', { r: m.p.ref });
  else if (m.type === 'ambiguous') label = L('Plusieurs formules possibles : choisissez');
  else if (m.reason === 'no-index') label = L('Recherche dans le Coran…');
  else label = L('Non vérifié');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }} accessible accessibilityLabel={label}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ color, fontWeight: '700', fontSize: 12, flexShrink: 1 }}>{label}</Text>
    </View>
  );
}

export default function ImportProgram() {
  const router = useRouter();
  const { create } = useZikrs();
  const [via, setVia] = useState<ImportVia>('paste');
  const [pages, setPages] = useState<Page[]>([]);
  const [paste, setPaste] = useState('');
  const [sel, setSel] = useState(0);
  const [steps, setSteps] = useState<EStep[] | null>(null);
  const [ignored, setIgnored] = useState<IgnoredLine[]>([]);
  const [showIgnored, setShowIgnored] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [idx, setIdx] = useState<QuranIndex | null>(null);
  const [total, setTotal] = useState(0);
  const pdfRef = useRef<PdfDoc | null>(null);
  const ocr = useMemo(() => ocrSupport(), []);
  const pdfOk = useMemo(() => pdfSupport(), []);
  const canPhoto = Platform.OS !== 'web';

  useEffect(() => {
    let alive = true;
    loadQuranIndex()
      .then((i) => alive && setIdx(i))
      .catch(() => {});
    return () => {
      alive = false;
      closePdf(pdfRef.current);
    };
  }, []);

  const matches = useMemo(() => (steps ?? []).map((s) => matchStepText(s.ar, s.latin, idx)), [steps, idx]);

  const reset = () => {
    closePdf(pdfRef.current);
    pdfRef.current = null;
    setPages([]);
    setSteps(null);
    setIgnored([]);
    setSel(0);
    setNote(null);
    setTotal(0);
  };
  const analyse = (ps: Page[]) => {
    const texts = ps.map((p) => (p.on ? p.text : ''));
    const r = parseProgram(texts);
    setSteps(r.steps.map((s) => toEdit(s, ps)));
    setIgnored(r.ignored);
    if (!r.steps.length) setNote(L('Aucune étape détectée. Vérifiez le texte lu, ou ajoutez les étapes à la main.'));
  };

  const fromPaste = async () => {
    const s = await Clipboard.getStringAsync().catch(() => '');
    if (!s.trim()) return setNote(L('Le presse-papiers est vide.'));
    reset();
    setVia('paste');
    setPaste(s);
  };
  const analysePaste = () => {
    const ps: Page[] = [{ image: null, text: paste, state: 'text', on: true }];
    setPages(ps);
    setNote(null);
    analyse(ps);
  };

  const fromPhoto = async (camera: boolean) => {
    setNote(null);
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setNote(L('Accès à l’appareil photo refusé. Vous pouvez l’autoriser dans les Réglages.'));
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false, base64: false, allowsMultipleSelection: !camera, selectionLimit: 10 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.length) return;
    // Photo supplémentaire = page suivante du même programme.
    const keep = via === 'photo' && pages.length ? pages : [];
    if (!keep.length) reset();
    setVia('photo');
    const added: Page[] = r.assets.map((a) => ({ image: a.uri, text: '', state: ocr.ok ? 'busy' : 'empty', on: true }));
    let ps = [...keep, ...added];
    setPages(ps);
    setSel(keep.length);
    if (!ocr.ok) return setNote(ocrNote(ocr.ok ? null : ocr.reason));
    setBusy(L('Lecture du texte sur l’appareil…'));
    for (let i = keep.length; i < ps.length; i++) {
      try {
        const o = await recognizeArabic(ps[i].image!);
        const text = ocrToLines(o.lines).join('\n');
        ps = ps.map((p, j) => (j === i ? { ...p, text, state: text ? 'text' : 'failed' } : p));
      } catch {
        ps = ps.map((p, j) => (j === i ? { ...p, state: 'failed' } : p));
      }
      setPages(ps);
    }
    setBusy(null);
    analyse(ps);
  };

  const fromPdf = async () => {
    setNote(null);
    if (!pdfOk.text) return setNote(pdfNote(pdfOk.reason));
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return;
    reset();
    setVia('pdf');
    setBusy(L('Lecture du PDF sur l’appareil…'));
    try {
      const doc = await openPdf(r.assets[0].uri);
      pdfRef.current = doc;
      setTotal(doc.total);
      let ps: Page[] = doc.pages.map((text, i) => {
        const garbled = !!doc.unreadable?.[i];
        const scanned = garbled || pageIsScanned(text);
        return { image: null, text: scanned ? '' : text, state: scanned ? 'scanned' : 'text', on: !scanned, garbled };
      });
      setPages(ps);
      // aperçus des pages (source affichée à côté des étapes)
      for (let i = 0; i < ps.length; i++) {
        const img = await renderPdfPage(doc, i);
        ps = ps.map((p, j) => (j === i ? { ...p, image: img } : p));
        setPages(ps);
      }
      if (ps.every((p) => p.state === 'scanned') && ps.some((p) => p.garbled)) setNote(pdfOk.ocr ? L('Le texte de ce PDF est mal encodé (lettres arabes perdues) : il ne sera pas deviné. Choisissez les pages à lire sur l’image.') : L('Le texte de ce PDF est mal encodé (lettres arabes perdues) : il ne sera pas deviné. Il ne peut pas être lu ici : utilisez l’app iPhone, ou copiez le texte depuis la source et collez-le.'));
      else if (ps.every((p) => p.state === 'scanned')) setNote(pdfOk.ocr ? L('Ce PDF ne contient que des pages scannées : choisissez les pages à lire.') : L('Ce PDF ne contient que des pages scannées. Elles ne peuvent pas être lues ici : utilisez l’app iPhone, ou copiez le texte et collez-le.'));
      else analyse(ps);
    } catch (e) {
      const msg = String((e as Error)?.message ?? '');
      setNote(msg === 'pdf-too-big' ? L('Ce PDF est trop volumineux (40 Mo au maximum).') : /password|locked|LOCKED/i.test(msg) ? L('Ce PDF est protégé par un mot de passe.') : L('Ce PDF n’a pas pu être lu.'));
    } finally {
      setBusy(null);
    }
  };

  const ocrPage = async (i: number) => {
    const doc = pdfRef.current;
    if (!doc) return;
    setBusy(L('Lecture de la page {n} sur l’appareil…', { n: i + 1 }));
    let ps = pages.map((p, j) => (j === i ? { ...p, state: 'busy' as const } : p));
    setPages(ps);
    try {
      const text = await ocrPdfPage(doc, i);
      ps = ps.map((p, j) => (j === i ? { ...p, text, state: text ? 'text' : 'failed', on: !!text } : p));
    } catch {
      ps = ps.map((p, j) => (j === i ? { ...p, state: 'failed' } : p));
    }
    setPages(ps);
    setBusy(null);
    analyse(ps);
  };

  const togglePage = (i: number) => {
    const ps = pages.map((p, j) => (j === i ? { ...p, on: !p.on } : p));
    setPages(ps);
    analyse(ps);
  };

  const upd = (key: string, patch: Partial<EStep>) => setSteps((ss) => (ss ?? []).map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => setSteps((ss) => moveItem(ss ?? [], i, d));
  const del = (key: string) => setSteps((ss) => (ss ?? []).filter((s) => s.key !== key));
  const split = (s: EStep) => {
    const r = parseProgram([s.src.join('\n\n')]);
    if (r.steps.length < 2) return;
    const parts = r.steps.map((p) => ({ ...toEdit({ ...p, page: s.page, lines: [] }, pages), src: [s.src[Math.min(p.lines[0] / 2, s.src.length - 1)] ?? ''], page: s.page }));
    setSteps((ss) => (ss ?? []).flatMap((x) => (x.key === s.key ? parts : [x])));
  };
  const addIgnored = (l: IgnoredLine) => {
    setIgnored((g) => g.filter((x) => x !== l));
    setSteps((ss) => [...(ss ?? []), { key: uid(), page: l.page, src: [l.text], ar: /[\u0600-\u06FF]/.test(l.text) ? l.text : '', latin: /[\u0600-\u06FF]/.test(l.text) ? '' : l.text, hint: '', count: '', unsure: false, alt: [], official: true, pick: null }]);
  };
  const addEmpty = () => setSteps((ss) => [...(ss ?? []), { key: uid(), page: sel, src: [], ar: '', latin: '', hint: '', count: '', unsure: false, alt: [], official: true, pick: null }]);

  const resolved = (s: EStep, m: StepMatch): StepMatch => {
    if (m.type !== 'ambiguous') return m;
    const e = m.options.find((o: CatalogEntry) => o.id === s.pick);
    return e ? { type: 'catalog', entry: e } : m;
  };
  const problems = (steps ?? []).map((s, i) => {
    const m = matches[i];
    if (!s.ar.trim() && !s.latin.trim()) return L('texte manquant');
    if (parseCount(s.count) === null) return L('nombre à préciser');
    if (s.unsure) return L('nombre à confirmer');
    if (m?.type === 'ambiguous' && !s.pick) return L('formule à choisir');
    return null;
  });
  const todo = problems.filter(Boolean).length;
  const canCreate = !!steps?.length && todo === 0 && !busy;

  const save = () => {
    if (!steps || !canCreate) return;
    const kept = new Map<number, string | undefined>();
    const photoOf = (page: number) => {
      if (!kept.has(page)) kept.set(page, pages[page]?.image && Platform.OS !== 'web' ? keepPhoto(pages[page].image!) : undefined);
      return kept.get(page);
    };
    const items = steps.map((s, i) => {
      const m = resolved(s, matches[i]);
      const own = s.pick === 'own';
      return { id: uid(), ...stepToItem({ ar: s.ar, latin: s.latin, hint: s.hint, count: parseCount(s.count)! }, m, s.official && !own, via, photoOf(s.page)) };
    });
    const z = create(name.trim() || L('Programme importé'), items);
    router.replace({ pathname: '/zikrs/edit', params: { id: z.id } });
  };

  const page = pages[sel];
  const multi = pages.length > 1;

  return (
    <Screen scroll={false} padded={false} bg={b.cream}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <LMuted>Photographiez une page, importez un PDF ou collez le texte d’un programme (ex. une formule et son nombre de répétitions par ligne). Zikru propose les étapes dans l’ordre : vous vérifiez, corrigez, puis créez la composition. Tout reste sur votre appareil.</LMuted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <LBtn icon="clipboard-outline" label="Coller" solid onPress={() => void fromPaste()} />
          {canPhoto ? <LBtn icon="camera-outline" label="Photographier" onPress={() => void fromPhoto(true)} /> : null}
          {canPhoto ? <LBtn icon="images-outline" label="Choisir des photos" onPress={() => void fromPhoto(false)} /> : null}
          <LBtn icon="document-outline" label="Importer un PDF" onPress={() => void fromPdf()} />
          {pages.length || paste ? <LBtn icon="close" label="Effacer" onPress={() => { reset(); setPaste(''); setVia('paste'); }} /> : null}
        </View>
        {Platform.OS === 'web' ? (
          <View style={{ backgroundColor: t.warningBg, borderRadius: 10, padding: 10 }}>
            <Text style={{ color: t.warning, fontSize: 13 }}>Sur le web, Zikru lit les PDF contenant du texte et le texte collé. Les photos et les PDF scannés ne peuvent pas être lus ici : utilisez l’app iPhone, ou « Texte en direct » / Google Lens pour copier le texte puis « Coller ».</Text>
          </View>
        ) : !ocr.ok || !pdfOk.text ? (
          <View style={{ backgroundColor: t.warningBg, borderRadius: 10, padding: 10 }}>
            <Text style={{ color: t.warning, fontSize: 13 }}>{!ocr.ok ? ocrNote(ocr.reason) : pdfNote(pdfOk.reason)}</Text>
          </View>
        ) : null}
        {note ? <Text style={{ color: b.ink, fontWeight: '700' }} accessibilityLiveRegion="polite">{note}</Text> : null}
        {busy ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} accessibilityLiveRegion="polite">
            <ActivityIndicator color={b.green} />
            <LMuted>{busy}</LMuted>
          </View>
        ) : null}

        {via === 'paste' ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={paste}
              onChangeText={setPaste}
              placeholder={L('Collez ou saisissez le programme ici, une étape par ligne')}
              placeholderTextColor={b.inkMuted}
              multiline
              autoCorrect={false}
              spellCheck={false}
              style={[field(), { minHeight: 140, fontSize: 18, textAlign: 'right', writingDirection: 'rtl', paddingVertical: 8, textAlignVertical: 'top' }]}
              accessibilityLabel={L('Texte du programme')}
            />
            <View style={{ flexDirection: 'row' }}>
              <LBtn icon="search-outline" label="Détecter les étapes" solid disabled={!paste.trim()} onPress={analysePaste} />
            </View>
          </View>
        ) : null}

        {pages.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
            {/* Source : page choisie (texte collé : la source est le champ ci-dessus) */}
            {via !== 'paste' ? (
            <View style={{ flexGrow: 1, flexBasis: 260, minWidth: 220, gap: 8 }}>
              {multi ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="tablist">
                  {pages.map((p, i) => (
                    <Pressable
                      key={i}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: i === sel }}
                      accessibilityLabel={L('Page {n}', { n: i + 1 }) + (p.on ? '' : ' · ' + L('non utilisée'))}
                      onPress={() => setSel(i)}
                      style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 20, justifyContent: 'center', borderWidth: 1, borderColor: i === sel ? b.green : b.line, backgroundColor: i === sel ? b.green : b.paper, opacity: p.on ? 1 : 0.6 }}
                    >
                      <Text style={{ color: i === sel ? '#fff' : b.ink, fontWeight: '700', fontSize: 13 }}>{L('Page {n}', { n: i + 1 })}{p.state === 'scanned' ? ' ·  ⎙' : ''}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {total > pages.length ? <LMuted style={{ fontSize: 12 }}>{L('Seules les {n} premières pages sont lues.', { n: pages.length })}</LMuted> : null}
              {page ? (
                <View style={card()}>
                  {page.image ? (
                    <Image source={{ uri: page.image }} resizeMode="contain" style={{ width: '100%', height: 360, borderRadius: 10, backgroundColor: '#fff' }} accessible accessibilityRole="image" accessibilityLabel={L('Page source {n} (gardée sur l’appareil)', { n: sel + 1 })} />
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: page.image ? 8 : 0, alignItems: 'center' }}>
                    {multi ? <LBtn icon={page.on ? 'checkbox-outline' : 'square-outline'} label={page.on ? 'Page utilisée' : 'Page non utilisée'} active={page.on} onPress={() => togglePage(sel)} /> : null}
                    {page.state === 'scanned' || page.state === 'failed' ? (
                      pdfOk.ocr && via === 'pdf' ? (
                        <LBtn icon="scan-outline" label="Lire cette page (sur l’appareil)" solid disabled={!!busy} onPress={() => void ocrPage(sel)} />
                      ) : (
                        <LMuted style={{ fontSize: 12, flexShrink: 1 }}>{page.state === 'failed' ? 'Aucun texte lu sur cette page.' : page.garbled ? 'Texte mal encodé dans le PDF : il ne peut pas être lu ici.' : 'Page scannée : elle ne peut pas être lue ici.'}</LMuted>
                      )
                    ) : null}
                  </View>
                  {page.text ? (
                    <View style={{ marginTop: 8 }}>
                      <LMuted style={{ fontSize: 12, fontWeight: '700' }}>Texte lu sur cette page (lecture seule)</LMuted>
                      <Arabic size={18} style={{ marginTop: 4 }}>
                        {page.text}
                      </Arabic>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            ) : null}

            {/* Étapes détectées */}
            <View style={{ flexGrow: 2, flexBasis: 320, minWidth: 260, gap: 10 }}>
              {steps ? (
                <>
                  <Text style={{ color: b.ink, fontWeight: '900', fontSize: 16 }} accessibilityRole="header">
                    {L('Étapes détectées : {n}', { n: steps.length })}
                  </Text>
                  <LMuted style={{ fontSize: 12 }}>Vérifiez chaque étape avec la page source. Ce programme restera personnel : il n’est pas validé par Zikru ni par une voie.</LMuted>
                  {steps.map((s, i) => {
                    const m = matches[i] ?? { type: 'none', reason: 'empty' };
                    const r = resolved(s, m);
                    const officialText = r.type === 'catalog' ? r.entry.ar : r.type === 'quran' ? r.p.official : null;
                    const n = parseCount(s.count);
                    return (
                      <View key={s.key} style={card()}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: b.green, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#fff', fontWeight: '900' }}>{i + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Badge m={m} s={s} />
                          </View>
                          {multi ? (
                            <Pressable accessibilityRole="button" accessibilityLabel={L('Voir la page {n}', { n: s.page + 1 })} onPress={() => setSel(s.page)} hitSlop={6} style={{ minHeight: 32, justifyContent: 'center' }}>
                              <Text style={{ color: b.green, fontWeight: '700', fontSize: 12 }}>{L('Page {n}', { n: s.page + 1 })}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        {s.src.length ? (
                          <LMuted style={{ fontSize: 12, marginTop: 6 }} numberOfLines={3}>
                            {L('Lu : « {t} »', { t: s.src.join(' / ') })}
                          </LMuted>
                        ) : null}
                        {s.hint && s.hint !== s.latin ? <LMuted style={{ fontSize: 12 }}>{L('Titre lu : {t}', { t: s.hint })}</LMuted> : null}
                        {s.latin && !s.ar ? (
                          <TextInput value={s.latin} onChangeText={(v) => upd(s.key, { latin: v, pick: null })} style={[field(), { marginTop: 8 }]} accessibilityLabel={L('Texte de l’étape {n}', { n: i + 1 })} />
                        ) : (
                          <TextInput
                            value={s.ar}
                            onChangeText={(v) => upd(s.key, { ar: v, pick: null })}
                            placeholder="النص"
                            placeholderTextColor={b.inkMuted}
                            multiline
                            autoCorrect={false}
                            spellCheck={false}
                            style={[field(), { marginTop: 8, fontSize: 20, textAlign: 'right', writingDirection: 'rtl', paddingVertical: 6 }]}
                            accessibilityLabel={L('Texte arabe de l’étape {n}', { n: i + 1 })}
                          />
                        )}
                        {m.type === 'ambiguous' ? (
                          <View style={{ gap: 6, marginTop: 8 }}>
                            {m.options.map((o) => (
                              <LBtn key={o.id} icon={s.pick === o.id ? 'radio-button-on' : 'radio-button-off'} label={o.label} active={s.pick === o.id} onPress={() => upd(s.key, { pick: o.id })} />
                            ))}
                            <LBtn icon={s.pick === 'own' ? 'radio-button-on' : 'radio-button-off'} label="Aucune : garder mon texte (non vérifié)" active={s.pick === 'own'} onPress={() => upd(s.key, { pick: 'own' })} />
                          </View>
                        ) : null}
                        {officialText && s.pick !== 'own' ? (
                          <View style={{ marginTop: 8, gap: 6 }}>
                            {s.official ? (
                              <>
                                <LMuted style={{ fontSize: 12, fontWeight: '700' }}>Texte qui sera enregistré (texte officiel)</LMuted>
                                <Arabic size={18}>{officialText}</Arabic>
                              </>
                            ) : null}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                              <LBtn icon={s.official ? 'radio-button-on' : 'radio-button-off'} label="Texte officiel" active={s.official} onPress={() => upd(s.key, { official: true })} />
                              <LBtn icon={!s.official ? 'radio-button-on' : 'radio-button-off'} label="Garder mon texte (non vérifié)" active={!s.official} onPress={() => upd(s.key, { official: false })} />
                            </View>
                          </View>
                        ) : null}
                        {m.type === 'near' ? <LMuted style={{ fontSize: 12, marginTop: 6 }}>{L('{n} mot(s) diffèrent du Coran {r} : corrigez le texte ou gardez-le comme texte personnel.', { n: m.p.diff, r: m.p.ref })}</LMuted> : null}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }}>
                          <Text style={{ color: b.ink, fontWeight: '700' }}>×</Text>
                          <TextInput
                            value={s.count}
                            onChangeText={(v) => upd(s.key, { count: v, unsure: false })}
                            keyboardType="number-pad"
                            placeholder="?"
                            placeholderTextColor={b.inkMuted}
                            style={[field(), { width: 96, textAlign: 'center', fontSize: 16, borderColor: n === null || s.unsure ? t.warning : b.line }]}
                            accessibilityLabel={L('Nombre de répétitions de l’étape {n}', { n: i + 1 })}
                          />
                          {n === null ? <Text style={{ color: t.warning, fontWeight: '700', fontSize: 12 }}>Nombre à préciser</Text> : null}
                          {s.unsure && n !== null ? <LBtn icon="checkmark" label="Confirmer le nombre" onPress={() => upd(s.key, { unsure: false })} /> : null}
                          {s.alt.length ? <LMuted style={{ fontSize: 12 }}>{L('Autre nombre lu : {x}', { x: s.alt.join(', ') })}</LMuted> : null}
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                          <Icon icon="arrow-up" label={L('Monter l’étape {n}', { n: i + 1 })} disabled={i === 0} onPress={() => move(i, -1)} />
                          <Icon icon="arrow-down" label={L('Descendre l’étape {n}', { n: i + 1 })} disabled={i === steps.length - 1} onPress={() => move(i, 1)} />
                          {s.src.length > 1 ? <Icon icon="git-branch-outline" label={L('Séparer l’étape {n} ligne par ligne', { n: i + 1 })} onPress={() => split(s)} /> : null}
                          <Icon icon="trash-outline" label={L('Supprimer l’étape {n}', { n: i + 1 })} onPress={() => del(s.key)} />
                        </View>
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <LBtn icon="add" label="Ajouter une étape" onPress={addEmpty} />
                    {ignored.length ? <LBtn icon={showIgnored ? 'chevron-up' : 'chevron-down'} label={L('Lignes non retenues ({n})', { n: ignored.length })} onPress={() => setShowIgnored(!showIgnored)} /> : null}
                  </View>
                  {showIgnored
                    ? ignored.map((l, j) => (
                        <View key={j} style={[card(), { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                          <Text style={{ color: b.ink, flex: 1 }}>{l.text}</Text>
                          <LBtn icon="add" label="Ajouter comme étape" onPress={() => addIgnored(l)} />
                        </View>
                      ))
                    : null}
                  <TextInput value={name} onChangeText={setName} placeholder={L('Programme importé')} placeholderTextColor={b.inkMuted} style={field()} accessibilityLabel={L('Nom de la composition')} />
                  {todo ? (
                    <Text style={{ color: t.warning, fontWeight: '700', fontSize: 13 }} accessibilityLiveRegion="polite">
                      {L('{n} étape(s) à compléter : {x}', { n: todo, x: [...new Set(problems.filter(Boolean))].join(', ') })}
                    </Text>
                  ) : null}
                  <LBtn icon="checkmark-circle" label="Créer la composition" solid disabled={!canCreate} onPress={save} />
                  <LMuted style={{ fontSize: 12 }}>Rien n’est enregistré avant de toucher « Créer la composition ». Vous pourrez encore la modifier ensuite.</LMuted>
                </>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ocrNote(reason: string | null): string {
  return reason === 'android'
    ? L('Sur Android, la reconnaissance de l’écriture arabe sur l’appareil n’est pas encore disponible : copiez le texte (ex. Google Lens) puis touchez « Coller ».')
    : reason === 'no-arabic'
      ? L('Cette version d’iOS ne reconnaît pas l’écriture arabe : utilisez « Texte en direct » puis « Coller ».')
      : reason === 'needs-build'
        ? L('La lecture des photos et des PDF arrivera avec la prochaine version de l’app. En attendant, copiez le texte puis touchez « Coller ».')
        : L('Les photos ne peuvent pas être lues ici : copiez le texte puis touchez « Coller ».');
}
function pdfNote(reason: string | undefined): string {
  return reason === 'android' ? L('Sur Android, l’import de PDF n’est pas encore disponible : copiez le texte du PDF puis touchez « Coller ».') : L('La lecture des PDF arrivera avec la prochaine version de l’app. En attendant, copiez le texte puis touchez « Coller ».');
}
