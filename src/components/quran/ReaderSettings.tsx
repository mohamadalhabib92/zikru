import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { NURANI_LETTERS, NURANI_MNEMONIC } from '@/lib/nuraniyya';
import { Text } from '@/ui/Text';
import { readerPrefs, type ReaderPrefs } from '@/lib/quran-store';
import { RECITERS } from '@/lib/recitation';
import { useShared } from '@/lib/shared-state';
import { fonts } from '@/ui/theme';
import { THEMES, type Pal } from './palette';
import { QChoice, QLabel, QStepper, Sheet } from './Sheet';
import { NuraniText } from './NuraniText';
import { L } from '@/lib/l10n';

export const RATES = [0.75, 1, 1.25, 1.5];
const SAMPLE = 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ ۝٢';
const SAMPLE_MUQ = 'الٓمٓ ۝١'; // 2:1 (Tanzil uthmani)

function Row({ label, value, onChange, pal, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; pal: Pal; hint?: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={typeof label === "string" ? L(label) : label} onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: pal.ink, fontWeight: '600', fontSize: 15 }}>{label}</Text>
        {hint ? <Text style={{ color: pal.muted, fontSize: 12 }}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: pal.accent, false: pal.line }} />
    </Pressable>
  );
}

/** Réglages d’affichage et de récitation du lecteur. */
export function ReaderSettings({ visible, onClose, pal }: { visible: boolean; onClose: () => void; pal: Pal }) {
  const [p, set] = useShared(readerPrefs);
  const patch = (x: Partial<ReaderPrefs>) => set((o) => ({ ...o, ...x }));
  const [info, setInfo] = useState(false);
  const warsh = RECITERS.find((r) => r.id === p.reciter)?.riwaya === 'Warsh';
  return (
    <Sheet visible={visible} onClose={onClose} title="Affichage et récitation" pal={pal}>
      <View style={{ backgroundColor: pal.card, borderRadius: 16, borderWidth: 1, borderColor: pal.line, padding: 14 }}>
        <Text style={{ color: pal.ink, fontFamily: fonts.quran, fontSize: p.arSize, lineHeight: Math.round(p.arSize * p.lineH), textAlign: 'right', writingDirection: 'rtl' }}>
          <NuraniText text={SAMPLE_MUQ} surah={2} ayah={1} nurani={p.nurani} muqattaat={p.muqattaat} gold={pal.gold} ink={pal.ink} />{' '}
          <NuraniText text={SAMPLE} surah={1} ayah={2} nurani={p.nurani} muqattaat={false} gold={pal.gold} ink={pal.ink} />
        </Text>
        {p.showTr ? <Text style={{ color: pal.muted, fontSize: p.trSize, lineHeight: Math.round(p.trSize * 1.5) }}>Louange à Allah, Seigneur de l’univers.</Text> : null}
      </View>
      <QLabel pal={pal}>THÈME DE LECTURE</QLabel>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {THEMES.map((t) => (
          <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={L('Thème {t}', { t: L(t.label) })} accessibilityState={{ selected: p.theme === t.id }} onPress={() => patch({ theme: t.id })} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.swatch, borderWidth: p.theme === t.id ? 3 : 1, borderColor: p.theme === t.id ? pal.accent : pal.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: t.id === 'night' ? '#E6E1D3' : '#3A2E1C', fontWeight: '800' }}>{t.id === 'auto' ? 'A' : 'ع'}</Text>
            </View>
            <Text style={{ color: p.theme === t.id ? pal.accent : pal.muted, fontSize: 12, fontWeight: '700' }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <QLabel pal={pal}>TAILLE DU TEXTE</QLabel>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: pal.ink, flex: 1 }}>Arabe</Text>
          <QStepper label="Taille de l’arabe" value={p.arSize} min={20} max={52} step={2} onChange={(v) => patch({ arSize: v })} pal={pal} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: pal.ink, flex: 1 }}>Traduction</Text>
          <QStepper label="Taille de la traduction" value={p.trSize} min={12} max={24} onChange={(v) => patch({ trSize: v })} pal={pal} />
        </View>
      </View>
      <QLabel pal={pal}>INTERLIGNE</QLabel>
      <QChoice options={[{ label: 'Serré', value: 1.8 }, { label: 'Normal', value: 2.1 }, { label: 'Aéré', value: 2.5 }]} value={p.lineH} onChange={(v) => patch({ lineH: v })} pal={pal} />
      <QLabel pal={pal}>AFFICHAGE</QLabel>
      <Row label="Traduction" value={p.showTr} onChange={(v) => patch({ showTr: v })} pal={pal} />
      <Row label="Translittération" value={p.showTl} onChange={(v) => patch({ showTl: v })} pal={pal} hint="Lecture phonétique latine (aide, pas un substitut à l’arabe)" />
      <Row label="Écran toujours allumé" value={p.keepAwake} onChange={(v) => patch({ keepAwake: v })} pal={pal} hint="Pendant la lecture uniquement" />
      <Row label="Suivre la récitation" value={p.follow} onChange={(v) => patch({ follow: v })} pal={pal} hint="Défile jusqu’au verset récité" />
      <Row label="Lettres lumineuses" value={p.nurani} onChange={(v) => patch({ nurani: v })} pal={pal} hint="Les 14 lettres des ouvertures de sourates, en doré discret" />
      <Row label="Lettres isolées d’ouverture" value={p.muqattaat} onChange={(v) => patch({ muqattaat: v })} pal={pal} hint="Souligne les lettres isolées (Alif Lām Mīm…) au début de 29 sourates" />
      {p.nurani || p.muqattaat ? (
        <Pressable accessibilityRole="button" onPress={() => setInfo((x) => !x)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: pal.accent, fontWeight: '700' }}>{info ? 'Masquer la fiche' : 'En savoir plus sur les lettres lumineuses'}</Text>
        </Pressable>
      ) : null}
      {info && (p.nurani || p.muqattaat) ? <NuraniInfo pal={pal} /> : null}
      <QLabel pal={pal}>RÉCITATEUR</QLabel>
      <View style={{ gap: 6 }}>
        {RECITERS.map((r) => (
          <Pressable key={r.id} accessibilityRole="radio" accessibilityState={{ checked: p.reciter === r.id }} onPress={() => patch({ reciter: r.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: p.reciter === r.id ? pal.accent : pal.line, backgroundColor: pal.card }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: p.reciter === r.id ? pal.accent : pal.muted, alignItems: 'center', justifyContent: 'center' }}>
              {p.reciter === r.id ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: pal.accent }} /> : null}
            </View>
            <Text style={{ color: pal.ink, fontWeight: '600', flex: 1 }}>{r.name}</Text>
            <Text style={{ color: r.riwaya === 'Warsh' ? pal.gold : pal.muted, fontSize: 12, fontWeight: '700' }}>{`${r.style} · ${r.riwaya}`}</Text>
          </Pressable>
        ))}
      </View>
      {warsh ? <Text style={{ color: pal.gold, fontSize: 12, marginTop: 8 }}>Récitation selon la riwaya de Warsh ‘an Nafi‘ ; le texte affiché reste celui de Hafs ‘an ‘Asim (pas de texte Warsh sous licence libre disponible).</Text> : null}
      <QLabel pal={pal}>VITESSE</QLabel>
      <QChoice options={RATES.map((r) => ({ label: `×${r}`, value: r }))} value={p.rate} onChange={(v) => patch({ rate: v })} pal={pal} />
      <Text style={{ color: pal.muted, fontSize: 11, marginTop: 14 }}>Audio diffusé verset par verset depuis EveryAyah.com (secours : Islamic Network). Rien n’est intégré à l’app.</Text>
    </Sheet>
  );
}

