import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, type IconName } from '@/ui/kit';
import { alpha } from '@/ui/theme';
import type { Pal } from './palette';
import { L } from '@/lib/l10n';

/** Feuille modale du bas, aux couleurs du lecteur. */
export function Sheet({ visible, onClose, title, subtitle, pal, children, footer }: { visible: boolean; onClose: () => void; title: string; subtitle?: string; pal: Pal; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel={L("Fermer")} onPress={onClose} style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 640, maxHeight: '88%', backgroundColor: pal.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Math.max(insets.bottom, 12) }}>
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: alpha(pal.muted, 0.4) }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6, gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: pal.ink, fontWeight: '800', fontSize: 18 }} accessibilityRole="header">
                  {title}
                </Text>
                {subtitle ? <Text style={{ color: pal.muted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={L("Fermer")} onPress={onClose} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(pal.muted, 0.15) }}>
                <Ionicons name="close" size={20} color={pal.ink} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Bouton pastille du lecteur. */
export function QBtn({ icon, label, onPress, pal, active, solid, small, disabled, a11y }: { icon?: IconName; label?: string; onPress: () => void; pal: Pal; active?: boolean; solid?: boolean; small?: boolean; disabled?: boolean; a11y?: string }) {
  const fg = solid ? (pal.dark ? '#06120D' : '#fff') : active ? pal.accent : pal.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={L(a11y ?? label ?? '')}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: small ? 32 : 40,
        minWidth: label ? undefined : small ? 32 : 40,
        paddingHorizontal: label ? (small ? 10 : 14) : 0,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: solid ? pal.accent : active ? pal.accent : pal.line,
        backgroundColor: solid ? pal.accent : active ? alpha(pal.accent, 0.12) : pal.card,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={solid ? fg : active ? pal.accent : pal.muted} /> : null}
      {label ? <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 12 : 14 }}>{label}</Text> : null}
    </Pressable>
  );
}

export function QLabel({ children, pal }: { children: ReactNode; pal: Pal }) {
  return <Text style={{ color: pal.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 16, marginBottom: 8 }}>{children}</Text>;
}

/** Choix parmi quelques valeurs (pastilles). */
export function QChoice<T extends string | number>({ options, value, onChange, pal }: { options: { label: string; value: T; a11y?: string }[]; value: T; onChange: (v: T) => void; pal: Pal }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <QBtn key={String(o.value)} small label={o.label} a11y={o.a11y} active={o.value === value} onPress={() => onChange(o.value)} pal={pal} />
      ))}
    </View>
  );
}

/** Stepper − valeur + */
export function QStepper({ value, onChange, min, max, step = 1, pal, label, format }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; pal: Pal; label: string; format?: (v: number) => string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <QBtn icon="remove" a11y={L('{l} : diminuer', { l: L(label) })} onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))} pal={pal} disabled={value <= min} small />
      <Text style={{ color: pal.ink, fontWeight: '800', minWidth: 44, textAlign: 'center' }} accessibilityLabel={`${L(label)} : ${value}`}>
        {format ? format(value) : value}
      </Text>
      <QBtn icon="add" a11y={L('{l} : augmenter', { l: L(label) })} onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))} pal={pal} disabled={value >= max} small />
    </View>
  );
}
