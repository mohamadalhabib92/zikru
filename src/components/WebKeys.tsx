import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { L, registerUiStrings } from '@/lib/l10n';
import { UI_STRINGS_WEB } from '@/lib/ui-strings-web';
import {
  emitReaderKey,
  isQuranReaderPath,
  isTypingTarget,
  reduceWebKey,
  registerWebHelp,
  WEB_KEY_ROWS,
  type WebAction,
} from '@/lib/web-keys';
import { brand as b } from '@/ui/theme';

registerUiStrings(UI_STRINGS_WEB);

function applyAction(action: WebAction): boolean {
  if (action.kind === 'back') {
    if (router.canGoBack()) router.back();
    return true;
  }
  if (action.kind === 'search') {
    router.push('/search');
    return true;
  }
  if (action.kind === 'go') {
    router.push(action.path as never);
    return true;
  }
  if (action.kind === 'reader') return emitReaderKey(action.cmd);
  return false;
}

/** Raccourcis du navigateur et panneau d’aide. Sans effet sur iPhone, iPad, montre et TV. */
export function WebKeys() {
  const [help, setHelp] = useState(false);
  const helpRef = useRef(false);
  const setOpen = (open: boolean) => {
    helpRef.current = open;
    setHelp(open);
  };
  useEffect(() => registerWebHelp(() => setOpen(true)), []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let pendingG = false;
    let timer = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as { tagName?: string; isContentEditable?: boolean } | null;
      const typing = isTypingTarget(target?.tagName, target?.isContentEditable);
      const next = reduceWebKey({
        key: e.key,
        meta: e.metaKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        typing,
        pendingG,
        onQuran: isQuranReaderPath(window.location.pathname),
      });
      pendingG = next.pendingG;
      window.clearTimeout(timer);
      if (pendingG) {
        timer = window.setTimeout(() => {
          pendingG = false;
        }, 1200);
      }
      if (next.action.kind === 'none') return;
      if (next.action.kind === 'help') {
        e.preventDefault();
        setOpen(!helpRef.current);
        return;
      }
      if (helpRef.current) {
        e.preventDefault();
        if (next.action.kind === 'back') setOpen(false);
        return;
      }
      if (applyAction(next.action)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(timer);
    };
  }, []);
  if (Platform.OS !== 'web' || !help) return null;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(14,26,23,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }} accessibilityViewIsModal>
      <Pressable accessibilityRole="button" accessibilityLabel={L('Fermer l’aide')} onPress={() => setOpen(false)} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View style={{ width: '100%', maxWidth: 560, maxHeight: '80%', backgroundColor: b.paper, borderRadius: 20, borderWidth: 1, borderColor: b.line, padding: 20, zIndex: 1 }}>
        <Text accessibilityRole="header" style={{ color: b.ink, fontSize: 22, fontWeight: '800' }}>{L('Raccourcis clavier')}</Text>
        <ScrollView style={{ marginTop: 12 }}>
          {WEB_KEY_ROWS.map((row) => (
            <View key={row.keys + row.label} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: b.line }}>
              <Text style={{ width: 120, color: b.green, fontWeight: '800' }}>{row.keys}</Text>
              <Text style={{ flex: 1, color: b.ink }}>{L(row.label)}</Text>
            </View>
          ))}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ marginTop: 12, minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: b.green, fontWeight: '800' }}>{L('Fermer l’aide')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
