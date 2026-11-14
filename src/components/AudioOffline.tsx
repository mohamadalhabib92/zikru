import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { editionFor } from '@/lib/quran-licenses';
import { downloadTranslation } from '@/lib/quran-offline';
import { ensureReciterDownload, setDownloadGate, useDownloads, dlManifest } from '@/lib/audio-dl';
import { reciterSummary } from '@/lib/audio-dl-core';
import type { NetKind } from '@/lib/audio-auto';
import { readerPrefs } from '@/lib/quran-store';
import { reciterById } from '@/lib/recitation';
import { useSettings } from '@/lib/settings';
import { useShared } from '@/lib/shared-state';
import { L } from '@/lib/l10n';
import { useRouter } from 'expo-router';
import { Button, Card, H2, Muted, Spacer, Toggle } from '@/ui/kit';

function kindOf(type: string | null, connected: boolean | null): NetKind {
  if (connected === false) return 'none';
  if (type === 'wifi' || type === 'ethernet') return 'wifi';
  if (type === 'cellular') return 'cellular';
  return Platform.OS === 'web' ? 'wifi' : 'unknown';
}

/** Après le premier lancement : une traduction non incluse, puis la récitation du récitateur choisi. */
export function AudioPrefetch() {
  const { s } = useSettings();
  const [rp] = useShared(readerPrefs);
  const [net, setNet] = useState<NetKind>('unknown');
  useEffect(() => {
    const apply = (info: { type: string; isConnected: boolean | null }) => setNet(kindOf(info.type, info.isConnected));
    const sub = NetInfo.addEventListener(apply);
    void NetInfo.fetch().then(apply);
    return () => sub();
  }, []);
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setDownloadGate({ wifiOnly: s.audioCellular !== true, net, free: null });
      void ensureReciterDownload(rp.reciter);
    };
    tick();
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') tick();
    });
    return () => {
      alive = false;
      app.remove();
    };
  }, [s.audioCellular, net, rp.reciter]);
  useEffect(() => {
    const ed = editionFor(s.lang).id;
    if (ed === 'en.pickthall') return;
    if (s.audioCellular !== true && net !== 'wifi') return;
    void downloadTranslation(ed).catch(() => {});
  }, [s.lang, s.audioCellular, net]);
  return null;
}

const HOLD = {
  wifi: 'En attente du Wi-Fi',
  offline: 'Hors ligne : le téléchargement reprendra',
  disk: 'Pas assez d’espace libre (200 Mo à garder)',
  ok: '',
} as const;

export function AudioOfflineCard() {
  const { s, set } = useSettings();
  const router = useRouter();
  const [m] = useShared(dlManifest);
  const dl = useDownloads();
  const [rp] = useShared(readerPrefs);
  const name = reciterById(rp.reciter).name;
  const sum = reciterSummary(m, rp.reciter);
  const done = sum.complete;
  const hold = dl.hold === 'ok' ? '' : L(HOLD[dl.hold]);
  const current = dl.active ? L('{name} · sourate {s}', { name: reciterById(dl.active.rid).name, s: dl.active.s }) : '';
  return (
    <Card>
      <H2>{L('Récitation hors ligne')}</H2>
      <Muted>{L('Le récitateur choisi se télécharge tout seul, en Wi-Fi. La sourate ouverte passe en premier. Les fichiers ne vont pas dans iCloud.')}</Muted>
      <Spacer h={8} />
      <Muted>{current || hold || L('{c}/114 sourates · {name}', { c: done, name })}</Muted>
      <Spacer h={8} />
      <Toggle label={L('Autoriser le réseau mobile')} value={s.audioCellular === true} onChange={(v) => set({ audioCellular: v })} />
      <Spacer h={8} />
      <Button title={L('Téléchargements audio')} icon="cloud-download-outline" variant="secondary" onPress={() => router.push('/quran/downloads')} />
    </Card>
  );
}
