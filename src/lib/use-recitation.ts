/**
 * Récitation verset par verset (EveryAyah, secours Islamic Network) avec une seule instance expo-audio et une file JS :
 * répétitions, pause entre les versets, boucle A-B, vitesse, suivi du verset en cours.
 *
 * Robustesse — la lecture s’arrêtait après 1 ou 2 versets sur iPhone :
 * à la fin de chaque verset, expo-audio (keepAudioSessionActive=false par défaut) programme la désactivation
 * de la session audio iOS 100 ms plus tard si aucun lecteur « joue ». Le verset suivant, encore en
 * téléchargement, ne « joue » pas encore → la session est coupée et la lecture se fige.
 * D’où : session gardée active, verset suivant préchargé, jeton par chargement, et reprise si le
 * démarrage n’a jamais eu lieu. Une interruption du système (appel) ou une pause utilisateur ne relance pas play().
 *
 * Une seule récitation du Coran à la fois : démarrer ici met en pause al-Kahf ou un autre lecteur.
 * Lecture méditative : 5 s après chaque verset, puis le suivant. Pause, arrêt, changement de source,
 * prise de main ou démontage annulent cette attente.
 * En arrière-plan (écran verrouillé), iOS peut retarder les pauses programmées : la lecture continue, l’écart peut varier.
 */
