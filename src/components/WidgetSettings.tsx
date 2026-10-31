import { Platform } from 'react-native';
import { L } from '@/lib/l10n';
import { useShared } from '@/lib/shared-state';
import { liveActivityAvailable, widgetsAvailable } from '@/lib/widget-bridge';
import { widgetPrefs } from '@/lib/widget-store';
import { Card, Divider, H2, Muted, Notice, Toggle } from '@/ui/kit';

/** Widgets et activité en direct : tout est calculé sur l’appareil, rien ne passe par le réseau. */
export function WidgetSettings() {
  const [p, set] = useShared(widgetPrefs);
  const native = Platform.OS === 'ios' || Platform.OS === 'android';
  return (
    <>
      <H2>{L('Widgets')}</H2>
      <Card>
        {!native ? (
          <Muted>{L('Les widgets (prochaine prière, tasbih, dhikr du jour) sont disponibles dans l’app iPhone et Android.')}</Muted>
        ) : !widgetsAvailable ? (
          <Notice tone="info" title={L('Cette version de l’app ne contient pas encore les widgets. Ils arriveront avec une prochaine mise à jour.')} />
        ) : (
          <Muted>
            {Platform.OS === 'ios'
              ? L('Ajoutez un widget : appui long sur l’écran d’accueil ou l’écran verrouillé, puis « + » et Zikru. Les horaires sont calculés sur l’appareil, sans réseau.')
              : L('Ajoutez un widget : appui long sur l’écran d’accueil, puis « Widgets » et Zikru. Les horaires sont calculés sur l’appareil, sans réseau.')}
          </Muted>
        )}
        {liveActivityAvailable ? (
          <>
            <Divider />
            <Toggle
              label={L('Activité en direct : prochaine prière')}
              hint={L('Sur l’écran verrouillé et la Dynamic Island, dans les 2 heures avant la prière. Elle démarre quand vous ouvrez l’app.')}
              value={p.live}
              onChange={(v) => set({ ...p, live: v })}
            />
            {p.live ? (
              <Toggle
                label={L('Ramadan : suhur et iftar')}
                hint={L('Pendant ramadan, affiche la fin du suhur (Fajr) et l’iftar (Maghrib) selon vos horaires calculés, sans marge ajoutée.')}
                value={p.ramadan}
                onChange={(v) => set({ ...p, ramadan: v })}
              />
            ) : null}
          </>
        ) : null}
      </Card>
    </>
  );
}
