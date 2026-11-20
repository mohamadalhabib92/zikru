import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { BEScreen, Choice, Panel } from '@/components/bien-etre/common';
import { SourcedDua, useHm, usePrayerDays } from '@/components/ramadan/common';
import { hms, IMSAK_OPTIONS, nextFastEvent, remainingMs, SUHUR_LEAD_OPTIONS } from '@/lib/ramadan';
import { useRamadan } from '@/lib/ramadan-store';
import { useSettings } from '@/lib/settings';
import { Button, Toggle } from '@/ui/kit';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

/** Compte à rebours suhur / iftar, marge choisie par l’utilisateur (0 par défaut), rappels prioritaires, du‘a de l’iftar sourcée. */
export default function Compte() {
  const router = useRouter();
  const { prefs, setPrefs, st } = useRamadan();
  const { s } = useSettings();
  const { now, today, tomorrow } = usePrayerDays();
  const hm = useHm();
  const inRamadan = (k: string) => k >= st.start && k <= st.end;
  // hors Ramadan : aperçu avec les horaires du jour (signalé)
  const preview = !st.active;
  const ev = nextFastEvent(now, today, tomorrow, prefs.imsakMin, preview ? () => true : inRamadan);
  const left = ev ? remainingMs(ev.at, now) : 0;
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const setN = (n: Partial<typeof prefs.notif>) => setPrefs((p) => ({ ...p, notif: { ...p.notif, ...n } }));
  return (
    <BEScreen title="Suhur et iftar" sub="Horaires calculés pour votre lieu et votre méthode. En cas de doute, suivez votre mosquée.">
      <Panel tint={b.gold}>
        {preview ? <Text style={{ color: b.inkMuted, fontSize: 13 }}>Hors Ramadan : aperçu avec les horaires d’aujourd’hui.</Text> : null}
        {ev ? (
          <View accessible accessibilityLabel={(ev.kind === 'suhur' ? L('Fin du suhur dans') : L('Iftar dans')) + ' ' + L('{h} h {m} min', { h, m })} style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: b.inkMuted, fontWeight: '800' }}>{ev.kind === 'suhur' ? 'Fin du suhur dans' : 'Iftar dans'}</Text>
            <Text maxFontSizeMultiplier={1.3} style={{ color: b.ink, fontSize: 48, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
              {hms(left)}
            </Text>
            <Text style={{ color: b.ink, fontWeight: '700', textAlign: 'center' }}>
              {ev.kind === 'suhur'
                ? prefs.imsakMin
                  ? L('Fin du suhur à {t} · Fajr calculé à {f} · marge de {n} min (votre choix)', { t: hm(ev.at), f: ev.fajr ? hm(ev.fajr) : '—', n: prefs.imsakMin })
                  : L('Fin du suhur au Fajr calculé : {t}', { t: hm(ev.at) })
                : L('Iftar au Maghrib calculé : {t}', { t: hm(ev.at) })}
            </Text>
          </View>
        ) : (
          <Text style={{ color: b.inkMuted }}>Aucun horaire disponible pour ce lieu aujourd’hui.</Text>
        )}
      </Panel>

      <Panel>
        <Text style={{ color: b.ink, fontWeight: '900' }}>Marge avant le Fajr</Text>
        <Choice label="Marge avant le Fajr" options={IMSAK_OPTIONS.map((n) => ({ label: n ? L('{n} min', { n }) : L('Aucune'), value: n }))} value={prefs.imsakMin} onChange={(v) => setPrefs((p) => ({ ...p, imsakMin: v }))} />
        <Text style={{ color: b.inkMuted, fontSize: 13, lineHeight: 19 }}>Par défaut, le suhur se termine au Fajr calculé, sans marge. Une marge de précaution est votre choix personnel ; l’app n’en impose aucune.</Text>
      </Panel>

      <Panel>
        <Text style={{ color: b.ink, fontWeight: '900' }}>Rappels</Text>
        {!s.reminders ? <Text style={{ color: b.rust, fontSize: 13 }}>Les rappels sont désactivés dans Réglages : activez-les pour recevoir ces notifications.</Text> : null}
        <Toggle label="Rappel avant la fin du suhur" value={prefs.notif.suhur} onChange={(v) => setN({ suhur: v })} />
        {prefs.notif.suhur ? <Choice label="Combien de temps avant" options={SUHUR_LEAD_OPTIONS.map((n) => ({ label: L('{n} min avant', { n }), value: n }))} value={prefs.notif.suhurLead} onChange={(v) => setN({ suhurLead: v })} /> : null}
        <Toggle label="Rappel de l’iftar (Maghrib)" value={prefs.notif.iftar} onChange={(v) => setN({ iftar: v })} hint="Si l’adhan du Maghrib est actif, il devient « Iftar » (pas de notification en plus)." />
        <Toggle label="Autoriser ces rappels pendant les heures calmes" value={prefs.notif.quietOverride} onChange={(v) => setN({ quietOverride: v })} hint="Désactivé par défaut : les heures calmes sont respectées, même pour le suhur." />
        <Text style={{ color: b.inkMuted, fontSize: 12, lineHeight: 18 }}>Suhur et iftar sont prioritaires, comme les adhans (8 jours planifiés à l’avance). En mode dispense, ils sont mis en pause avec les rappels de prière.</Text>
      </Panel>

      <Panel>
        <Text style={{ color: b.ink, fontWeight: '900' }}>Activité en direct et widgets</Text>
        <Text style={{ color: b.inkMuted, fontSize: 13, lineHeight: 19 }}>Sur iPhone, dans Réglages, activez « Activité en direct : prochaine prière » puis « Ramadan : suhur et iftar » : l’écran verrouillé affiche alors le compte à rebours, avec votre marge.</Text>
        <Button title="Ouvrir les réglages" icon="settings-outline" variant="secondary" small onPress={() => router.push('/settings')} />
      </Panel>

      <Panel tint={b.green}>
        <Text style={{ color: b.inkMuted, fontSize: 12, fontWeight: '800' }}>À la rupture du jeûne</Text>
        <SourcedDua id="iftar" />
      </Panel>
    </BEScreen>
  );
}