import { clearPreloadedSource, preload, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { enableBackgroundAudio } from '@/components/PlayerBar';
import { ayahFallbackUrl, ayahUrl, gapMs, reciterById, type Gap, type Step } from './recitation';
import { canAcceptFinish, createTokenGate, isStalled, nativePauseKind, nextDistinct, nextLoadedToken, planVerseEnd, retryPlan, skipTarget, type ReadingMode } from './recitation-queue';
import { onQuranPreempted, quranApplyMode, quranArmVerse, quranFirePending, quranIsCurrent, quranMount, quranOnVerseFinished, quranRequestPlay, quranResume, quranResumeNext, quranUnmount, quranUserPause, quranUserStop } from './quran-playback';
import { SURAHS } from './surahs';

export type RecState = { queue: Step[]; pos: number; playing: boolean; loading: boolean; holding: boolean; error: string | null; loop: boolean };
const IDLE: RecState = { queue: [], pos: -1, playing: false, loading: false, holding: false, error: null, loop: false };
const native = Platform.OS !== 'web';

let ownerSeq = 0;

export function useRecitation(opts: { reciter: string; rate: number; gap?: Gap; mode?: ReadingMode }) {
  // keepAudioSessionActive : la session iOS reste active entre deux versets (cause racine de l’arrêt).
  const player = useAudioPlayer(null, { updateInterval: 300, keepAudioSessionActive: true });
  const [st, setSt] = useState<RecState>(IDLE);
  // S est la vérité synchrone (les rappels natifs la lisent) ; l’état React n’en est que le reflet pour l’affichage.
  const S = useRef<RecState>(IDLE);
  const O = useRef(opts);
  const [ownerId] = useState(() => `quran-${++ownerSeq}`);
  const gate = useRef(createTokenGate()).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadWatch = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedToken = useRef(-1);
  const failures = useRef(0);
  const lastProgress = useRef({ t: -1, at: 0 });
  const preloaded = useRef<string | null>(null);
  const sawProgress = useRef(false);
  const interrupted = useRef(false);
  const buffering = useRef(false);
  const alive = useRef(true);
  const api = useRef({ go: (_next: number, _same: boolean) => {}, arm: (_delay: number, _epoch: number) => {} });

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
  /** Échec (chargement trop long ou lecture figée au démarrage) : plan de reprise, puis message visible. */
  const fail = (pos: number) => {
    if (interrupted.current || !S.current.playing) return;
    clear();
    const step = S.current.queue[pos];
    if (!step) return;
    failures.current += 1;
    const plan = retryPlan(failures.current, !!ayahFallbackUrl(reciterById(O.current.reciter), step.s, step.a));
    if (!plan) {
      gate.begin();
      quranUserPause(ownerId);
      try {
        player.pause();
      } catch {}
      update({ playing: false, loading: false, holding: false, error: 'Récitation indisponible (connexion ?) — touchez Lecture pour réessayer' });
      return;
    }
    update({ loading: true });
    const again = () => {
      if (S.current.playing && S.current.pos === pos && !interrupted.current) loadRef.current(pos, S.current.queue, plan.useFallback);
    };
    if (plan.delayMs > 0) timer.current = setTimeout(again, plan.delayMs);
    else again();
  };

  const load = useCallback(
    (pos: number, queue = S.current.queue, useFallback = false) => {
      clear();
      const step = queue[pos];
      if (!step) return;
      quranArmVerse(ownerId);
      const r = reciterById(O.current.reciter);
      const url = (useFallback ? ayahFallbackUrl(r, step.s, step.a) : null) ?? ayahUrl(r, step.s, step.a);
      const token = gate.begin();
      loadedToken.current = -1;
      sawProgress.current = false;
      interrupted.current = false;
      lastProgress.current = { t: -1, at: Date.now() };
      update({ queue, pos, playing: true, loading: true, holding: false, error: null });
      try {
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
      loadWatch.current = setTimeout(() => {
        if (gate.isCurrent(token) && loadedToken.current !== token && S.current.playing && !interrupted.current) fail(pos);
      }, 9000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player, ownerId],
  );
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const go = (next: number, same: boolean) => {
    if (!alive.current || !S.current.playing) return;
    update({ holding: false });
    if (same && player.isLoaded) {
      quranArmVerse(ownerId);
      const t = gate.begin();
      loadedToken.current = t;
      sawProgress.current = false;
      lastProgress.current = { t: -1, at: Date.now() };
      update({ pos: next, playing: true, loading: false, holding: false });
      player
        .seekTo(0)
        .then(() => {
          if (gate.isCurrent(t) && S.current.playing) player.play();
        })
        .catch(() => load(next));
      return;
    }
    load(next);
  };

  const arm = (delay: number, epoch: number) => {
    if (timer.current) clearTimeout(timer.current);
    update({ holding: true, playing: true, loading: false });
    timer.current = setTimeout(() => {
      timer.current = null;
      const fired = quranFirePending(ownerId, epoch);
      if (!fired.play || !alive.current || !S.current.playing || interrupted.current) {
        if (S.current.holding) update({ holding: false });
        return;
      }
      go(fired.next ?? 0, !!fired.same);
    }, delay);
  };
  const finishVerse = (duration: number) => {
    failures.current = 0;
    sawProgress.current = false;
    const cur = S.current;
    const mode = O.current.mode ?? 'normal';
    const normalDelay = gapMs(O.current.gap ?? 0, duration || 0) / (O.current.rate || 1);
    const plan = planVerseEnd({ queue: cur.queue, pos: cur.pos, loop: cur.loop, mode, normalDelayMs: normalDelay });
    const decision = quranOnVerseFinished(ownerId, plan);
    if (decision.effect === 'ignore') return;
    if (decision.effect === 'end') {
      update({ playing: false, holding: false, loading: false, pos: -1 });
      try {
        if (native) player.clearLockScreenControls();
      } catch {}
      return;
    }
    if (decision.effect === 'advance-now') {
      go(decision.next, decision.same);
      return;
    }
    arm(decision.delayMs, decision.epoch);
  };
  const finishRef = useRef(finishVerse);

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      const token = gate.current;
      if (typeof s.currentTime === 'number' && s.currentTime !== lastProgress.current.t) lastProgress.current = { t: s.currentTime, at: Date.now() };
      buffering.current = !!s.isBuffering;
      if (s.playing) interrupted.current = false;
      if (!s.didJustFinish && S.current.playing && (s.playing || (typeof s.currentTime === 'number' && s.currentTime > 0.05))) sawProgress.current = true;
      const kind = nativePauseKind({
        intentPlaying: S.current.playing,
        userPaused: false,
        didJustFinish: !!s.didJustFinish,
        isBuffering: !!s.isBuffering,
        nativePlaying: !!s.playing,
        currentTime: s.currentTime || 0,
        duration: s.duration || 0,
        loading: S.current.loading,
        waitingGap: !!timer.current,
      });
      if (kind === 'interruption') interrupted.current = true;
      const loaded = nextLoadedToken({ didJustFinish: !!s.didJustFinish, isLoaded: !!s.isLoaded, playingIntent: S.current.playing, loadedToken: loadedToken.current, token });
      if (loaded !== loadedToken.current) {
        loadedToken.current = loaded;
        if (loadWatch.current) clearTimeout(loadWatch.current);
        loadWatch.current = null;
        if (S.current.loading) update({ loading: false });
        prefetch(S.current.queue, S.current.pos);
      }
      if (!canAcceptFinish({ didJustFinish: !!s.didJustFinish, playingIntent: S.current.playing, loadedToken: loadedToken.current, token, sawProgress: sawProgress.current })) return;
      if (!gate.finish(token)) return;
      finishRef.current(s.duration || 0);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, load]);

  useEffect(() => {
    const iv = setInterval(() => {
      const cur = S.current;
      if (cur.pos < 0 || loadWatch.current) return;
      if (
        isStalled({
          playing: cur.playing,
          waitingGap: !!timer.current,
          now: Date.now(),
          lastProgressAt: lastProgress.current.at,
          buffering: buffering.current,
          interrupted: interrupted.current,
        })
      ) {
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

  const yieldToOther = () => {
    clear();
    gate.begin();
    loadedToken.current = gate.current;
    sawProgress.current = false;
    try {
      player.pause();
      if (native) player.clearLockScreenControls();
    } catch {}
    update({ playing: false, holding: false, loading: false });
  };
  const yieldRef = useRef(yieldToOther);

  useEffect(() => {
    O.current = opts;
    api.current.go = go;
    api.current.arm = arm;
    finishRef.current = finishVerse;
    yieldRef.current = yieldToOther;
  });

  useEffect(() => {
    const decision = quranApplyMode(ownerId, opts.mode ?? 'normal');
    if (decision.effect === 'advance-now') {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (!S.current.playing) return;
      api.current.go(decision.next, decision.same);
    } else if (decision.effect === 'wait') api.current.arm(decision.delayMs, decision.epoch);
  }, [opts.mode, ownerId]);

  useEffect(() => {
    alive.current = true;
    quranMount(ownerId, O.current.mode ?? 'normal');
    const off = onQuranPreempted(ownerId, () => yieldRef.current());
    return () => {
      alive.current = false;
      off();
      clear();
      dropPreload();
      quranUnmount(ownerId);
      try {
        player.pause();
        if (native) player.clearLockScreenControls();
      } catch {}
    };
  }, [player, ownerId]);

  const start = useCallback(
    async (queue: Step[], pos = 0, loop = false) => {
      const gen = quranRequestPlay(ownerId);
      failures.current = 0;
      interrupted.current = false;
      update({ loop, holding: false });
      if (native) await enableBackgroundAudio().catch(() => {});
      if (!alive.current || !quranIsCurrent(ownerId, gen)) return;
      load(pos, queue);
    },
    [load, ownerId],
  );
  const pause = () => {
    clear();
    quranUserPause(ownerId);
    gate.begin();
    loadedToken.current = gate.current;
    sawProgress.current = false;
    try {
      player.pause();
    } catch {}
    update({ playing: false, holding: false });
  };
  const resume = () => {
    if (S.current.pos < 0 && !quranResumeNext(ownerId)) return;
    const resumed = quranResume(ownerId);
    if (!quranIsCurrent(ownerId, resumed.generation)) return;
    failures.current = 0;
    interrupted.current = false;
    if (native) void enableBackgroundAudio();
    if (resumed.resumeNext) {
      update({ playing: true, holding: false, error: null });
      go(resumed.resumeNext.next, resumed.resumeNext.same);
      return;
    }
    if (S.current.pos < 0) return;
    if (player.isLoaded && !S.current.error) {
      gate.begin();
      loadedToken.current = gate.current;
      sawProgress.current = false;
      lastProgress.current = { t: -1, at: Date.now() };
      quranArmVerse(ownerId);
      player.play();
      update({ playing: true, holding: false });
    } else load(S.current.pos);
  };
  const stop = () => {
    clear();
    quranUserStop(ownerId);
    gate.begin();
    sawProgress.current = false;
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
      quranRequestPlay(ownerId);
      failures.current = 0;
      interrupted.current = false;
      load(i);
    }
  };
  const setLoop = (loop: boolean) => update({ loop });
  const step = st.pos >= 0 ? st.queue[st.pos] : null;
  return { ...st, step, start, pause, resume, stop, skip, setLoop, player };
}
