import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { BEScreen, Choice, Panel } from '@/components/bien-etre/common';
import { NavItem, useFmtDay } from '@/components/ramadan/common';
import { ConfirmStart } from '@/components/ramadan-banner';
import { hijriCalendar } from '@/lib/hijri';
import { setOverride } from '@/lib/ramadan';
import { useRamadan } from '@/lib/ramadan-store';
import { useSettings } from '@/lib/settings';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

/** Accueil du mode Ramadan : état (calcul ou confirmation locale), réglage du mode, accès aux outils. Tout est gratuit et local. */
export default function RamadanHub() {
  const { prefs, setPrefs, st } = useRamadan();
  const { s } = useSettings();
  const fmt = useFmtDay();
  const ov = prefs.override?.year === st.year ? prefs.override.mode : null;
  const off = s.hijriOffset >= 0 ? `+${s.hijriOffset}` : String(s.hijriOffset);
  const head =
    st.phase === 'during'
      ? L('Ramadan {y} · jour {d} sur {n}', { y: st.year, d: st.day, n: st.length })
      : st.phase === 'before'
        ? L('Ramadan {y} : dans {n} j · {d}', { y: st.year, n: st.daysUntil, d: fmt(st.start) })
        : L('Ramadan {y} est terminé', { y: st.year });
  const src =
    st.source === 'confirmed'
      ? L('Dates confirmées par vous (mosquée ou observation locale).')
      : hijriCalendar() === 'umalqura'
        ? L('Estimation Umm al-Qura (décalage {o} j), à confirmer selon votre mosquée.', { o: off })
        : L('Estimation par le calendrier tabulaire (décalage {o} j), à confirmer selon votre mosquée.', { o: off });
  return (
    <BEScreen title="Ramadan" sub="Suhur et iftar, lecture, suivis privés. Gratuit, sans compte, sur cet appareil.">
      <Panel tint={b.gold}>
        <Text accessibilityRole="header" style={{ color: b.ink, fontWeight: '900', fontSize: 18 }}>
          {head}
        </Text>
        <Text style={{ color: b.inkMuted, fontSize: 13 }}>{L('Du {a} au {z}', { a: fmt(st.start), z: fmt(st.end) })}</Text>
        <Text style={{ color: b.inkMuted, fontSize: 13, lineHeight: 19 }}>{src}</Text>
        {st.phase !== 'after' ? <ConfirmStart compact={false} /> : null}
      </Panel>

      <View style={{ gap: 10 }}>
        <NavItem icon="time-outline" title="Suhur et iftar" sub="Compte à rebours, marge, rappels, du‘a de l’iftar" href="/ramadan?s=compte" color={b.gold} />
        <NavItem icon="book-outline" title="Khatma du Ramadan" sub="Le Coran en 30 jours (1 juz’ par jour)" href="/quran/khatma?plan=ramadan" color={b.green} />
        <NavItem icon="restaurant-outline" title="Suivi du jeûne" sub="Privé · jours excusés · rattrapage (optionnel)" href="/ramadan?s=jeune" color={b.teal} />
        <NavItem icon="moon-outline" title="Tarawih" sub="Cocher ses nuits, en privé" href="/ramadan?s=tarawih" color={b.indigo} />
        <NavItem icon="star-outline" title="Les dix dernières nuits" sub="Nuits impaires, sourate al-Qadr, du‘a sourcée" href="/ramadan?s=nuits" color={b.goldDeep} />
        <NavItem icon="hand-left-outline" title="Zakat al-fitr" sub="Rappel · montant de votre mosquée" href="/ramadan?s=zakat" color={b.rust} />
        <NavItem icon="share-outline" title="Carte « Ramadan Mubarak »" sub="Sobre, sans image figurative" href="/ramadan?s=carte" color={b.green} />
      </View>

      <Panel>
        <Text style={{ color: b.ink, fontWeight: '900' }}>Mode Ramadan</Text>
        <Choice
          label="Mode Ramadan"
          options={[
            { label: 'Automatique', value: 'auto' as const, sub: 'Selon le calendrier hégirien' },
            { label: 'Désactivé', value: 'off' as const },
          ]}
          value={prefs.mode}
          onChange={(v) => setPrefs((p) => ({ ...p, mode: v }))}
        />
        <Text style={{ color: b.inkMuted, fontSize: 13 }}>{L('Cette année ({y})', { y: st.year })}</Text>
        <Choice
          label="Forçage pour cette année"
          options={[
            { label: 'Suivre le mode', value: 'none' as const },
            { label: 'Forcer l’activation', value: 'on' as const },
            { label: 'Ne pas activer', value: 'off' as const },
          ]}
          value={ov ?? 'none'}
          onChange={(v) => setPrefs((p) => setOverride(p, st.year, v === 'none' ? null : v))}
        />
        <Text style={{ color: b.inkMuted, fontSize: 12, lineHeight: 18 }}>Le calendrier et le décalage hégirien se règlent dans Réglages ; ils servent partout dans l’app (source unique).</Text>
      </Panel>
    </BEScreen>
  );
}
