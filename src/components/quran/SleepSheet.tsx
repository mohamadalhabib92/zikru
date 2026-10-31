import { View } from 'react-native';
import { Text } from '@/ui/Text';
import type { GlobalRec } from '@/lib/recitation-context';
import { SLEEP_MINUTES } from '@/lib/sleep-timer';
import { QBtn, Sheet } from './Sheet';
import type { Pal } from './palette';
import { L } from '@/lib/l10n';

/** Minuterie de sommeil : la récitation se met en pause après N minutes ou à la fin de la sourate en cours. */
export function SleepSheet({ visible, onClose, rec, pal }: { visible: boolean; onClose: () => void; rec: GlobalRec; pal: Pal }) {
  const pick = (c: number | 'surah' | 'off') => {
    rec.setSleep(c);
    onClose();
  };
  const sl = rec.sleep;
  return (
    <Sheet visible={visible} onClose={onClose} title={L('Minuterie de sommeil')} subtitle={L('La récitation se met en pause automatiquement.')} pal={pal}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {SLEEP_MINUTES.map((m) => (
          <QBtn key={m} label={L('{n} min', { n: m })} active={sl.kind === 'at' && sl.min === m} onPress={() => pick(m)} pal={pal} />
        ))}
        <QBtn icon="flag-outline" label={L('Fin de la sourate')} active={sl.kind === 'surah'} disabled={!rec.step} onPress={() => pick('surah')} pal={pal} />
        <QBtn icon="close" label={L('Désactiver')} active={sl.kind === 'off'} onPress={() => pick('off')} pal={pal} />
      </View>
      <Text style={{ color: pal.muted, fontSize: 12, marginTop: 12 }}>« Fin de la sourate » arrête la lecture continue avant la sourate suivante.</Text>
    </Sheet>
  );
}
