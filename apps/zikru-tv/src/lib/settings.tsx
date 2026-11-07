import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CITIES, DEFAULT_PLACE, HAMIDULLAH, METHODS, MUYASSAR, PICKTHALL, type MethodKey, type Place } from './phone';
import { TV_UI, type TvDict, type TvLang } from './ui';

const KEY = 'zikru-tv-settings';

export type TvSettings = {
  lang: TvLang;
  city: string;
  method: MethodKey;
  madhab: 'shafi' | 'hanafi';
  edition: string;
  /** Vrai dès que la ville a été choisie. Sinon Lausanne reste un lieu d’exemple. */
  placeConfirmed?: boolean;
};

const DEFAULTS: TvSettings = {
  lang: 'fr',
  city: DEFAULT_PLACE.label,
  method: 'MuslimWorldLeague',
  madhab: 'shafi',
  edition: HAMIDULLAH.id,
};

type Ctx = { s: TvSettings; ready: boolean; set: (p: Partial<TvSettings>) => void; t: TvDict; place: Place; example: boolean };

const C = createContext<Ctx | null>(null);

export function TvSettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<TvSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<TvSettings>) };
          if (!(parsed.method in METHODS)) parsed.method = DEFAULTS.method;
          if (![HAMIDULLAH.id, PICKTHALL.id, MUYASSAR.id].includes(parsed.edition)) parsed.edition = DEFAULTS.edition;
          if (parsed.lang !== 'fr' && parsed.lang !== 'en') parsed.lang = 'fr';
          if (parsed.madhab !== 'shafi' && parsed.madhab !== 'hanafi') parsed.madhab = 'shafi';
          if (!CITIES.some((c) => c.label === parsed.city)) parsed.city = DEFAULTS.city;
          setS(parsed);
        } catch {
          // réglage illisible : on garde Lausanne
        }
      }
      setReady(true);
    });
  }, []);
  const set = (p: Partial<TvSettings>) => {
    setS((prev) => {
      const next = { ...prev, ...p };
      void AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };
  const place = CITIES.find((c) => c.label === s.city) ?? { ...DEFAULT_PLACE };
  return (
    <C.Provider value={{ s, ready, set, t: TV_UI[s.lang] ?? TV_UI.fr, place, example: !s.placeConfirmed }}>
      {children}
    </C.Provider>
  );
}

export function useTv() {
  const v = useContext(C);
  if (!v) throw new Error('TvSettingsProvider manquant');
  return v;
}
