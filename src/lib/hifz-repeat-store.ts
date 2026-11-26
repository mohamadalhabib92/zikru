/** Derniers réglages de répétition audio. Clé neuve : les cartes et `hifz-prefs` restent intacts. */
import { shared } from './shared-state';
import { DEFAULT_REPEAT, HIFZ_REPEAT_KEY, sanitizeRepeat, type RepeatSettings } from './hifz-repeat';

export const hifzRepeat = shared<RepeatSettings>(HIFZ_REPEAT_KEY, DEFAULT_REPEAT, (v) => sanitizeRepeat(v));
