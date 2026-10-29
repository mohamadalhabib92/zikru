/**
 * Récitation verset par verset (EveryAyah, secours Islamic Network) avec une seule instance expo-audio et une file JS :
 * répétitions, pause entre les versets, boucle A-B, vitesse, suivi du verset en cours.
 *
 * Robustesse (1.0.24) — la lecture s’arrêtait après 1 ou 2 versets sur iPhone :
 * à la fin de chaque verset, expo-audio (keepAudioSessionActive=false par défaut) programme la désactivation
 * de la session audio iOS 100 ms plus tard si aucun lecteur « joue ». Le verset suivant, encore en
 * téléchargement, ne « joue » pas encore → la session est coupée sous ses pieds et la lecture se fige
 * (alors que play() avait été appelé). D’où : session gardée active, verset suivant préchargé, jeton par
 * chargement (pas de double avance ni de minuterie périmée), reprise réseau avec CDN de secours, et
 * détection de blocage qui relance le verset.
 * En arrière-plan (écran verrouillé), iOS peut retarder les pauses programmées : la lecture continue, l’écart peut varier.
 */
import { clearPreloadedSource, preload, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { enableBackgroundAudio } from '@/components/PlayerBar';
import { ayahFallbackUrl, ayahUrl, gapMs, reciterById, type Gap, type Step } from './recitation';
import { advance, createTokenGate, isStalled, nextDistinct, retryPlan, skipTarget } from './recitation-queue';
import { SURAHS } from './surahs';

export type RecState = { queue: Step[]; pos: number; playing: boolean; loading: boolean; error: string | null; loop: boolean };
const IDLE: RecState = { queue: [], pos: -1, playing: false, loading: false, error: null, loop: false };
const native = Platform.OS !== 'web';

export function useRecitation(opts: { reciter: string; rate: number; gap?: Gap }) {
  // keepAudioSessionActive : la session iOS reste active entre deux versets (cause racine de l’arrêt).
  const player = useAudioPlayer(null, { updateInterval: 300, keepAudioSessionActive: true });
  const [st, setSt] = useState<RecState>(IDLE);
  // S est la vérité synchrone (les rappels natifs la lisent) ; l’état React n’en est que le reflet pour l’affichage.
  const S = useRef<RecState>(IDLE);
  const O = useRef(opts);
  useEffect(() => {
    O.current = opts;
  });
  const gate = useRef(createTokenGate()).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadWatch = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedToken = useRef(-1);
  const failures = useRef(0);
  const lastProgress = useRef({ t: -1, at: 0 });
  const preloaded = useRef<string | null>(null);
  const alive = useRef(true);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    if (loadWatch.current) clearTimeout(loadWatch.current);
    timer.current = loadWatch.current = null;
  };
  const update = (p: Partial<RecState>) => {
    S.current = { ...S.current, ...p };
    if (alive.current) setSt(S.current);
  };
  const dropPreload = () => {
    const u = preloaded.current;
    preloaded.current = null;
    if (native && u) clearPreloadedSource({ uri: u }).catch(() => {});
  };
  /** Précharge le prochain verset différent (iOS/Android) pour un enchaînement quasi sans blanc. */
  const prefetch = (queue: Step[], pos: number) => {
    if (!native) return;
    const i = nextDistinct(queue, pos, S.current.loop);
    const step = queue[i];
    if (!step) return;
    const url = ayahUrl(reciterById(O.current.reciter), step.s, step.a);
    if (url === preloaded.current) return;
    dropPreload();
    preloaded.current = url;
    preload({ uri: url }).catch(() => {
      if (preloaded.current === url) preloaded.current = null;
    });
  };

  const loadRef = useRef<(pos: number, queue?: Step[], useFallback?: boolean) => void>(() => {});
  /** Échec (chargement trop long ou lecture figée) : plan de reprise, puis message visible. */
  const fail = (pos: number) => {
    clear();
    const step = S.current.queue[pos];
    if (!step) return;
    failures.current += 1;
    const plan = retryPlan(failures.current, !!ayahFallbackUrl(reciterById(O.current.reciter), step.s, step.a));
    if (!plan) {
      gate.begin(); // neutralise toute fin tardive
      try {
        player.pause();
      } catch {}
      update({ playing: false, loading: false, error: 'Récitation indisponible (connexion ?) — touchez Lecture pour réessayer' });
      return;
    }
    update({ loading: true });
    const again = () => {
      if (S.current.playing && S.current.pos === pos) loadRef.current(pos, S.current.queue, plan.useFallback);
    };
    if (plan.delayMs > 0) timer.current = setTimeout(again, plan.delayMs);
    else again();
  };

  const load = useCallback(
    (pos: number, queue = S.current.queue, useFallback = false) => {
      clear();
      const step = queue[pos];
      if (!step) return;
      const r = reciterById(O.current.reciter);
      const url = (useFallback ? ayahFallbackUrl(r, step.s, step.a) : null) ?? ayahUrl(r, step.s, step.a);
      const token = gate.begin();
      lastProgress.current = { t: -1, at: Date.now() };
      update({ queue, pos, playing: true, loading: true, error: null });
      try {
        // un préchargement consommé par replace() (iOS) ou conservé (Android) : on libère la référence
        if (preloaded.current === url) {
          player.replace({ uri: url });
          dropPreload();
        } else player.replace({ uri: url });
        player.play();
        try {
          player.setPlaybackRate(O.current.rate);
        } catch {}
        if (native) player.setActiveForLockScreen(true, { title: `${SURAHS[step.s - 1][2]} ${step.s}:${step.a}`, artist: `${r.name} · Zikru` });
      } catch {}
      // CDN muet ? plan de reprise (secours, puis nouvelles tentatives) — jamais déclenché pour un autre verset
      loadWatch.current = setTimeout(() => {
        if (gate.isCurrent(token) && loadedToken.current !== token && S.current.playing) fail(pos);
      }, 9000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player],
  );
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      const token = gate.current;
      if (s.isLoaded && loadedToken.current !== token && S.current.playing) {
        loadedToken.current = token;
        if (loadWatch.current) clearTimeout(loadWatch.current);
        loadWatch.current = null;
        if (S.current.loading) update({ loading: false });
        prefetch(S.current.queue, S.current.pos);
      }
      if (typeof s.currentTime === 'number' && s.currentTime !== lastProgress.current.t) lastProgress.current = { t: s.currentTime, at: Date.now() };
      if (!s.didJustFinish) return;
      const cur = S.current;
      // une seule avance par verset chargé, et seulement pour le chargement en cours (déjà prêt) :
      // une fin en double ou en retard du verset précédent ne fait pas sauter un verset
      if (!cur.playing || loadedToken.current !== token || !gate.finish(token)) return;
      failures.current = 0;
      const nx = advance(cur.queue, cur.pos, cur.loop);
      if (!nx) {
        update({ playing: false, pos: -1 });
        try {
          if (native) player.clearLockScreenControls();
        } catch {}
        return;
      }
      const wait = gapMs(O.current.gap ?? 0, s.duration || 0) / (O.current.rate || 1);
      const go = () => {
        timer.current = null;
        if (!S.current.playing) return;
        if (nx.same && player.isLoaded) {
          // même verset répété : pas de rechargement réseau
          const t = gate.begin();
          loadedToken.current = t;
          lastProgress.current = { t: -1, at: Date.now() };
          update({ pos: nx.next });
          player
            .seekTo(0)
            .then(() => {
              if (gate.isCurrent(t) && S.current.playing) player.play();
            })
            .catch(() => load(nx.next));
        } else load(nx.next);
      };
      if (wait > 0) timer.current = setTimeout(go, wait);
      else go();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, load]);

  // Détection de blocage : lecture demandée mais position figée > 12 s (réseau coupé en cours de verset…) → reprise.
  useEffect(() => {
    const iv = setInterval(() => {
      const cur = S.current;
      if (cur.pos < 0 || loadWatch.current) return;
      if (isStalled({ playing: cur.playing, waitingGap: !!timer.current, now: Date.now(), lastProgressAt: lastProgress.current.at })) {
        lastProgress.current = { t: -1, at: Date.now() };
        fail(cur.pos);
      }
    }, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (S.current.playing) player.setPlaybackRate(opts.rate);
    } catch {}
  }, [opts.rate, player]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clear();
      dropPreload();
    };
  }, []);

  const start = useCallback(
    async (queue: Step[], pos = 0, loop = false) => {
      failures.current = 0;
      update({ loop });
      // session audio (lecture en mode silencieux, arrière-plan) configurée AVANT de lancer le premier verset
      // (sur le web, pas d’attente : play() doit rester dans le geste de l’utilisateur)
      if (native) await enableBackgroundAudio().catch(() => {});
      load(pos, queue);
    },
    [load],
  );
  const pause = () => {
    clear();
    gate.begin(); // une fin qui arriverait juste après la pause ne relance rien
    loadedToken.current = gate.current;
    player.pause();
    update({ playing: false });
  };
  const resume = () => {
    if (S.current.pos < 0) return;
    failures.current = 0;
    if (player.isLoaded && !S.current.error) {
      gate.begin();
      loadedToken.current = gate.current;
      lastProgress.current = { t: -1, at: Date.now() };
      player.play();
      update({ playing: true });
    } else load(S.current.pos);
  };
  const stop = () => {
    clear();
    gate.begin();
    dropPreload();
    try {
      player.pause();
      if (native) player.clearLockScreenControls();
    } catch {}
    S.current = IDLE;
    setSt(IDLE);
  };
  const skip = (d: number) => {
    const i = skipTarget(S.current.queue, S.current.pos, d);
    if (i >= 0) {
      failures.current = 0;
      load(i);
    }
  };
  const setLoop = (loop: boolean) => update({ loop });
  const step = st.pos >= 0 ? st.queue[st.pos] : null;
  return { ...st, step, start, pause, resume, stop, skip, setLoop, player };
}
