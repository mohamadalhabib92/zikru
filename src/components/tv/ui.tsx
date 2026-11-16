import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type ElementRef, type ReactNode } from 'react';
import * as ReactNative from 'react-native';
import { usePremium } from '@/lib/premium';
import { tvFeatureAllowed, type TvFeatureId } from '@/lib/tv';
import { L } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

const { Dimensions, FlatList, Pressable, ScrollView, TextInput, View } = ReactNative;
type ViewProps = ComponentProps<typeof View>;

/**
 * Marge d’overscan Apple TV à 1920×1080 : 90 pt sur les côtés, 60 pt en haut.
 * Le bas est un peu plus large pour que l’ombre du focus (échelle 1,08) reste à l’écran.
 */
export const tvPad = { paddingHorizontal: 90, paddingTop: 60, paddingBottom: 72 };

const FOCUS_FILL = '#F6E7B8';
const FOCUS_INK = '#141311';
const FOCUS_EDGE = '#FFFFFF';

type GuideProps = ViewProps;

const TVFocusGuideView: React.ComponentType<GuideProps> =
  (ReactNative as typeof ReactNative & { TVFocusGuideView?: React.ComponentType<GuideProps> }).TVFocusGuideView ?? View;

type Measurable = ElementRef<typeof View>;

const ScrollFocus = createContext<(view: Measurable | null) => void>(() => {});

type FocusClaim = { take: () => boolean };
const FocusClaimCtx = createContext<FocusClaim | null>(null);

function FocusScope({ children }: { children: ReactNode }) {
  const taken = useRef(false);
  const api = useMemo<FocusClaim>(
    () => ({
      take() {
        if (taken.current) return false;
        taken.current = true;
        return true;
      },
    }),
    [],
  );
  return <FocusClaimCtx.Provider value={api}>{children}</FocusClaimCtx.Provider>;
}

/** Vrai seulement au premier affichage de l’écran, puis retiré pour qu’un rendu (horloge, audio) ne ramène pas le focus. */
function useArmedPreferred(preferred?: boolean): boolean {
  const claim = useContext(FocusClaimCtx);
  const [arm, setArm] = useState(() => {
    if (!preferred) return false;
    return claim ? claim.take() : true;
  });
  useEffect(() => {
    if (!arm) return;
    const id = setTimeout(() => setArm(false), 700);
    return () => clearTimeout(id);
  }, [arm]);
  return arm;
}

function isFocused(state: { pressed: boolean }): boolean {
  return Boolean((state as { focused?: boolean }).focused);
}

export function TvScreen({ children }: { children: ReactNode }) {
  return <TVFocusGuideView style={{ flex: 1, backgroundColor: t.bg }}>{children}</TVFocusGuideView>;
}

export function TvScroll({ children, pinEnd, transparent }: { children: ReactNode; pinEnd?: boolean; transparent?: boolean }) {
  const ref = useRef<{ scrollTo: (options: { y: number; animated?: boolean }) => void } | null>(null);
  const offset = useRef(0);
  const lastScroll = useRef(0);
  const setRef = useCallback((node: { scrollTo: (options: { y: number; animated?: boolean }) => void } | null) => {
    ref.current = node;
  }, []);
  const ensure = useCallback((view: Measurable | null) => {
    if (!view || typeof view.measureInWindow !== 'function') return;
    if (Date.now() - lastScroll.current < 500) return;
    view.measureInWindow((_x, y, _w, h) => {
      const screenH = Dimensions.get('window').height;
      const top = 60;
      const bottom = screenH - 60;
      const onScreen = y >= top && (h >= screenH - 120 || y + h <= bottom);
      if (onScreen) return;
      let next = offset.current;
      if (h >= screenH - 120) next = offset.current + (y - top);
      else if (y < top) next = offset.current - (top - y);
      else next = offset.current + (y + h - bottom);
      next = Math.max(0, next);
      if (Math.abs(next - offset.current) < 24) return;
      lastScroll.current = Date.now();
      ref.current?.scrollTo({ y: next, animated: false });
    });
  }, []);
  return (
    <FocusScope>
      <ScrollFocus.Provider value={ensure}>
        <TVFocusGuideView style={{ flex: 1 }}>
          <ScrollView
            ref={setRef}
            style={{ flex: 1, backgroundColor: transparent ? 'transparent' : t.bg }}
            contentContainerStyle={[tvPad, pinEnd ? { flexGrow: 1, justifyContent: 'flex-end' } : { flexGrow: 1 }]}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(e) => {
              offset.current = e.nativeEvent.contentOffset.y;
            }}
          >
            {children}
          </ScrollView>
        </TVFocusGuideView>
      </ScrollFocus.Provider>
    </FocusScope>
  );
}

