import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useData } from './data';
import { useDispense } from './dispense-context';
import { toHijri } from './hijri';
import { AR_NAMES, computeDay } from './prayer';
import { useSettings } from './settings';
import { useShared } from './shared-state';
import { pushWidgets, syncLiveActivity, widgetsAvailable } from './widget-bridge';
import { dhikrProps, liveActivityFor, prayerTimeline, tasbihProps, type WidgetLang } from './widget-data';
import { widgetPrefs } from './widget-store';

/**
 * Tient les widgets à jour depuis l’app (aucun réseau, aucun serveur) :
 * horaires recalculés sur l’appareil, tasbih (avec un délai pour ne pas écrire à chaque appui),
 * dhikr du jour approuvé et sourcé, et l’activité en direct si l’utilisateur l’a activée.
 */
export function useWidgetSync() {
  const { s, t: tr, ready } = useSettings();
  const { content, tasbih, ready: dataReady } = useData();
  const { pausedToday } = useDispense();
  const [prefs, , prefsReady] = useShared(widgetPrefs);
  const lang: WidgetLang = s.lang === 'ar' || s.lang === 'en' ? s.lang : s.lang === 'de' || s.lang === 'de-CH' ? 'de' : 'fr';
  const latest = useRef({ s, tr, content, prefs, pausedToday, lang });
  useEffect(() => {
    latest.current = { s, tr, content, prefs, pausedToday, lang };
  });

  // Prières + dhikr du jour + activité en direct : au démarrage, au retour au premier plan, à minuit.
  useEffect(() => {
    if (!widgetsAvailable || !ready || !dataReady || !prefsReady) return;
    const run = () => {
      const { s: cur, tr: t, content: c, prefs: p, pausedToday: paused, lang: lg } = latest.current;
      const now = new Date();
      const today = computeDay(now, cur.place, cur.method, cur.madhab, cur.prayer);
      const tomorrow = computeDay(new Date(now.getTime() + 86400000), cur.place, cur.method, cur.madhab, cur.prayer);
      const names = { title: t.w_next, place: cur.place.label, names: { fajr: t.fajr, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha }, namesAr: { fajr: AR_NAMES.fajr, dhuhr: AR_NAMES.dhuhr, asr: AR_NAMES.asr, maghrib: AR_NAMES.maghrib, isha: AR_NAMES.isha } };
      pushWidgets({ timeline: prayerTimeline(today, tomorrow, now, names), dhikr: dhikrProps(c, now, lg, t.w_dhikr, t.w_none) });
      const live = p.live && !paused ? liveActivityFor(today, tomorrow, now, { ...names, suhur: t.w_suhur, iftar: t.w_iftar }, { on: p.ramadan, hijriMonth: toHijri(now, cur.hijriOffset).month }) : null;
      void syncLiveActivity(live);
    };
    run();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const n = new Date();
      timer = setTimeout(
        () => {
          run();
          arm();
        },
        new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 1).getTime() - n.getTime(),
      );
    };
    arm();
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [ready, dataReady, prefsReady, s.place, s.method, s.madhab, s.prayer, s.lang, s.hijriOffset, prefs.live, prefs.ramadan, pausedToday, content]);

  // Tasbih : écriture différée (1,5 s après le dernier appui).
  useEffect(() => {
    if (!widgetsAvailable || !dataReady) return;
    const id = setTimeout(() => {
      const c = latest.current.content.find((x) => x.id === tasbih.dhikrId);
      pushWidgets({ tasbih: tasbihProps(tasbih, c?.transliteration ?? '', latest.current.tr.w_tasbih) });
    }, 1500);
    return () => clearTimeout(id);
  }, [tasbih, dataReady, s.lang]);
}
