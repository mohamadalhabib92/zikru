import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type ElementRef, type ReactNode } from 'react';
import * as ReactNative from 'react-native';
import { usePremium } from '@/lib/premium';
import { useFeatureFlags } from '@/lib/use-premium';
import { TV_FEATURES, tvFeatureAllowed, tvPremiumActive, type TvFeatureId } from '@/lib/tv';
import {
  TV_CARD_BG,
  TV_FOCUS_INK,
  TV_ON_CARD,
  TV_ON_CARD_MUTED,
  TV_BUTTON_HINT_SIZE,
  TV_BUTTON_LABEL_SIZE,
  TV_BUTTON_MIN_WIDTH,
  TV_PAD_BOTTOM,
  TV_PAD_TOP,
  TV_PAD_X,
  tvButtonInk,
  tvButtonLabelBox,
  chunkTv,
  tvGrid,
  tvRowGap,
  type TvGrid,
} from '@/lib/tv-surface';
import { L } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { useVisualEffects } from '@/ui/effects';
import { currentFinish, isGlass, theme as t } from '@/ui/theme';
import { TVPressable, tvFocusStyle } from '@/ui/tv-pressable';

const { FlatList, ScrollView, TextInput, View, useWindowDimensions } = ReactNative;
type ViewProps = ComponentProps<typeof View>;

/**
 * Marge d’overscan Apple TV à 1920×1080 : 90 pt sur les côtés, 60 pt en haut.
 * Le bas est un peu plus large pour que l’ombre du focus (échelle 1,08) reste à l’écran.
 */
export const tvPad = { paddingHorizontal: TV_PAD_X, paddingTop: TV_PAD_TOP, paddingBottom: TV_PAD_BOTTOM };

/** Grille du salon pour la largeur réelle de la fenêtre (pas une mesure figée au chargement). */
export function useTvGrid(opts?: { minColumns?: number; maxColumns?: number; minTile?: number }): TvGrid & { screenWidth: number; screenHeight: number } {
  const { width, height } = useWindowDimensions();
  const minColumns = opts?.minColumns;
  const maxColumns = opts?.maxColumns;
  const minTile = opts?.minTile;
  const measuredW = width > 0 ? width : 1920;
  const measuredH = height > 0 ? height : 1080;
  return useMemo(
    () => ({ ...tvGrid(measuredW, { minColumns, maxColumns, minTile }), screenWidth: measuredW, screenHeight: measuredH }),
    [measuredW, measuredH, minColumns, maxColumns, minTile],
  );
}

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
  const { height: screenH } = useWindowDimensions();
  const screenHRef = useRef(screenH);
  useEffect(() => {
    screenHRef.current = screenH;
  }, [screenH]);
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
      const screenHNow = screenHRef.current;
      const top = TV_PAD_TOP;
      const bottom = screenHNow - TV_PAD_TOP;
      const onScreen = y >= top && (h >= screenHNow - 120 || y + h <= bottom);
      if (onScreen) return;
      let next = offset.current;
      if (h >= screenHNow - 120) next = offset.current + (y - top);
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

/** Rangée. L’écart suit la largeur réelle pour que le focus à 1,08 ne recouvre pas le voisin. */
export function TvRow({ children, gap }: { children: ReactNode; gap?: number }) {
  const { width } = useWindowDimensions();
  const g = gap ?? tvRowGap(width);
  return <TVFocusGuideView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: g, marginTop: 20, alignItems: 'stretch', overflow: 'visible' }}>{children}</TVFocusGuideView>;
}

export function TvColumn({ children }: { children: ReactNode }) {
  return <TVFocusGuideView style={{ marginTop: 18, gap: 24, overflow: 'visible' }}>{children}</TVFocusGuideView>;
}

/** Liste virtualisée. `removeClippedSubviews` reste faux : le découpage fait perdre le focus tvOS. */
export function TvVirtualList<T>({
  data,
  keyExtractor,
  renderItem,
  header,
  grid,
}: {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T) => ReactNode;
  header?: ReactNode;
  /** Plusieurs colonnes selon la largeur (liste des sourates). Sans ça, une seule colonne pleine largeur. */
  grid?: boolean;
}) {
  const spec = useTvGrid();
  const columns = grid ? spec.columns : 1;
  const gap = grid ? spec.gap : 24;
  const rows = useMemo(() => chunkTv(data, columns), [data, columns]);
  return (
    <FocusScope>
      <TVFocusGuideView style={{ flex: 1, backgroundColor: t.bg }}>
        <FlatList
          key={grid ? `tv-grid-${columns}` : 'tv-list'}
          data={rows}
          keyExtractor={(row) => row.map((cell) => keyExtractor(cell.item, cell.index)).join('\u0000')}
          renderItem={({ item: row }) => (
            <View style={{ flexDirection: 'row', gap, marginBottom: gap, overflow: 'visible' }}>
              {row.map((cell) => (
                <View key={keyExtractor(cell.item, cell.index)} style={{ width: columns > 1 ? spec.tileWidth : '100%', flexGrow: 0, flexShrink: 0, overflow: 'visible' }}>
                  {renderItem(cell.item)}
                </View>
              ))}
            </View>
          )}
          ListHeaderComponent={header ? <>{header}</> : undefined}
          style={{ flex: 1 }}
          contentContainerStyle={[tvPad, { flexGrow: 1 }]}
          removeClippedSubviews={false}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          keyboardShouldPersistTaps="handled"
        />
      </TVFocusGuideView>
    </FocusScope>
  );
}

export function TvTitle({ children }: { children: ReactNode }) {
  return <Text style={{ color: t.text, fontSize: 56, fontWeight: '800', letterSpacing: -0.8 }}>{children}</Text>;
}

