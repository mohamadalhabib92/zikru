/**
 * Récitation verset par verset (EveryAyah, secours Islamic Network) avec une seule instance expo-audio et une file JS :
 * répétitions, pause entre les versets, boucle A-B, vitesse, suivi du verset en cours.
 * En arrière-plan (écran verrouillé), iOS peut retarder les pauses programmées : la lecture continue, l’écart peut varier.
 */
import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { enableBackgroundAudio } from '@/components/PlayerBar';
import { ayahFallbackUrl, ayahUrl, gapMs, reciterById, type Gap, type Step } from './recitation';
import { SURAHS } from './surahs';

export type RecState = { queue: Step[]; pos: number; playing: boolean; loading: boolean; error: string | null; loop: boolean };
const IDLE: RecState = { queue: [], pos: -1, playing: false, loading: false, error: null, loop: false };

export function useRecitation(opts: { reciter: string; rate: number; gap?: Gap }) {
  const player = useAudioPlayer(null, { updateInterval: 300 });
  const [st, setSt] = useState<RecState>(IDLE);
  const S = useRef(st);
  S.current = st;
  const O = useRef(opts);
  O.current = opts;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTried = useRef(false);
  const loadWatch = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    if (loadWatch.current) clearTimeout(loadWatch.current);
    timer.current = loadWatch.current = null;
  };
  const update = (p: Partial<RecState>) => setSt((s) => ({ ...s, ...p }));

  const load = useCallback(
    (pos: number, queue = S.current.queue, useFallback = false) => {
      clear();
      const step = queue[pos];
      if (!step) return;
      const r = reciterById(O.current.reciter);
      const url = useFallback ? ayahFallbackUrl(r, step.s, step.a) : ayahUrl(r, step.s, step.a);
      if (!url) return;
      fallbackTried.current = useFallback;
      try {
        player.replace({ uri: url });
        player.play();
        try {
          player.setPlaybackRate(O.current.rate);
        } catch {}
        if (Platform.OS !== 'web') player.setActiveForLockScreen(true, { title: `${SURAHS[step.s - 1][2]} ${step.s}:${step.a}`, artist: `${r.name} · Zikru` });
      } catch {}
      // CDN principal muet ? on bascule sur le secours (une fois)
      loadWatch.current = setTimeout(() => {
        if (!player.isLoaded && !fallbackTried.current && ayahFallbackUrl(r, step.s, step.a)) load(pos, queue, true);
        else if (!player.isLoaded) update({ loading: false, error: 'Récitation indisponible (connexion ?)' });
      }, 9000);
      update({ queue, pos, playing: true, loading: true, error: null });
    },
    [player],
  );

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (s.isLoaded && S.current.loading) {
        if (loadWatch.current) clearTimeout(loadWatch.current);
        update({ loading: false });
      }
      if (s.didJustFinish) {
        const cur = S.current;
        if (!cur.playing) return;
        let next = cur.pos + 1;
        if (next >= cur.queue.length) {
          if (!cur.loop) {
            update({ playing: false, pos: -1 });
            return;
          }
          next = 0;
        }
        const g = O.current.gap ?? 0;
        const wait = gapMs(g, s.duration || 0) / (O.current.rate || 1);
        const same = cur.queue[next].s === cur.queue[cur.pos]?.s && cur.queue[next].a === cur.queue[cur.pos]?.a;
        const go = () => {
          if (!S.current.playing) return;
          if (same && player.isLoaded) {
            // même verset répété : pas de rechargement réseau
            update({ pos: next });
            player.seekTo(0).then(() => player.play());
          } else load(next);
        };
        if (wait > 0) {
          update({ pos: cur.pos });
          timer.current = setTimeout(go, wait);
        } else go();
      }
    });
    return () => sub.remove();
  }, [player, load]);

  useEffect(() => {
    try {
      if (S.current.playing) player.setPlaybackRate(opts.rate);
    } catch {}
  }, [opts.rate, player]);
  useEffect(() => () => clear(), []);

  const start = useCallback(
    (queue: Step[], pos = 0, loop = false) => {
      void enableBackgroundAudio();
      update({ loop });
      load(pos, queue);
    },
    [load],
  );
  const pause = () => {
    clear();
    player.pause();
    update({ playing: false });
  };
  const resume = () => {
    if (S.current.pos < 0) return;
    if (player.isLoaded) {
      player.play();
      update({ playing: true });
    } else load(S.current.pos);
  };
  const stop = () => {
    clear();
    try {
      player.pause();
      if (Platform.OS !== 'web') player.clearLockScreenControls();
    } catch {}
    setSt(IDLE);
  };
  const skip = (d: number) => {
    const q = S.current.queue;
    if (!q.length) return;
    // saute au verset suivant / précédent (et non à la répétition suivante)
    const cur = q[S.current.pos] ?? q[0];
    let i = S.current.pos;
    do i += d;
    while (i >= 0 && i < q.length && q[i].s === cur.s && q[i].a === cur.a);
    if (d < 0) while (i > 0 && q[i - 1].s === q[i]?.s && q[i - 1].a === q[i]?.a) i--;
    if (i >= 0 && i < q.length) load(i);
  };
  const setLoop = (loop: boolean) => update({ loop });
  const step = st.pos >= 0 ? st.queue[st.pos] : null;
  return { ...st, step, start, pause, resume, stop, skip, setLoop, player };
}
