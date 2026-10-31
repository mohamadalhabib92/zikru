import { useState } from 'react';
import { Card, Button, Field, H2, Muted, Spacer, Toggle } from '@/ui/kit';
import { useDispense } from '@/lib/dispense-context';
import { MAX_AUTO_DAYS } from '@/lib/dispense';
import { L } from '@/lib/l10n';

const fmt = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

/** Mode dispense : pause discrète des rappels de prière, séries gelées sans être cassées. 100 % local. */
export function DispenseSettings() {
  const d = useDispense();
  const st = d.state;
  const [days, setDays] = useState('');
  const n = Number(days);
  const auto = days.trim() && Number.isInteger(n) && n >= 1 && n <= MAX_AUTO_DAYS ? n : null;
  const bad = days.trim() !== '' && auto == null;
  return (
    <>
      <H2>{L('Pause des rappels')}</H2>
      <Card>
        <Muted>{L('Met en pause les rappels de prière et gèle tes séries sans les casser. Reste uniquement sur cet appareil : jamais synchronisé ni partagé.')}</Muted>
        <Spacer h={8} />
        <Toggle label={L('Mettre aussi en pause les autres rappels')} hint={L('Adhkar, wird, Coran, al-Kahf.')} value={!!st.alsoOthers} onChange={d.setAlsoOthers} />
        {st.active && st.since ? (
          <>
            <Muted>{st.until ? L('En pause depuis le {a}, reprise automatique le {b}.', { a: fmt(st.since), b: fmt(st.until) }) : L('En pause depuis le {a}.', { a: fmt(st.since) })}</Muted>
            <Spacer h={8} />
            <Button title={L('Reprendre maintenant')} icon="play-outline" onPress={d.resume} />
          </>
        ) : (
          <>
            <Field
              label={L('Reprise automatique après (jours, facultatif)')}
              hint={L('Laisse vide pour reprendre toi-même.')}
              value={days}
              onChangeText={setDays}
              keyboardType="number-pad"
              maxLength={2}
              error={bad ? L('Entre un nombre entre 1 et {n}.', { n: MAX_AUTO_DAYS }) : null}
            />
            <Button title={L('Mettre en pause')} variant="secondary" icon="pause-outline" disabled={bad} onPress={() => d.begin(auto)} />
          </>
        )}
        {st.history.length ? (
          <>
            <Spacer h={8} />
            <Button title={L('Effacer l’historique des pauses')} variant="ghost" icon="trash-outline" onPress={d.forget} />
            <Muted>{L('Les séries passées pourront alors être recalculées sans ces jours neutres.')}</Muted>
          </>
        ) : null}
      </Card>
      <Spacer h={20} />
    </>
  );
}