export function TvMuted({ children }: { children: ReactNode }) {
  return <Text style={{ color: t.muted, fontSize: 28, lineHeight: 38, marginTop: 10 }}>{children}</Text>;
}

function chrome(minHeight: number, block?: boolean): React.ComponentProps<typeof View>['style'] {
  return {
    minHeight,
    minWidth: TV_BUTTON_MIN_WIDTH,
    alignSelf: block ? 'stretch' : 'flex-start',
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 20,
    justifyContent: 'center',
    backgroundColor: TV_CARD_BG,
    overflow: 'visible',
  };
}

/** Liseré du thème verre, dessiné dans la carte : le parent ne coupe pas l’échelle de focus. */
function TvSheen() {
  const gold = currentFinish() === 'verre-or';
  return <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 18, right: 18, height: 6, borderRadius: 3, backgroundColor: gold ? 'rgba(227,190,90,0.7)' : 'rgba(255,255,255,0.45)' }} />;
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
  const fx = useVisualEffects();
  const relief = isGlass() && fx.blur;
  return (
    <View ref={box} collapsable={false} style={{ flexGrow: block ? 1 : undefined, width: block ? '100%' : undefined, overflow: 'visible' }}>
      <TVPressable
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
        style={chrome(minHeight, block)}
      >
        {(state) => {
          const on = isFocused(state) || hot;
          return (
            <>
              {relief && !on ? <TvSheen /> : null}
              {children(on)}
            </>
          );
        }}
      </TVPressable>
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
        const colors = tvButtonInk(on);
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <View style={tvButtonLabelBox(!!block)}>
              <Text allowFontScaling={false} style={{ color: colors.ink, fontSize: TV_BUTTON_LABEL_SIZE, fontWeight: '800' }}>{label}</Text>
              {hint ? <Text allowFontScaling={false} style={{ color: colors.hint, fontSize: TV_BUTTON_HINT_SIZE, marginTop: 6 }}>{hint}</Text> : null}
              {badge ? <Text allowFontScaling={false} style={{ color: colors.badge, fontSize: TV_BUTTON_HINT_SIZE, fontWeight: '800', marginTop: 8 }}>{badge}</Text> : null}
              {locked ? <Text allowFontScaling={false} style={{ color: colors.badge, fontSize: TV_BUTTON_HINT_SIZE, fontWeight: '800', marginTop: 8 }}>{L('Zikru Premium')}</Text> : null}
            </View>
            {aside ? <Text allowFontScaling={false} style={{ color: colors.ink, fontSize: 40, fontFamily: asideFont }}>{aside}</Text> : null}
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
  const fx = useVisualEffects();
  const relief = isGlass() && fx.blur && !hot;
  return (
    <View ref={box} collapsable={false} style={{ overflow: 'visible' }}>
      <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
      <View style={{ overflow: 'visible' }}>
        {relief ? <TvSheen /> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          hasTVPreferredFocus={arm}
          autoCapitalize={autoCapitalize}
          placeholderTextColor={TV_ON_CARD_MUTED}
          onFocus={() => {
            setHot(true);
            ensure(box.current);
          }}
          onBlur={() => setHot(false)}
          style={[
            {
              color: hot ? TV_FOCUS_INK : TV_ON_CARD,
              fontSize: 34,
              minHeight: 92,
              borderRadius: 18,
              paddingHorizontal: 22,
              paddingTop: relief ? 16 : undefined,
              backgroundColor: TV_CARD_BG,
              overflow: 'visible',
            },
            tvFocusStyle(hot),
          ]}
        />
      </View>
    </View>
  );
}

export function TvBack({ preferred }: { preferred?: boolean }) {
  return <TvButton label={L('Retour')} onPress={() => router.back()} preferred={preferred} />;
}

export function TvPremiumGate({ feature, children }: { feature: TvFeatureId; children: ReactNode }) {
  const premium = usePremium();
  const flags = useFeatureFlags();
  // Gratuit sur iPhone : jamais de mur, même si l’achat n’est pas chargé.
  if (!TV_FEATURES[feature].premium) return <>{children}</>;
  const entitled = tvPremiumActive(premium.record, flags.serverPremium ? { plan: 'premium' } : null);
  if (!premium.ready && !flags.ready) {
    return (
      <TvScroll>
        <TvMuted>{L('Chargement…')}</TvMuted>
      </TvScroll>
    );
  }
  if (tvFeatureAllowed(feature, entitled, premium.payments)) return <>{children}</>;
  return (
    <TvScroll>
      <TvTitle>{L('Zikru Premium')}</TvTitle>
      <TvMuted>
        {L('Achat unique à vie')}
        {' — '}
        {L('Il débloque seulement la création de zikrs personnels et la création de groupes. Le reste de l’application reste gratuit.')}
      </TvMuted>
      <TvMuted>{L('Rejoindre avec une invitation ou une demande acceptée reste gratuit, comme les horaires, la qibla, le Coran, l’adhan, le tasbih et les zikrs déjà inclus.')}</TvMuted>
      <TvMuted>{L('Vous pouvez restaurer cet achat sur vos appareils avec le même compte Apple, depuis l’écran Premium.')}</TvMuted>
      <TvRow>
        <TvButton preferred label={L('Restaurer les achats')} hint={L('Même identifiant Apple que sur iPhone')} onPress={() => void premium.restore()} />
        <TvButton label={L('Retour')} onPress={() => router.back()} />
      </TvRow>
      {premium.phase === 'success' ? <TvMuted>{L('Premium est actif sur cet appareil.')}</TvMuted> : null}
      {premium.phase === 'offline' ? <TvMuted>{L('Pas de connexion. Réessayez quand vous serez en ligne.')}</TvMuted> : null}
    </TvScroll>
  );
}
