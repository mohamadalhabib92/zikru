import { useState } from 'react';
import { Text } from '@/ui/Text';
import { BEScreen, Panel, softHaptic } from '@/components/bien-etre/common';
import { DayGrid, useFmtDay } from '@/components/ramadan/common';
import { addDays, fastSummary, ramadanDays, toggleTarawih, yearLog } from '@/lib/ramadan';
import { useRamadan } from '@/lib/ramadan-store';
import { Button, Ionicons } from '@/ui/kit';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

/** Tarawih : une case par nuit, privée et réversible. La nuit N commence au soir du jour N−1 (le 1er soir est la veille du 1er jour). */
export default function Tarawih() {
  const { prefs, setPrefs, st, today } = useRamadan();
  const fmt = useFmtDay();
  // clé = jour N du Ramadan ; la nuit N se prie le soir précédent (veille)
  const nights = ramadanDays(st);
  const eve = (k: string) => addDays(k, -1);
  const [sel, setSel] = useState(() => (nights.includes(addDays(today, 1)) ? addDays(today, 1) : nights[0]));
  const log = yearLog(prefs, st.year);
  const n = fastSummary(prefs, st, today, () => false).tarawih;
  const on = !!log.tarawih[sel];
  return (
    <BEScreen title="Tarawih" sub="Cochez les nuits où vous avez prié. Privé, sur cet appareil ; aucun classement.">
      <Panel>
        <DayGrid
          label="Nuits du Ramadan"
          days={nights}
          selected={sel}
          onSelect={setSel}
          render={(k, i) => ({ color: log.tarawih[k] ? b.indigo : undefined, a11y: L('Nuit {n}, soir du {date}', { n: i + 1, date: fmt(eve(k)) }) + (log.tarawih[k] ? ', ' + L('priée') : ''), mark: log.tarawih[k] ? <Ionicons name="checkmark" size={14} color={b.indigo} /> : undefined })}
        />
        <Text style={{ color: b.ink, fontWeight: '800' }}>{L('Nuit {n} · soir du {date}', { n: nights.indexOf(sel) + 1, date: fmt(eve(sel)) })}</Text>
        {eve(sel) > today ? (
          <Text style={{ color: b.inkMuted, fontSize: 13 }}>Nuit à venir.</Text>
        ) : (
          <Button
            title={on ? 'Priée · retirer' : 'J’ai prié les tarawih'}
            icon={on ? 'close' : 'checkmark'}
            variant={on ? 'secondary' : 'primary'}
            onPress={() => {
              softHaptic(on ? 'light' : 'success');
              setPrefs((p) => toggleTarawih(p, st.year, sel));
            }}
          />
        )}
        <Text style={{ color: b.inkMuted }}>{L('{n} nuits cochées', { n })}</Text>
      </Panel>
    </BEScreen>
  );
}
