import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { getTafsir, TAFSIRS } from '@/lib/quran-reader-data';
import { shared, useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import type { Pal } from './palette';
import { QBtn, QChoice, Sheet } from './Sheet';

const tafsirChoice = shared<string>('qr-tafsir', 'muyassar');

/** Tafsir du verset, à la demande (mis en cache après la première lecture). */
export function TafsirSheet({ verse, onClose, pal, arabic }: { verse: { s: number; a: number } | null; onClose: () => void; pal: Pal; arabic?: string }) {
  const [id, setId] = useShared(tafsirChoice);
  const [txt, setTxt] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!verse) return;
    let alive = true;
    setTxt(null);
    setErr(false);
    getTafsir(id, verse.s, verse.a)
      .then((t) => alive && setTxt(t))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [verse?.s, verse?.a, id, n]);
  if (!verse) return null;
  const t = TAFSIRS.find((x) => x.id === id) ?? TAFSIRS[0];
  const rtl = t.lang === 'ar';
  return (
    <Sheet visible onClose={onClose} pal={pal} title={`Tafsir · ${SURAHS[verse.s - 1][2]} ${verse.s}:${verse.a}`} subtitle={t.name}>
      <QChoice options={TAFSIRS.map((x) => ({ label: x.name.replace(/^Tafsir /, ''), value: x.id }))} value={id} onChange={setId} pal={pal} />
      {arabic ? <Text style={{ color: pal.ink, fontSize: 20, lineHeight: 40, textAlign: 'right', writingDirection: 'rtl', marginTop: 14, fontFamily: 'AmiriQuran_400Regular' }}>{arabic}</Text> : null}
      <View style={{ backgroundColor: pal.card, borderRadius: 16, borderWidth: 1, borderColor: pal.line, padding: 14, marginTop: 12, minHeight: 120, justifyContent: 'center' }}>
        {txt ? (
          <Text selectable style={{ color: pal.ink, fontSize: rtl ? 18 : 15, lineHeight: rtl ? 34 : 23, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }}>
            {txt}
          </Text>
        ) : err ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Text style={{ color: pal.muted, textAlign: 'center' }}>Tafsir indisponible hors connexion (il reste ensuite en cache).</Text>
            <QBtn icon="refresh" label="Réessayer" onPress={() => setN((x) => x + 1)} pal={pal} />
          </View>
        ) : (
          <ActivityIndicator color={pal.accent} />
        )}
      </View>
      <Text style={{ color: pal.muted, fontSize: 11, marginTop: 10 }}>Source : {t.src}. Les tafsirs sont donnés tels que publiés ; pour une question de jurisprudence, référez-vous à un savant.</Text>
    </Sheet>
  );
}