/**
 * Fiche d’information sobre et sourcée. Aucune vertu n’est attribuée à ces lettres : on s’en tient aux faits
 * (définition, nombre, formule mnémotechnique) et à l’avis le plus répandu chez les exégètes.
 */
function NuraniInfo({ pal }: { pal: Pal }) {
  return (
    <View style={{ backgroundColor: pal.card, borderRadius: 14, borderWidth: 1, borderColor: pal.line, padding: 12, gap: 6, marginTop: 4 }}>
      <Text style={{ color: pal.gold, fontFamily: fonts.quran, fontSize: 24, lineHeight: 48, textAlign: 'center', writingDirection: 'rtl' }}>{NURANI_LETTERS.join(' ')}</Text>
      <Text style={{ color: pal.ink, fontSize: 13, lineHeight: 19 }}>Vingt-neuf sourates s’ouvrent par des lettres isolées (al-ḥurūf al-muqaṭṭaʿa), comme Alif Lām Mīm. Sans les répétitions, elles se ramènent à 14 lettres, soit la moitié de l’alphabet ; on les appelle souvent « lettres lumineuses » (al-ḥurūf an-nūrāniyya).</Text>
      <Text style={{ color: pal.ink, fontSize: 13, lineHeight: 19 }}>Formule mnémotechnique traditionnelle :</Text>
      <Text style={{ color: pal.ink, fontFamily: fonts.quran, fontSize: 20, lineHeight: 42, textAlign: 'center', writingDirection: 'rtl' }}>{NURANI_MNEMONIC}</Text>
      <Text style={{ color: pal.ink, fontSize: 13, lineHeight: 19 }}>Leur sens exact : « Allah en connaît mieux le sens » est l’avis rapporté de nombreux savants. Az-Zamakhsharī (al-Kashshāf) et Ibn Kathīr (Tafsīr, début de la sourate al-Baqara) relèvent qu’elles regroupent la moitié des lettres et y voient un signe de l’inimitabilité du Coran, composé de ces mêmes lettres.</Text>
      <Text style={{ color: pal.muted, fontSize: 12, lineHeight: 17 }}>Affichage : alif sous toutes ses formes (ا ٱ آ أ إ) et ى comptent ; ء ؤ ئ et ة ne comptent pas. Le texte coranique n’est pas modifié, seule la couleur change.</Text>
    </View>
  );
}
