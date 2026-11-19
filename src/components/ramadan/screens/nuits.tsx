import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { BEScreen, Panel, useUthmani } from '@/components/bien-etre/common';
import { SourcedDua, useFmtDay } from '@/components/ramadan/common';
import { lastTenNights } from '@/lib/ramadan';
import { useRamadan } from '@/lib/ramadan-store';
import { arNum, gIndex } from '@/lib/quran-nav';
import { Badge, Button } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { arLang } from '@/ui/ar-lang';
import { alpha, brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

/**
 * Dix dernières nuits. Aucune date n’est présentée comme certaine pour Laylat al-Qadr.
 * La mention des nuits impaires attend sa référence vérifiée (fiche de validation) : badge « Source à compléter ».
 * Sourate al-Qadr : texte Tanzil (CC BY 3.0), inchangé.
 */
export default function Nuits() {
  const router = useRouter();
  const { st, today } = useRamadan();
  const fmt = useFmtDay();
  const uth = useUthmani();
  const nights = lastTenNights(st);
  return (
    <BEScreen title="Les dix dernières nuits" sub="Chaque nuit commence au coucher du soleil, la veille du jour du même numéro.">
      <Panel tint={b.indigo}>
        <Text style={{ color: b.ink, lineHeight: 21 }}>La date de Laylat al-Qadr n’est pas connue avec certitude ; l’app n’en désigne aucune.</Text>
        <Text style={{ color: b.ink, lineHeight: 21 }}>Une mention attribuée à la Sunna invite à la rechercher dans les nuits impaires des dix dernières.</Text>
        <Badge tone="warning" label="Source à compléter" />
      </Panel>

      <Panel>
        {nights.map((n) => {
          const now = n.eve === today;
          return (
            <View
              key={n.night}
              accessible
              accessibilityLabel={L('Nuit {n}, soir du {date}', { n: n.night, date: fmt(n.eve) }) + (n.odd ? ', ' + L('impaire') : '') + (now ? ', ' + L('ce soir') : '')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 10, borderRadius: 12, backgroundColor: now ? alpha(b.indigo, 0.14) : 'transparent' }}>
              <Text style={{ color: b.ink, fontWeight: '900', width: 64 }}>{L('Nuit {n}', { n: n.night })}</Text>
              <Text style={{ color: b.inkMuted, flex: 1 }}>{L('soir du {date}', { date: fmt(n.eve) })}</Text>
              {n.odd ? <Badge tone="info" label="impaire" /> : null}
              {now ? <Badge tone="success" label="ce soir" /> : null}
            </View>
          );
        })}
        {st.length === 29 ? <Text style={{ color: b.inkMuted, fontSize: 12 }}>Selon le calendrier choisi, ce mois compte 29 jours ; la fin réelle dépend de l’observation du croissant (votre mosquée).</Text> : null}
      </Panel>

      <Panel>
        <Text style={{ color: b.ink, fontWeight: '900' }}>Sourate al-Qadr (97)</Text>
        {uth ? (
          <Arabic quran size={26} style={{ textAlign: 'center', lineHeight: 52 }}>
            <Text {...arLang}>{[1, 2, 3, 4, 5].map((a) => `${uth[gIndex(97, a)]} \u06DD${arNum(a)}`).join(' ')}</Text>
          </Arabic>
        ) : (
          <Text style={{ color: b.inkMuted }}>Chargement</Text>
        )}
        <Text style={{ color: b.inkMuted, fontSize: 12 }}>Texte coranique : Tanzil (CC BY 3.0), sans modification.</Text>
        <Button title="Lire dans le Coran" icon="book-outline" variant="ghost" small onPress={() => router.push({ pathname: '/quran/[n]', params: { n: '97' } })} />
      </Panel>

      <Panel tint={b.green}>
        <SourcedDua id="afw" />
      </Panel>
    </BEScreen>
  );
}
