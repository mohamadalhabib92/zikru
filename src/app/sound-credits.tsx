import { Linking, Pressable } from 'react-native';
import { Text } from '@/ui/Text';
import { ADHAN_CUE, LOCAL_ADHAN_SLOTS, assembleAdhanVoices, licenseBlockReason } from '@/lib/adhan-voices';
import { L } from '@/lib/l10n';
import { RECITERS } from '@/lib/recitation';
import { Card, H1, H2, Muted, Screen, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

function LinkLine({ url, label }: { url: string; label: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: t.primary }}>{label}</Text>
    </Pressable>
  );
}

/** Crédits des adhans dont la licence est vérifiée, et des récitations encore en doute. */
export default function SoundCredits() {
  const adhans = [
    ...assembleAdhanVoices({}, null),
    ...LOCAL_ADHAN_SLOTS.filter((s) => s.license && !licenseBlockReason(s.license)).map((s) => ({
      id: s.id,
      title: s.title,
      reciter: s.reciter,
      style: s.style,
      origin: s.origin,
      license: s.license,
      pageUrl: s.pageUrl,
    })),
  ];
  return (
    <Screen>
      <H1>{L('Crédits et licences des sons')}</H1>
      <Muted>{L('Ces adhans ont une licence qui permet une application payante. Le fichier n’est pas modifié, sauf l’extraction de la piste audio indiquée.')}</Muted>
      <Spacer />
      <H2>{L('Adhans')}</H2>
      <Card>
        <Text style={{ color: t.text, fontWeight: '800' }}>{L('Signal court de l’écran verrouillé')}</Text>
        <Muted>{L('Auteur : {name}', { name: ADHAN_CUE.reciter })}</Muted>
        <Muted>{L('Licence : {license}', { license: ADHAN_CUE.license })}</Muted>
        <Muted>{L('Ce n’est pas la voix choisie dans les réglages.')}</Muted>
        <LinkLine url={ADHAN_CUE.pageUrl} label={L('Page de la source')} />
      </Card>
      {adhans.map((v) => (
        <Card key={v.id}>
          <Text style={{ color: t.text, fontWeight: '800' }}>{L(v.title)}</Text>
          {v.style ? <Muted>{L('Style : {s}', { s: L(v.style) })}</Muted> : null}
          {v.reciter ? <Muted>{L('Auteur : {name}', { name: v.reciter })}</Muted> : null}
          <Muted>{L(v.origin)}</Muted>
          <Muted>{L('Licence : {license}', { license: v.license ?? '' })}</Muted>
          {v.pageUrl ? <LinkLine url={v.pageUrl} label={L('Page de la source')} /> : null}
        </Card>
      ))}
      <Spacer />
      <H2>{L('Récitations')}</H2>
      <Muted>{L('Doute : pas une licence ouverte vérifiée. Les fichiers restent chez EveryAyah et Islamic Network, et l’écoute n’est pas réservée au Premium.')}</Muted>
      <Muted>{L('Conditions d’Al Quran Cloud du 14 juin 2026 : redistribution décrite comme non commerciale, droits restant au récitateur, qui peut demander le retrait. EveryAyah.com ne publie pas de licence pour l’ensemble du site.')}</Muted>
      {RECITERS.map((r) => (
        <Card key={r.id}>
          <Text style={{ color: t.text, fontWeight: '800' }}>{r.name}</Text>
          <Muted>{r.style}</Muted>
          <Muted>{L(r.license)}</Muted>
          <LinkLine url={r.pageUrl} label="everyayah.com" />
          <LinkLine url={r.licenseUrl} label="alquran.cloud" />
        </Card>
      ))}
    </Screen>
  );
}
