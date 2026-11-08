// Clavier numérique iOS : il n'a pas de touche « Retour », il peut donc cacher le bouton de validation.
// KbInput = TextInput qui ajoute, sur iOS et pour les claviers numériques seulement, une barre « Terminé »
// au-dessus du clavier (InputAccessoryView rendue à côté de CHAQUE champ : avec la nouvelle architecture,
// la barre se lie au champ présent au montage, une barre globale ne suffirait pas).
import { useId } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { Text } from '@/ui/Text';
import { theme as t } from './theme';

const NUMERIC = new Set<TextInputProps['keyboardType']>(['number-pad', 'decimal-pad', 'numeric', 'phone-pad']);

export function needsDoneBar(kb: TextInputProps['keyboardType']): boolean {
  return Platform.OS === 'ios' && !!kb && NUMERIC.has(kb);
}

export function KeyboardDoneBar({ id }: { id: string }) {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={id}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: t.surface, borderTopWidth: 1, borderTopColor: t.border, paddingHorizontal: 8 }}>
        <Pressable onPress={() => Keyboard.dismiss()} accessibilityRole="button" hitSlop={8} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
          <Text style={{ color: t.primary, fontWeight: '700', fontSize: 16 }}>Terminé</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

export function KbInput(props: TextInputProps) {
  const id = `kbdone-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const on = needsDoneBar(props.keyboardType) && !props.inputAccessoryViewID;
  return (
    <>
      <TextInput {...props} inputAccessoryViewID={on ? id : props.inputAccessoryViewID} />
      {on ? <KeyboardDoneBar id={id} /> : null}
    </>
  );
}
