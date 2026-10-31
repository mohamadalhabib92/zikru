import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { BEScreen, Panel, softHaptic } from '@/components/bien-etre/common';
import { DayGrid, useFmtDay } from '@/components/ramadan/common';
import { useDispense } from '@/lib/dispense-context';
import { effectiveMark, fastSummary, markFast, ramadanDays, yearLog, type FastMark } from '@/lib/ramadan';
import { useRamadan } from '@/lib/ramadan-store';
import { Button, Ionicons, Toggle } from '@/ui/kit';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

const MARKS: { mark: FastMark; label: string; icon: 'checkmark' | 'medkit-outline' | 'remove' }[] = [
  { mark: 'fasted', label: 'Jeûné', icon: 'checkmark' },
  { mark: 'excused', label: 'Excusé', icon: 'medkit-outline' },
  { mark: 'missed', label: 'Non jeûné', icon: 'remove' },
];

/** Suivi privé du jeûne : aucune série, aucun score ; les jours en mode dispense restent neutres ; rattrapage (qada) optionnel. */
export default function Jeune() {
  const { prefs, setPrefs, st, today } = useRamadan();
  const { neutral } = useDispense();
  const fmt = useFmtDay();
  const days = ramadanDays(st);
  const [sel, setSel] = useState(() => (today >= st.start && today <= st.end ? today : st.start));
  const log = yearLog(prefs, st.year);
  const sum = fastSummary(prefs, st, today, neutral);
  const color = (m: ReturnType<typeof effectiveMark>) => (m === 'fasted' ? b.green : m === 'excused' || m === 'dispense' ? b.indigo : m === 'missed' ? b.rust : undefined);
  const name = (m: ReturnType<typeof effectiveMark>) => (m === 'fasted' ? L('Jeûné') : m === 'excused' ? L('Excusé') : m === 'missed' ? L('Non jeûné') : m === 'dispense' ? L('Mode dispense') : L('Non renseigné'));
  const cur = effectiveMark(log, sel, neutral);
  return (
    <BEScreen title="Suivi du jeûne" sub="Privé, sur cet appareil. Aucune série, aucun score : un jour excusé ne casse rien.">
      <Panel>
        <DayGrid
          label="Jours du Ramadan"
          days={days}
          selected={sel}
          onSelect={setSel}
          render={(k, i) => {
            const m = effectiveMark(log, k, neutral);
            return { color: color(m), a11y: L('Jour {d}, {date} : {s}', { d: i + 1, date: fmt(k), s: name(m) }), mark: m ? <Ionicons name={m === 'fasted' ? 'checkmark' : m === 'missed' ? 'remove' : 'medkit-outline'} size={14} color={color(m)} /> : undefined };
          }}
        />
        <Text style={{ color: b.ink, fontWeight: '800' }}>{L('Jour {d} · {date}', { d: days.indexOf(sel) + 1, date: fmt(sel) })}</Text>
        {sel > today ? (
          <Text style={{ color: b.inkMuted, fontSize: 13 }}>Jour à venir.</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MARKS.map((x) => (
              <Button
                key={x.mark}
                title={x.label}
                icon={x.icon}
                small
                variant={log.fast[sel] === x.mark ? 'primary' : 'secondary'}
                onPress={() => {
                  softHaptic('select');
                  setPrefs((p) => markFast(p, st.year, sel, x.mark));
                }}
              />
            ))}
          </View>
        )}
        {cur === 'dispense' ? <Text style={{ color: b.inkMuted, fontSize: 13 }}>Mode dispense ce jour-là : jour neutre, compté comme excusé pour le rattrapage.</Text> : null}
      </Panel>

      <Panel>
        <Text style={{ color: b.ink, fontWeight: '900' }}>Résumé</Text>
        <Text style={{ color: b.ink }}>{L('Jeûnés : {a} · excusés : {e} · non jeûnés : {m}', { a: sum.fasted, e: sum.excused + sum.dispense, m: sum.missed })}</Text>
        <Toggle label="Suivre les jours à rattraper (qada)" value={prefs.makeup} onChange={(v) => setPrefs((p) => ({ ...p, makeup: v }))} hint="Optionnel et privé. Pour les règles qui vous concernent, demandez à une personne de science." />
        {prefs.makeup ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: b.ink, fontWeight: '800' }}>{L('Reste à rattraper : {n} · déjà rattrapés : {d}', { n: sum.toMakeUp, d: prefs.makeupDone })}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="J’ai rattrapé un jour" icon="add" small onPress={() => setPrefs((p) => ({ ...p, makeupDone: p.makeupDone + 1 }))} />
              <Button title="Annuler" icon="remove" small variant="secondary" disabled={prefs.makeupDone === 0} onPress={() => setPrefs((p) => ({ ...p, makeupDone: Math.max(0, p.makeupDone - 1) }))} />
            </View>
          </View>
        ) : null}
      </Panel>
    </BEScreen>
  );
}