/** Rangée. Pas de piège gauche/droite : un retour à la ligne avec trap fait sauter le focus. */
export function TvRow({ children }: { children: ReactNode }) {
  return <TVFocusGuideView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 20, alignItems: 'stretch' }}>{children}</TVFocusGuideView>;
}

export function TvColumn({ children }: { children: ReactNode }) {
  return <TVFocusGuideView style={{ marginTop: 18, gap: 14 }}>{children}</TVFocusGuideView>;
}

/** Liste virtualisée. `removeClippedSubviews` reste faux : le découpage fait perdre le focus tvOS. */
export function TvVirtualList<T>({
  data,
  keyExtractor,
  renderItem,
  header,
}: {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T) => ReactNode;
  header?: ReactNode;
}) {
  return (
    <FocusScope>
      <FlatList
        data={data as T[]}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => <>{renderItem(item)}</>}
        ListHeaderComponent={header ? <>{header}</> : undefined}
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={tvPad}
        removeClippedSubviews={false}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
      />
    </FocusScope>
  );
}

export function TvTitle({ children }: { children: ReactNode }) {
  return <Text style={{ color: t.text, fontSize: 56, fontWeight: '800', letterSpacing: -0.8 }}>{children}</Text>;
}

export function TvMuted({ children }: { children: ReactNode }) {
  return <Text style={{ color: t.muted, fontSize: 28, lineHeight: 38, marginTop: 10 }}>{children}</Text>;
}

function chrome(on: boolean, minHeight: number): React.ComponentProps<typeof View>['style'] {
  return {
    minHeight,
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 20,
    justifyContent: 'center',
    backgroundColor: on ? FOCUS_FILL : '#1A2420',
    borderWidth: 6,
    borderColor: on ? FOCUS_EDGE : '#5C6B64',
    opacity: on ? 1 : 0.62,
    transform: [{ scale: on ? 1.08 : 1 }],
    shadowColor: on ? FOCUS_FILL : 'transparent',
    shadowOpacity: on ? 0.95 : 0,
    shadowRadius: on ? 28 : 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: on ? 16 : 0,
  };
}

export function TvFocusable({
  preferred,
  onPress,
  block,
  minHeight = 120,
  label,
  children,
}: {
  preferred?: boolean;
  onPress?: () => void;
  block?: boolean;
  minHeight?: number;
  label?: string;
  children: (focused: boolean) => ReactNode;
}) {
  const arm = useArmedPreferred(preferred);
  const [hot, setHot] = useState(false);
  const box = useRef<Measurable>(null);
  const ensure = useContext(ScrollFocus);
  return (
    <View ref={box} collapsable={false} style={{ flexGrow: block ? 1 : undefined, width: block ? '100%' : undefined, minWidth: block ? undefined : 280 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: hot }}
        hasTVPreferredFocus={arm}
        onFocus={() => {
          setHot(true);
          ensure(box.current);
        }}
        onBlur={() => setHot(false)}
        onPress={onPress}
        style={(state) => chrome(isFocused(state) || hot, minHeight)}
      >
        {(state) => children(isFocused(state) || hot)}
      </Pressable>
    </View>
  );
}

