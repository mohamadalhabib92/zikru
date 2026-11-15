import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { usePremium } from '@/lib/premium';
import { tvFeatureAllowed, type TvFeatureId } from '@/lib/tv';
import { L } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { alpha, theme as t } from '@/ui/theme';

export const tvPad = { paddingHorizontal: 64, paddingTop: 36, paddingBottom: 48 };

export function TvScreen({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: t.bg }}>{children}</View>;
}

export function TvScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={tvPad}>
      {children}
    </ScrollView>
  );
}

export function TvTitle({ children }: { children: ReactNode }) {
  return <Text style={{ color: t.text, fontSize: 40, fontWeight: '800', letterSpacing: -0.6 }}>{children}</Text>;
}

export function TvMuted({ children }: { children: ReactNode }) {
  return <Text style={{ color: t.muted, fontSize: 22, lineHeight: 30, marginTop: 8 }}>{children}</Text>;
}

/** Tuile ou bouton du salon. Le cercle de focus est le survol de la télécommande. */
export function TvButton({
  label,
  hint,
  onPress,
  preferred,
  locked,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  preferred?: boolean;
  locked?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      hasTVPreferredFocus={preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={{
        minHeight: 120,
        minWidth: 280,
        flexGrow: 1,
        borderRadius: 24,
        paddingHorizontal: 28,
        paddingVertical: 22,
        justifyContent: 'center',
        backgroundColor: focused ? t.primary : t.surface,
        borderWidth: 4,
        borderColor: focused ? t.accent : t.border,
      }}
    >
      <Text style={{ color: focused ? t.onPrimary : t.text, fontSize: 30, fontWeight: '800' }}>{label}</Text>
      {hint ? <Text style={{ color: focused ? alpha(t.onPrimary, 0.85) : t.muted, fontSize: 18, marginTop: 6 }}>{hint}</Text> : null}
      {locked ? <Text style={{ color: focused ? t.onPrimary : t.accent, fontSize: 16, fontWeight: '800', marginTop: 8 }}>{L('Zikru Premium')}</Text> : null}
    </Pressable>
  );
}

export function TvBack({ preferred }: { preferred?: boolean }) {
  return <TvButton label={L('Retour')} onPress={() => router.back()} preferred={preferred} />;
}

export function TvPremiumGate({ feature, children }: { feature: TvFeatureId; children: ReactNode }) {
  const premium = usePremium();
  if (!premium.ready) return <TvScroll><TvMuted>{L('Chargement…')}</TvMuted></TvScroll>;
  if (tvFeatureAllowed(feature, premium.canCreate)) return <>{children}</>;
  return (
    <TvScroll>
      <TvTitle>{L('Zikru Premium')}</TvTitle>
      <TvMuted>
        {L('Achat unique à vie')}
        {' — '}
        {L('Cet écran du salon fait partie de Zikru Premium, le même achat que sur iPhone. Rejoindre une famille et la discussion restent gratuits.')}
      </TvMuted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 28 }}>
        <TvButton
          preferred
          label={L('Restaurer les achats')}
          hint={L('Même identifiant Apple que sur iPhone')}
          onPress={() => void premium.restore()}
        />
        <TvButton label={L('Retour')} onPress={() => router.back()} />
      </View>
      {premium.phase === 'success' ? <TvMuted>{L('Premium est actif sur cet appareil.')}</TvMuted> : null}
      {premium.phase === 'offline' ? <TvMuted>{L('Pas de connexion. Réessayez quand vous serez en ligne.')}</TvMuted> : null}
    </TvScroll>
  );
}
