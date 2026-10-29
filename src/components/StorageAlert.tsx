import { useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storageIssues } from '@/lib/storage';

/**
 * Bandeau visible quand un enregistrement local échoue (stockage plein, indisponible, données illisibles).
 * Les appuis restent en mémoire et l'écriture est réessayée automatiquement : rien n'est perdu en silence.
 */
export function StorageAlert() {
  const issues = useSyncExternalStore(storageIssues.subscribe, storageIssues.get, storageIssues.get);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  if (!issues.length) return null;
  const write = issues.some((i) => i.op === 'write');
  const corrupt = issues.find((i) => i.op === 'read');
  const title = write ? 'Enregistrement impossible pour le moment' : 'Lecture des données locales impossible';
  const text = write
    ? 'Vos appuis sont gardés en mémoire et seront enregistrés dès que possible (nouvel essai automatique). Si le stockage du téléphone est plein, libérez de la place. Ne fermez pas l’app tant que ce message est affiché.'
    : `Rien n’a été écrasé : si des données sont illisibles, une copie est conservée (et le compteur reprend sa dernière sauvegarde). Détail : ${corrupt?.message ?? ''}`;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{ position: 'absolute', left: 10, right: 10, top: insets.top + 6, zIndex: 1000, backgroundColor: '#7a2e12', borderRadius: 14, padding: 12, gap: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 }}
    >
      <Text style={{ color: '#fff', fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: '#fde8dc', fontSize: 13, lineHeight: 18 }}>{text}</Text>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
        {write ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setBusy(true);
              void storageIssues.retry().finally(() => setBusy(false));
            }}
            style={{ backgroundColor: '#fff', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 }}
          >
            <Text style={{ color: '#7a2e12', fontWeight: '800' }}>{busy ? 'Essai…' : 'Réessayer'}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => issues.filter((i) => i.op === 'read').forEach((i) => storageIssues.dismissFull(i.key))} style={{ backgroundColor: '#fff', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 }}>
            <Text style={{ color: '#7a2e12', fontWeight: '800' }}>Compris</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
