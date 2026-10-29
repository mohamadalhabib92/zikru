import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Text } from '@/ui/Text';
import { bleCounter, useBleCounter } from '@/lib/ble/manager';
import { Ionicons, type IconName } from '@/ui/kit';
import { theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

/**
 * Puce d'état du compteur Bluetooth (accueil et tasbih) : « Compteur connecté ✓ nom » ou « Recherche du compteur… ».
 * Toucher ouvre l'écran Bluetooth — ou, sur le web sans reconnexion silencieuse, relance la connexion (geste requis).
 */
export function BleStatusChip({ showIdle = false }: { showIdle?: boolean }) {
  const s = useBleCounter();
  const router = useRouter();
  let label: string;
  let icon: IconName;
  let fg: string;
  let bg: string;
  let action: 'ring' | 'reconnect' = 'ring';
  if (s.status === 'connecté') {
    label = `${L('Compteur connecté ✓')} ${s.device?.name ?? ''}${s.battery != null ? ` · ${s.battery} %` : ''}`.trim();
    icon = 'bluetooth';
    [fg, bg] = [t.success, t.successBg];
  } else if (s.similar) {
    label = `${L('Appareil semblable détecté — à confirmer')}${s.similar.name ? ` (${s.similar.name})` : ''}`;
    icon = 'help-circle-outline';
    [fg, bg] = [t.warning, t.warningBg];
  } else if (s.auto === 'recherche' || s.status === 'reconnexion') {
    label = `${L('Recherche du compteur…')}${s.autoTarget ? ` (${s.autoTarget})` : ''}`;
    icon = 'search-outline';
    [fg, bg] = [t.warning, t.warningBg];
  } else if (s.auto === 'bt-off') {
    label = 'Bluetooth désactivé — reconnexion dès son activation';
    icon = 'bluetooth-outline';
    [fg, bg] = [t.muted, t.surfaceAlt];
  } else if (s.auto === 'action') {
    label = s.autoTarget ? `${L('Toucher pour reconnecter')} ${s.autoTarget}` : L('Toucher pour reconnecter le compteur');
    icon = 'refresh';
    [fg, bg] = [t.info, t.infoBg];
    action = 'reconnect';
  } else if (showIdle && s.prefs.hidEnabled && s.hidSupported) {
    label = 'Clavier / télécommande actif';
    icon = 'keypad-outline';
    [fg, bg] = [t.info, t.infoBg];
  } else return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={typeof label === "string" ? L(label) : label}
      onPress={() => (action === 'reconnect' ? void bleCounter.reconnect() : router.push('/ring'))}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: bg, opacity: pressed ? 0.8 : 1, maxWidth: '100%' })}
    >
      <Ionicons name={icon} size={14} color={fg} />
      <Text numberOfLines={1} style={{ color: fg, fontSize: 12, fontWeight: '700', flexShrink: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
