import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { Text } from '@/ui/Text';
import { BEScreen, Panel, announce } from '@/components/bien-etre/common';
import { useRamadan } from '@/lib/ramadan-store';
import { RAMADAN_CARD_SUPPORTED, shareRamadanCard } from '@/lib/ramadan-card';
import { Button, Field } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { arLang } from '@/ui/ar-lang';
import { alpha, brand as b, isDark } from '@/ui/theme';
import { L, useUiLang } from '@/lib/l10n';

/** Carte « Ramadan Mubarak » : sobre, géométrique, sans image figurative. Aucun texte religieux ajouté ; un message personnel optionnel. */
export default function Carte() {
  const { st } = useRamadan();
  const lang = useUiLang();
  const [line, setLine] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const yearLine = L('Ramadan {y} de l’Hégire', { y: st.year });
  const share = async () => {
    const r = RAMADAN_CARD_SUPPORTED ? await shareRamadanCard({ year: st.year, yearLine, latin: 'Ramadan Mubarak', line: line.trim() || undefined, rtl: lang === 'ar', brand: 'Zikru' }, isDark()) : 'unsupported';
    if (r === 'unsupported') {
      await Share.share({ message: ['رمضان مبارك', 'Ramadan Mubarak', line.trim()].filter(Boolean).join('\n') });
      return;
    }
    const m = r === 'downloaded' ? L('Image enregistrée.') : L('Carte partagée.');
    setMsg(m);
    announce(m);
  };
  return (
    <BEScreen title="Carte Ramadan Mubarak" sub="Une carte sobre à partager. Créée sur votre appareil.">
      <View
        accessible
        accessibilityLabel={L('Aperçu de la carte : Ramadan Mubarak, {y}', { y: yearLine })}
        style={{ aspectRatio: 1, borderRadius: 18, borderWidth: 3, borderColor: b.gold, backgroundColor: isDark() ? '#0B1512' : '#FAF6EC', padding: 10 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: alpha(b.gold, 0.7), borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 14, opacity: 0.6 }} importantForAccessibility="no-hide-descendants">
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: 10, height: 10, borderWidth: 1.5, borderColor: b.gold, transform: [{ rotate: '45deg' }] }} />
            ))}
          </View>
          <Arabic size={44} style={{ textAlign: 'center', lineHeight: 80 }}>
            <Text {...arLang}>رمضان مبارك</Text>
          </Arabic>
          <Text style={{ color: b.gold, fontSize: 24, fontWeight: '700' }}>
            Ramadan Mubarak
          </Text>
          <Text style={{ color: b.inkMuted }}>{yearLine}</Text>
          {line.trim() ? <Text style={{ color: b.ink, textAlign: 'center' }}>{line.trim()}</Text> : null}
          <Text style={{ color: b.gold, fontWeight: '800', marginTop: 8 }}>
            Zikru
          </Text>
        </View>
      </View>
      <Panel>
        <Field label="Message personnel (facultatif)" value={line} onChangeText={(v) => setLine(v.slice(0, 48))} maxLength={48} />
        <Button title={RAMADAN_CARD_SUPPORTED ? 'Partager l’image' : 'Partager'} icon="share-outline" onPress={share} />
        {!RAMADAN_CARD_SUPPORTED && Platform.OS !== 'web' ? <Text style={{ color: b.inkMuted, fontSize: 12 }}>Sur iPhone et Android, le partage envoie le texte ; l’image demande un module natif qui n’est pas dans cette version.</Text> : null}
        {msg ? <Text style={{ color: b.green, fontWeight: '700' }}>{msg}</Text> : null}
      </Panel>
    </BEScreen>
  );
}
