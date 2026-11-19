import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { BEScreen, Choice, Panel } from '@/components/bien-etre/common';
import { useFmtDay } from '@/components/ramadan/common';
import { addDays, zakatTotal, type ZakatFitr } from '@/lib/ramadan';
import { useRamadan } from '@/lib/ramadan-store';
import { Button, Field, Toggle } from '@/ui/kit';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

/** Zakat al-fitr : un rappel, rien de plus. Le montant vient de vous ou de votre mosquée ; l’app n’en propose aucun. */
export default function Zakat() {
  const { prefs, setPrefs, st, today } = useRamadan();
  const fmt = useFmtDay();
  const z = prefs.zakat;
  const set = (n: Partial<ZakatFitr>) => setPrefs((p) => ({ ...p, zakat: { ...p.zakat, ...n } }));
  const total = zakatTotal(z);
  // dates proposées : les 5 derniers jours du mois calculé (à ajuster selon votre mosquée)
  const dates = [4, 3, 2, 1, 0].map((n) => addDays(st.end, -n)).filter((k) => k >= today);
  return (
    <BEScreen title="Zakat al-fitr" sub="Un rappel pour ne pas l’oublier avant la prière de l’Aïd. Le montant et les modalités se demandent à votre mosquée.">
      <Panel>
        <Field label="Montant par personne (indiqué par votre mosquée)" value={z.amount} onChangeText={(v) => set({ amount: v.slice(0, 40) })} placeholder={L('ex. le montant annoncé par votre mosquée')} maxLength={40} />
        <Field label="Source du montant" value={z.source} onChangeText={(v) => set({ source: v.slice(0, 60) })} placeholder={L('ex. nom de votre mosquée')} maxLength={60} />
        <Text style={{ color: b.ink, fontWeight: '800' }}>{L('Personnes à votre charge, vous compris : {n}', { n: z.people })}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Moins" icon="remove" small variant="secondary" disabled={z.people <= 1} onPress={() => set({ people: Math.max(1, z.people - 1) })} />
          <Button title="Plus" icon="add" small variant="secondary" disabled={z.people >= 30} onPress={() => set({ people: Math.min(30, z.people + 1) })} />
        </View>
        {total ? (
          <Text accessibilityLiveRegion="polite" style={{ color: b.ink, fontSize: 18, fontWeight: '900' }}>{L('Total d’après votre saisie : {v} {u}', { v: total.value, u: total.unit })}</Text>
        ) : (
          <Text style={{ color: b.inkMuted, fontSize: 13 }}>Saisissez le montant pour voir le total. L’app ne propose aucun montant.</Text>
        )}
      </Panel>

      <Panel>
        <Toggle label="Me le rappeler" value={z.on} onChange={(v) => set({ on: v, date: v && !z.date ? (dates[0] ?? null) : z.date })} hint="Une notification à 10 h le jour choisi, tant que ce n’est pas marqué comme versé." />
        {z.on && dates.length ? <Choice label="Jour du rappel" options={dates.map((k) => ({ label: fmt(k), value: k }))} value={z.date ?? dates[0]} onChange={(v) => set({ date: v })} /> : null}
        {z.on && !dates.length ? <Text style={{ color: b.inkMuted, fontSize: 13 }}>Ramadan est terminé pour cette année.</Text> : null}
        <Toggle label="Versée" value={z.paid} onChange={(v) => set({ paid: v })} hint="Privé, sur cet appareil. Le rappel s’arrête." />
      </Panel>
    </BEScreen>
  );
}
