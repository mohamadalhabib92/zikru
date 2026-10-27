/** Retour sensoriel web : vibration (Android Chrome) + bip WebAudio (aucun fichier à charger). */
type Ctx = { createOscillator(): OscillatorNode; createGain(): GainNode; currentTime: number; destination: AudioDestinationNode; state: string; resume(): Promise<void> };
let ctx: Ctx | null = null;
function audio(): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const A = (window as unknown as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx }).AudioContext ?? (window as unknown as { webkitAudioContext?: new () => Ctx }).webkitAudioContext;
    if (!A) return null;
    ctx = new A();
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}
function beep(freq: number, ms: number, at = 0) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.value = freq;
  const t0 = a.currentTime + at;
  g.gain.setValueAtTime(0.15, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + ms / 1000 + 0.02);
}
export function feedback(kind: 'tap' | 'cycle', opts: { sound: boolean; haptics: boolean }) {
  if (opts.haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(kind === 'cycle' ? [60, 60, 120] : 15);
    } catch {
      /* ignoré */
    }
  }
  if (!opts.sound) return;
  try {
    if (kind === 'cycle') {
      beep(880, 140);
      beep(1320, 260, 0.17);
    } else beep(1800, 40);
  } catch {
    /* ignoré */
  }
}