/** Tuile, bouton, ligne ou carte. Le focus est or clair, bord blanc, échelle 1,08. */
export function TvButton({
  label,
  hint,
  aside,
  asideFont,
  badge,
  onPress,
  preferred,
  locked,
  block,
}: {
  label: string;
  hint?: string;
  aside?: string;
  asideFont?: string;
  badge?: string;
  onPress: () => void;
  preferred?: boolean;
  locked?: boolean;
  block?: boolean;
}) {
  return (
    <TvFocusable preferred={preferred} onPress={onPress} block={block} minHeight={132} label={hint ? `${label}. ${hint}` : label}>
      {(on) => {
        const ink = on ? FOCUS_INK : '#F4F1EA';
        const sub = on ? 'rgba(20,19,17,0.74)' : 'rgba(244,241,234,0.78)';
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: ink, fontSize: 34, fontWeight: '800' }}>{label}</Text>
              {hint ? <Text style={{ color: sub, fontSize: 24, marginTop: 6 }}>{hint}</Text> : null}
              {badge ? <Text style={{ color: on ? FOCUS_INK : t.accent, fontSize: 22, fontWeight: '800', marginTop: 8 }}>{badge}</Text> : null}
              {locked ? <Text style={{ color: on ? FOCUS_INK : t.accent, fontSize: 22, fontWeight: '800', marginTop: 8 }}>{L('Zikru Premium')}</Text> : null}
            </View>
            {aside ? <Text style={{ color: ink, fontSize: 40, fontFamily: asideFont }}>{aside}</Text> : null}
          </View>
        );
      }}
    </TvFocusable>
  );
}

export function TvField({
  label,
  value,
  onChange,
  preferred,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  preferred?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const arm = useArmedPreferred(preferred);
  const [hot, setHot] = useState(false);
  const box = useRef<Measurable>(null);
  const ensure = useContext(ScrollFocus);
  return (
    <View ref={box} collapsable={false}>
      <Text style={{ color: hot ? FOCUS_INK : '#C9D0CB', fontSize: 26, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        hasTVPreferredFocus={arm}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={t.muted}
        onFocus={() => {
          setHot(true);
          ensure(box.current);
        }}
        onBlur={() => setHot(false)}
        style={{
          color: hot ? FOCUS_INK : '#F4F1EA',
          fontSize: 34,
          minHeight: 92,
          borderWidth: 6,
          borderColor: hot ? FOCUS_EDGE : '#5C6B64',
          borderRadius: 18,
          paddingHorizontal: 22,
          backgroundColor: hot ? FOCUS_FILL : '#1A2420',
          opacity: hot ? 1 : 0.62,
          transform: [{ scale: hot ? 1.08 : 1 }],
        }}
      />
    </View>
  );
}

export function TvBack({ preferred }: { preferred?: boolean }) {
  return <TvButton label={L('Retour')} onPress={() => router.back()} preferred={preferred} />;
}

export function TvPremiumGate({ feature, children }: { feature: TvFeatureId; children: ReactNode }) {
  const premium = usePremium();
  if (!premium.ready) {
    return (
      <TvScroll>
        <TvMuted>{L('Chargement…')}</TvMuted>
      </TvScroll>
    );
  }
  if (tvFeatureAllowed(feature, premium.canCreate)) return <>{children}</>;
  return (
    <TvScroll>
      <TvTitle>{L('Zikru Premium')}</TvTitle>
      <TvMuted>
        {L('Achat unique à vie')}
        {' — '}
        {L('Cet écran du salon fait partie de Zikru Premium, le même achat que sur iPhone. Rejoindre une famille et la discussion restent gratuits.')}
      </TvMuted>
      <TvRow>
        <TvButton preferred label={L('Restaurer les achats')} hint={L('Même identifiant Apple que sur iPhone')} onPress={() => void premium.restore()} />
        <TvButton label={L('Retour')} onPress={() => router.back()} />
      </TvRow>
      {premium.phase === 'success' ? <TvMuted>{L('Premium est actif sur cet appareil.')}</TvMuted> : null}
      {premium.phase === 'offline' ? <TvMuted>{L('Pas de connexion. Réessayez quand vous serez en ligne.')}</TvMuted> : null}
    </TvScroll>
  );
}
