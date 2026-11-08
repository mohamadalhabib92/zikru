import { DEFAULT_WIDGET_PREFS, normalizeWidgetPrefs, type WidgetPrefs } from './widget-data';
import { shared } from './shared-state';

/** Préférences des widgets : activité en direct (opt-in) et mode Ramadan (désactivé par défaut). Local uniquement. */
export const widgetPrefs = shared<WidgetPrefs>('widget-prefs', DEFAULT_WIDGET_PREFS, (v) => normalizeWidgetPrefs(v));
