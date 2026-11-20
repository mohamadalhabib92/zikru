import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, View } from 'react-native';
import { TVPressable as Pressable } from '@/ui/tv-pressable';
import { Text } from '@/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storageIssues } from '@/lib/storage';
import { L } from '@/lib/l10n';

/**
 * Bandeau visible quand un enregistrement local échoue (stockage plein, indisponible, données illisibles).
 * Les appuis restent en mémoire et l'écriture est réessayée automatiquement : rien n'est perdu en silence.
 */
export function StorageAlert() {
  const issues = useSyncExternalStore(storageIssues.subscribe, storageIssues.get, storageIssues.get);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [hot, setHot] = useState(false);
  const tv = Platform.isTV;
  const [arm, setArm] = useState(tv);
  const focused = tv && hot;
  useEffect(() => {
    if (!arm) return;
    const id = setTimeout(() => setArm(false), 700);
    return () => clearTimeout(id);
  }, [arm]);
  if (!issues.length) return null;
  const write = issues.some((i) => i.op === 'write');
  const corrupt = issues.find((i) => i.op === 'read');
  const title = write ? L('Enregistrement impossible pour le moment') : L('Lecture des données locales impossible');
  const text = write
    ? L('Vos appuis sont gardés en mémoire et seront enregistrés dès que possible (nouvel essai automatique). Si le stockage du téléphone est plein, libérez de la place. Ne fermez pas l’app tant que ce message est affiché.')
    : L('Rien n’a été écrasé : si des données sont illisibles, une copie est conservée (et le compteur reprend sa dernière sauvegarde). Détail : {d}', { d: corrupt?.message ?? '' });
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{ position: 'absolute', left: tv ? 90 : 10, right: tv ? 90 : 10, top: tv ? 60 : insets.top + 6, zIndex: 1000, backgroundColor: '#7a2e12', borderRadius: 14, padding: tv ? 22 : 12, gap: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: tv ? 28 : undefined }}>{title}</Text>
      <Text style={{ color: '#fde8dc', fontSize: tv ? 22 : 13, lineHeight: tv ? 30 : 18 }}>{text}</Text>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
        {write ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            hasTVPreferredFocus={arm}
            onFocus={() => setHot(true)}
            onBlur={() => setHot(false)}
            onPress={() => {
              setBusy(true);
              void storageIssues.retry().finally(() => setBusy(false));
            }}
            style={[{ backgroundColor: '#fff', borderRadius: 10, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }, tv ? { minHeight: 72, paddingHorizontal: 22, backgroundColor: focused ? '#F6E7B8' : 'rgba(255,255,255,0.72)', borderWidth: 6, borderColor: focused ? '#FFFFFF' : 'transparent', transform: [{ scale: focused ? 1.08 : 1 }] } : null]}
          >
            <Text style={{ color: focused ? '#141311' : '#7a2e12', fontWeight: '800', fontSize: tv ? 28 : undefined }}>{busy ? L('Essai…') : L('Réessayer')}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            hasTVPreferredFocus={arm}
            onFocus={() => setHot(true)}
            onBlur={() => setHot(false)}
            onPress={() => issues.filter((i) => i.op === 'read').forEach((i) => storageIssues.dismissFull(i.key))}
            style={[{ backgroundColor: '#fff', borderRadius: 10, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }, tv ? { minHeight: 72, paddingHorizontal: 22, backgroundColor: focused ? '#F6E7B8' : 'rgba(255,255,255,0.72)', borderWidth: 6, borderColor: focused ? '#FFFFFF' : 'transparent', transform: [{ scale: focused ? 1.08 : 1 }] } : null]}
          >
            <Text style={{ color: focused ? '#141311' : '#7a2e12', fontWeight: '800', fontSize: tv ? 28 : undefined }}>{L('Compris')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
