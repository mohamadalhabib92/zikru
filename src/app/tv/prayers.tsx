import { useEffect, useRef, useState } from 'react';
import { TvBack, TvButton, TvMuted, TvPremiumGate, TvRow, TvScroll, TvTitle } from '@/components/tv/ui';
import { playAdhanSource } from '@/lib/adhan-playback';
import { assembleAdhanVoices, resolveAdhanVoice } from '@/lib/adhan-voices';
import { L } from '@/lib/l10n';
import { AR_NAMES, CITIES, computeDay, countdown, hhmm, withStates, type PrayerKey } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { Text } from '@/ui/Text';
import { fonts, theme as t } from '@/ui/theme';
import { fontsAreReady } from '@/ui/fonts-ready';

const FARD = new Set<PrayerKey>(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);

export default function TvPrayers() {
  return (
    <TvPremiumGate feature="prayers">
      <PrayerBody />
    </TvPremiumGate>
  );
}

function PrayerBody() {
  const { s, set } = useSettings();
  const [cities, setCities] = useState(false);
  const fired = useRef('');
  const voice = resolveAdhanVoice(s.adhanVoice, assembleAdhanVoices({}, null));
  const play = () => {
    if (!voice.source) return;
    void playAdhanSource(voice.source, { title: voice.title, artist: voice.reciter || 'Adhan' }, { restart: true }).catch(() => {});
  };
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const today = computeDay(now, s.place, s.method, s.madhab, s.prayer);
      const tomorrow = computeDay(new Date(now.getTime() + 86400000), s.place, s.method, s.madhab, s.prayer);
      const { rows } = withStates(today, now, tomorrow[0].time);
      const hit = rows.find((r) => FARD.has(r.key) && Math.abs(r.time.getTime() - now.getTime()) < 20000);
      if (!hit) return;
      const key = `${hit.key}-${hit.time.toDateString()}`;
      if (fired.current === key) return;
      fired.current = key;
      if (voice.source) void playAdhanSource(voice.source, { title: voice.title, artist: voice.reciter || 'Adhan' }, { restart: true }).catch(() => {});
    }, 1000);
    return () => clearInterval(id);
  }, [s.place, s.method, s.madhab, s.prayer, voice.source, voice.title, voice.reciter]);
  return (
    <TvScroll>
      <PrayerFace />
      <TvRow>
        <TvButton preferred label={L('Écouter l’adhan')} hint={voice.title} onPress={play} />
        <TvButton label={L('Choisir une ville')} onPress={() => setCities((v) => !v)} />
        <TvBack />
      </TvRow>
      {cities ? (
        <TvRow>
          {CITIES.map((c) => (
            <TvButton
              key={c.label}
              label={c.label}
              onPress={() => {
                set({ place: { ...c, source: 'manual', updatedAt: new Date().toISOString() } });
                setCities(false);
              }}
            />
          ))}
        </TvRow>
      ) : null}
      <TvMuted>{L('L’adhan du salon se joue pendant que cet écran est ouvert. Apple TV ne garde pas l’application éveillée en arrière-plan comme un iPhone.')}</TvMuted>
    </TvScroll>
  );
}

function PrayerFace() {
  const { s, t: tr } = useSettings();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const today = computeDay(now, s.place, s.method, s.madhab, s.prayer);
  const tomorrow = computeDay(new Date(now.getTime() + 86400000), s.place, s.method, s.madhab, s.prayer);
  const { rows, next } = withStates(today, now, tomorrow[0].time);
  return (
    <>
      <TvTitle>{tr[next.key]}</TvTitle>
      <Text style={{ color: t.accent, fontSize: 56, lineHeight: 96, textAlign: 'left', fontFamily: fontsAreReady() ? fonts.arabic : undefined }}>{AR_NAMES[next.key]}</Text>
      <Text style={{ color: t.text, fontSize: 84, lineHeight: 96, fontWeight: '300', fontVariant: ['tabular-nums'] }}>{hhmm(next.time)}</Text>
      <TvMuted>
        {tr.in} {countdown(next.time.getTime() - now.getTime())} · {s.place.label}
      </TvMuted>
      <TvRow>
        {rows.map((p) => {
          const hi = p.state === 'current' || p.state === 'next';
          return <TvButton key={p.key} label={tr[p.key]} hint={hhmm(p.time)} badge={hi ? L('Maintenant') : undefined} onPress={() => {}} />;
        })}
      </TvRow>
    </>
  );
}
