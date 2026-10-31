import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { confirmAsk } from '@/components/community/parts';
import { formatBytes, entry, isComplete, reciterSummary, remainingBytes, sizeOf, totalBytes } from '@/lib/audio-dl-core';
import { cancelDownloads, deleteDownloadedReciter, deleteDownloadedSurah, dlManifest, dlSizes, measureSurahs, queueDownload, useDownloads } from '@/lib/audio-dl';
import { freeSpace } from '@/lib/audio-store';
import { L, useUiLang } from '@/lib/l10n';
import { RECITATION_SOURCE } from '@/lib/quran-licenses';
import { readerPrefs } from '@/lib/quran-store';
import { RECITERS, reciterById } from '@/lib/recitation';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import { Container } from '@/ui/ds';
import { Chip, Ionicons } from '@/ui/kit';
import { alpha, brand as b, theme as t } from '@/ui/theme';

/**
 * Téléchargements audio pour l’écoute hors ligne : par récitateur et par sourate, taille affichée
 * (mesurée avant téléchargement), suppression par sourate ou par récitateur, espace libre.
 */
export default function Downloads() {
  const lang = useUiLang();
  const [rp] = useShared(readerPrefs);
  const [m] = useShared(dlManifest);
  const [sizes] = useShared(dlSizes);
  const dl = useDownloads();
  const [rid, setRid] = useState(rp.reciter);
  const [free, setFree] = useState<number | null>(null);
  const [prog, setProg] = useState<[number, number] | null>(null);
  const r = reciterById(rid);
  const sum = reciterSummary(m, rid);
  const all = useMemo(() => SURAHS.map((x) => x[0]), []);
  const missing = all.filter((s) => !isComplete(entry(m, rid, s)));
  const est = sizeOf(sizes, rid, missing);
  const fmt = (n: number) => formatBytes(n, lang);

  useEffect(() => {
    void freeSpace().then(setFree);
  }, [m]);

  const measure = (list: number[]) => {
    setProg([0, list.length]);
    void measureSurahs(rid, list, (d, t) => setProg([d, t])).finally(() => setProg(null));
  };
  const queued = (s: number) => dl.queue.some((j) => j.rid === rid && j.s === s);
  const activeHere = dl.active && dl.active.rid === rid ? dl.active : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: b.cream }} contentContainerStyle={{ paddingBottom: 120 }}>
      <Container max={820} style={{ padding: 16, gap: 12 }}>
        {/* Espace */}
        <View style={{ backgroundColor: b.paper, borderRadius: 18, borderWidth: 1, borderColor: b.line, padding: 14, gap: 4 }}>
          <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{L('Espace utilisé : {n}', { n: fmt(totalBytes(m)) })}</Text>
          <Text style={{ color: b.inkMuted, fontSize: 13 }}>{free != null ? L('Espace libre sur l’appareil : {n}', { n: fmt(free) }) : L('Espace libre : inconnu sur ce navigateur')}</Text>
          {Platform.OS === 'web' ? <Text style={{ color: b.inkMuted, fontSize: 12 }}>Sur le web, l’écoute hors ligne fonctionne dans l’app installée (PWA) ; le navigateur peut libérer cet espace s’il en manque.</Text> : null}
        </View>

        {/* Récitateur */}
        <Text style={{ color: b.inkMuted, fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>RÉCITATEUR</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {RECITERS.map((x) => {
            const sm = reciterSummary(m, x.id);
            return <Chip key={x.id} label={sm.bytes ? `${x.name} · ${fmt(sm.bytes)}` : x.name} active={x.id === rid} onPress={() => setRid(x.id)} />;
          })}
        </View>

        <View style={{ backgroundColor: b.paper, borderRadius: 18, borderWidth: 1, borderColor: b.line, padding: 14, gap: 10 }}>
          <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{r.name}</Text>
          <Text style={{ color: b.inkMuted, fontSize: 13 }}>
            {L('{c} sourates complètes · {p} en cours · {n}', { c: sum.complete, p: sum.partial, n: fmt(sum.bytes) })}
          </Text>
          {missing.length ? (
            <Text style={{ color: b.inkMuted, fontSize: 13 }}>
              {est.unknown === 0
                ? L('Reste à télécharger : {n}', { n: fmt(est.bytes) })
                : est.bytes
                  ? L('Reste à télécharger : au moins {n} ({u} sourates non mesurées)', { n: fmt(est.bytes), u: est.unknown })
                  : L('Taille non mesurée')}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {missing.length && est.unknown ? (
              <Btn icon="resize-outline" label={prog ? L('Mesure… {d}/{t}', { d: prog[0], t: prog[1] }) : L('Mesurer les tailles')} onPress={() => measure(missing)} disabled={!!prog || !!dl.measuring} />
            ) : null}
            {missing.length ? <Btn icon="cloud-download-outline" label={L('Tout télécharger')} onPress={() => confirmAsk('Tout télécharger ?', est.unknown ? L('Taille estimée inconnue : mesurez d’abord pour la connaître. Préférez le Wi-Fi.') : L('Environ {n}. Préférez le Wi-Fi.', { n: fmt(est.bytes) }), 'Télécharger', () => queueDownload(rid, missing))} /> : null}
            {sum.bytes || sum.partial ? <Btn icon="trash-outline" label={L('Tout supprimer')} danger onPress={() => confirmAsk('Supprimer les téléchargements ?', L('{r} : {n} seront libérés.', { r: r.name, n: fmt(sum.bytes) }), 'Supprimer', () => void deleteDownloadedReciter(rid))} /> : null}
          </View>
          {prog ? <Text style={{ color: b.inkMuted, fontSize: 12 }}>Mesure par requêtes légères (en-têtes uniquement), une par verset.</Text> : null}
        </View>

        {/* En cours */}
        {dl.active ? (
          <View accessibilityLiveRegion="polite" style={{ backgroundColor: alpha(b.green, 0.08), borderRadius: 18, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={b.green} />
              <Text style={{ color: b.ink, fontWeight: '700', flex: 1 }}>
                {L('{r} · Sourate {s} : verset {a}/{t}', { r: reciterById(dl.active.rid).name, s: SURAHS[dl.active.s - 1][2], a: dl.active.a, t: dl.active.total })}
              </Text>
              <Btn icon="close" label={L('Annuler')} onPress={cancelDownloads} />
            </View>
            <Bar v={(dl.active.a - 1) / dl.active.total} />
            {dl.queue.length ? <Text style={{ color: b.inkMuted, fontSize: 12 }}>{L('{n} sourates en attente', { n: dl.queue.length })}</Text> : null}
          </View>
        ) : null}
        {dl.error ? <Text style={{ color: t.danger, fontSize: 13 }}>{L('Téléchargement interrompu : {e}', { e: dl.error })}</Text> : null}

        {/* Sourates */}
        {SURAHS.map(([s, , name, , n]) => {
          const e = entry(m, rid, s);
          const done = isComplete(e);
          const rem = remainingBytes(m, sizes, rid, s);
          const here = activeHere?.s === s;
          const status = done
            ? L('Téléchargée · {n}', { n: fmt(e!.bytes) })
            : here
              ? L('Téléchargement… {a}/{t}', { a: activeHere!.a, t: n })
              : queued(s)
                ? L('En attente')
                : e
                  ? L('{v}/{t} versets · {n}', { v: e.v, t: n, n: fmt(e.bytes) })
                  : rem != null
                    ? fmt(rem)
                    : L('{t} versets', { t: n });
          return (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: b.inkMuted, width: 30, textAlign: 'center', fontWeight: '700' }}>{s}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: b.ink, fontWeight: '700' }} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={{ color: done ? b.green : b.inkMuted, fontSize: 12 }}>{status}</Text>
              </View>
              {done || e ? (
                <IconBtn icon="trash-outline" label={L('Supprimer la sourate {s}', { s: name })} onPress={() => void deleteDownloadedSurah(rid, s)} />
              ) : null}
              {!done && !here && !queued(s) ? <IconBtn icon="cloud-download-outline" label={L('Télécharger la sourate {s}', { s: name })} onPress={() => queueDownload(rid, [s])} /> : null}
              {done ? <Ionicons name="checkmark-circle" size={22} color={b.green} /> : null}
            </View>
          );
        })}

        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(RECITATION_SOURCE.url)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: b.inkMuted, fontSize: 12 }}>
            {L('Source audio : {s}. Les fichiers restent sur cet appareil et ne sont pas partagés. Conditions de réutilisation hors ligne : {l}.', { s: RECITATION_SOURCE.name, l: RECITATION_SOURCE.licence })}
          </Text>
        </Pressable>
      </Container>
    </ScrollView>
  );
}

function Bar({ v }: { v: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }} style={{ height: 6, borderRadius: 3, backgroundColor: alpha(b.green, 0.15), overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(2, Math.min(100, v * 100))}%`, height: 6, backgroundColor: b.green }} />
    </View>
  );
}

function Btn({ icon, label, onPress, danger, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const c = danger ? t.danger : b.green;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: alpha(c, 0.4), opacity: disabled ? 0.5 : pressed ? 0.8 : 1 })}>
      <Ionicons name={icon} size={18} color={c} />
      <Text style={{ color: c, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function IconBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? alpha(b.green, 0.1) : 'transparent' })}>
      <Ionicons name={icon} size={20} color={b.green} />
    </Pressable>
  );
}
