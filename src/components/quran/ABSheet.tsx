import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { abQueue, abRange, AB_TIMES, ayahCount } from '@/lib/recitation';
import { SURAHS } from '@/lib/surahs';
import { QBtn, QChoice, QLabel, QStepper, Sheet } from './Sheet';
import type { Pal } from './palette';
import { L } from '@/lib/l10n';

type Start = (queue: ReturnType<typeof abQueue>['queue'], pos: number, loop: boolean) => unknown;

/**
 * Répétition A-B : de A à B dans la sourate, la plage N fois (∞ = en boucle), chaque verset 1 à 5 fois.
 * Pratique pour la mémorisation et l’écoute répétée.
 */
export function ABSheet({ visible, onClose, s, a, b, pal, start }: { visible: boolean; onClose: () => void; s: number; a: number; b?: number; pal: Pal; start: Start }) {
  const max = ayahCount(s);
  const [A, setA] = useState(a);
  const [B, setB] = useState(b ?? Math.min(max, a + 4));
  const [times, setTimes] = useState(3);
  const [each, setEach] = useState(1);
  const r = abRange(s, A, B);
  const go = () => {
    const q = abQueue(s, r.a, r.b, times, each);
    void start(q.queue, 0, q.loop);
    onClose();
  };
  const verses = r.b - r.a + 1;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={L('Répétition A-B')}
      subtitle={`${SURAHS[s - 1][2]} · ${s}:${r.a}–${r.b}`}
      pal={pal}
      footer={<QBtn solid icon="repeat" label={L('Lancer la répétition')} onPress={go} pal={pal} />}
    >
      <QLabel pal={pal}>{L('DÉBUT (A)')}</QLabel>
      <QStepper label="Verset A" value={A} min={1} max={max} onChange={setA} pal={pal} />
      <QLabel pal={pal}>{L('FIN (B)')}</QLabel>
      <QStepper label="Verset B" value={B} min={1} max={max} onChange={setB} pal={pal} />
      <QLabel pal={pal}>{L('RÉPÉTER LA PLAGE')}</QLabel>
      <QChoice options={AB_TIMES.map((t) => ({ label: t === 0 ? '∞' : `×${t}`, value: t, a11y: t === 0 ? L('En boucle') : L('{n} fois', { n: t }) }))} value={times} onChange={setTimes} pal={pal} />
      <QLabel pal={pal}>{L('CHAQUE VERSET')}</QLabel>
      <QChoice options={[1, 2, 3, 5].map((t) => ({ label: `×${t}`, value: t, a11y: L('{n} fois', { n: t }) }))} value={each} onChange={setEach} pal={pal} />
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: pal.muted, fontSize: 12 }}>
          {times === 0 ? L('{v} versets, en boucle jusqu’à l’arrêt.', { v: verses }) : L('{v} versets × {t} passages = {n} lectures.', { v: verses, t: times, n: verses * times * each })}
        </Text>
      </View>
    </Sheet>
  );
}
