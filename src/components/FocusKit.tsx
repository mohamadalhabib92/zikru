/**
 * Mode Focus : anneau de minutes, sortie d'urgence (appui long 3 s + confirmation),
 * pastille flottante, feuille « Verrouiller le téléphone sur l'app ».
 */
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EMERGENCY_HOLD_MS, FOCUS_MIN_MINUTES, formatClock, remainingMs } from '@/lib/focus-core';
import { tickFocus, useFocus } from '@/lib/focus';
import { canPinNatively, openLockSettings, pinApp } from '@/lib/focus-lock';
import { useI18n } from '@/lib/focus-i18n';
import { currentScheme, radius, space, theme as colors } from '@/ui/theme';
import { haptic } from '@/ui/haptics';
import { PressableScale, useReducedMotion } from '@/ui/motion';

/** Couleur de l'anneau : calme, contrastée sur le fond (≥ 3:1). */
export const focusRing = () => colors.primary;
const native = Platform.OS !== 'web';

/** Re-rendu chaque seconde (et fin de séance détectée) tant qu'une séance tourne. */
export function useFocusClock() {
  const f = useFocus();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!f.active) return;
    const id = setInterval(() => {
      tickFocus();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [f.active?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Jamais avant le dernier instant connu de la séance (horloge figée entre deux ticks).
  const a = f.active;
  return { f, now: a ? Math.max(now, a.seenAt, a.runningSince ?? 0, a.awaySince ?? 0) : now };
}

/** 60 traits de minute : ceux déjà parcourus s'allument. Sans SVG, léger, net à toute taille. */
export function TickRing({ size, progress, children, label, valueText, breathe = true }: { size: number; progress: number; children?: React.ReactNode; label: string; valueText: string; breathe?: boolean }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced || !breathe) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, reduced, breathe]);
  const N = 60;
  const lit = Math.round(Math.max(0, Math.min(1, progress)) * N);
  const tickH = Math.max(8, size * 0.06);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.86, 0.94] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.18] });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100), text: valueText }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: focusRing(), opacity: reduced || !breathe ? 0.1 : opacity, transform: [{ scale: reduced || !breathe ? 0.9 : scale }] }]}
      />
      {Array.from({ length: N }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: 3,
            height: tickH,
            borderRadius: 2,
            backgroundColor: i < lit ? focusRing() : colors.border,
            transform: [{ rotate: `${(i * 360) / N}deg` }, { translateY: -(size / 2 - tickH / 2) }],
          }}
        />
      ))}
      {children}
    </View>
  );
}

/** Sortie d'urgence : maintenir 3 s, puis confirmer. Action accessible : « Sortie d'urgence » (appui long). */
export function EmergencyExit({ onConfirmed, minutesLeft }: { onConfirmed: () => void; minutesLeft: number }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [fill] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    fill.stopAnimation();
    Animated.timing(fill, { toValue: 0, duration: reduced ? 0 : 200, useNativeDriver: false }).start();
  };
  const begin = () => {
    setHolding(true);
    haptic('select');
    Animated.timing(fill, { toValue: 1, duration: EMERGENCY_HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start();
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      fill.setValue(0);
      haptic('warning');
      setConfirm(true);
    }, EMERGENCY_HOLD_MS);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <>
      <Pressable
        onPressIn={begin}
        onPressOut={() => {
          if (timer.current) cancel();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('focusEmergency')}
        accessibilityHint={t('focusEmergencyA11yHint')}
        accessibilityActions={[{ name: 'activate', label: t('focusEmergency') }, { name: 'longpress', label: t('focusEmergency') }]}
        onAccessibilityAction={() => setConfirm(true)}
        style={styles_().exit}
      >
        <Animated.View style={[styles_().exitFill, { width }]} />
        <Ionicons name="exit-outline" size={16} color={colors.muted} />
        <Text maxFontSizeMultiplier={1.6} style={styles_().exitText}>
          {holding ? t('focusEmergencyHolding') : t('focusEmergency')}
        </Text>
      </Pressable>
      <Text maxFontSizeMultiplier={1.6} style={styles_().exitHint} importantForAccessibility="no" accessibilityElementsHidden>
        {t('focusEmergencyHint')}
      </Text>
      <Modal visible={confirm} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setConfirm(false)}>
        <View style={styles_().scrim}>
          <View style={styles_().dialog} accessibilityViewIsModal>
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={styles_().dialogTitle}>
              {t('focusConfirmTitle')}
            </Text>
            <Text maxFontSizeMultiplier={1.8} style={styles_().dialogText}>
              {t('focusConfirmText', { n: minutesLeft })}
            </Text>
            <PressableScale accessibilityRole="button" accessibilityLabel={t('focusConfirmStay')} onPress={() => setConfirm(false)} style={[styles_().dlgBtn, { backgroundColor: focusRing() }]}>
              <Text maxFontSizeMultiplier={1.6} style={[styles_().dlgBtnText, { color: colors.onPrimary }]}>{t('focusConfirmStay')}</Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('focusConfirmLeave')}
              hapticKind="warning"
              onPress={() => {
                setConfirm(false);
                onConfirmed();
              }}
              style={[styles_().dlgBtn, { borderWidth: 1, borderColor: colors.border }]}
            >
              <Text maxFontSizeMultiplier={1.6} style={[styles_().dlgBtnText, { color: colors.danger }]}>{t('focusConfirmLeave')}</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </>
  );
}

/** Pastille flottante : visible partout pendant la séance, sauf sur l'écran du minuteur. */
export function FocusPill() {
  const { t } = useI18n();
  const { f, now } = useFocusClock();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const prev = useRef(f.finished);
  // Fin de séance pendant une leçon : on ramène doucement au moment de réussite.
  useEffect(() => {
    if (f.finished && f.finished !== prev.current && path !== '/focus') router.push('/focus');
    prev.current = f.finished;
  }, [f.finished, path]);
  if (!f.active || path === '/focus') return null;
  const left = formatClock(remainingMs(f.active, now));
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { alignItems: 'center' }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('focusPillA11y', { t: left })}
        onPress={() => router.push('/focus')}
        style={[styles_().pill, { top: insets.top + 6 }]}
      >
        <View style={styles_().pillDot} />
        <Text maxFontSizeMultiplier={1.4} style={styles_().pillText}>
          {t('focusTitle')} · {left}
        </Text>
      </PressableScale>
    </View>
  );
}

/** Feuille à régler une fois : Accès guidé / Concentration iOS, épinglage Android. Copie honnête sur les limites. */
export function LockSetupSheet({ visible, onClose, focusName }: { visible: boolean; onClose: () => void; focusName: string }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === 'ios' || Platform.OS === 'web';
  const android = Platform.OS === 'android' || Platform.OS === 'web';
  return (
    <Modal visible={visible} animationType={reduced ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <View style={[styles_().sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.lg }}>
          <View style={styles_().sheetIcon}>
            <Ionicons name="lock-closed" size={22} color={colors.onPrimary} />
          </View>
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={styles_().sheetTitle}>
            {t('lockTitle')}
          </Text>
          <Text maxFontSizeMultiplier={1.8} style={styles_().sheetBody}>{t('lockIntro')}</Text>
          {Platform.OS === 'web' ? <Text maxFontSizeMultiplier={1.8} style={styles_().sheetNote}>{t('lockWebNote')}</Text> : null}
          {ios ? (
            <>
              <Steps icon="hand-left-outline" title={t('lockIosGaTitle')} steps={[t('lockIosGa1'), t('lockIosGa2'), t('lockIosGa3')]} />
              <Steps icon="moon-outline" title={t('lockIosFocusTitle', { name: focusName })} steps={[t('lockIosFocus1', { name: focusName }), t('lockIosFocus2'), t('lockIosFocus3'), t('lockIosFocus4')]} />
            </>
          ) : null}
          {android ? (
            <Steps icon="pin-outline" title={t('lockAndroidTitle')} steps={[t('lockAndroid1'), t('lockAndroid2'), t('lockAndroid3'), t('lockAndroid4')]} />
          ) : null}
          <View style={styles_().honest}>
            <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
            <Text maxFontSizeMultiplier={1.8} style={[styles_().sheetNote, { flex: 1 }]}>{t('lockHonest')}</Text>
          </View>
          {Platform.OS !== 'web' ? (
            <PressableScale accessibilityRole="button" accessibilityLabel={t('lockOpenSettings')} accessibilityHint={Platform.OS === 'ios' ? t('lockOpenSettingsHintIos') : undefined} onPress={() => void openLockSettings()} style={[styles_().dlgBtn, { borderWidth: 1, borderColor: colors.border }]}>
              <Text maxFontSizeMultiplier={1.6} style={[styles_().dlgBtnText, { color: colors.text }]}>{t('lockOpenSettings')}</Text>
            </PressableScale>
          ) : null}
          {Platform.OS === 'ios' ? <Text maxFontSizeMultiplier={1.8} style={styles_().sheetNote}>{t('lockOpenSettingsHintIos')}</Text> : null}
          {canPinNatively() ? (
            <PressableScale accessibilityRole="button" accessibilityLabel={t('lockPinNow')} onPress={() => void pinApp()} style={[styles_().dlgBtn, { borderWidth: 1, borderColor: colors.border }]}>
              <Text maxFontSizeMultiplier={1.6} style={[styles_().dlgBtnText, { color: colors.text }]}>{t('lockPinNow')}</Text>
            </PressableScale>
          ) : null}
        </ScrollView>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('lockDone')} onPress={onClose} style={[styles_().dlgBtn, { backgroundColor: focusRing() }]}>
          <Text maxFontSizeMultiplier={1.6} style={[styles_().dlgBtnText, { color: colors.onPrimary }]}>{t('lockDone')}</Text>
        </PressableScale>
      </View>
    </Modal>
  );
}

function Steps({ icon, title, steps }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; steps: string[] }) {
  return (
    <View style={styles_().steps}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Ionicons name={icon} size={18} color={focusRing()} />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={styles_().stepsTitle}>{title}</Text>
      </View>
      {steps.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.sm }} accessible accessibilityLabel={`${i + 1}. ${s}`}>
          <View style={styles_().stepNum}>
            <Text maxFontSizeMultiplier={1.4} style={styles_().stepNumText}>{i + 1}</Text>
          </View>
          <Text maxFontSizeMultiplier={1.8} style={[styles_().sheetBody, { flex: 1 }]}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

const make_styles = () => StyleSheet.create({
  exit: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  exitFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.surfaceAlt },
  exitText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  exitHint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.xl, gap: space.md },
  dialogTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  dialogText: { fontSize: 15, lineHeight: 22, color: colors.muted },
  dlgBtn: { minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  dlgBtnText: { fontSize: 16, fontWeight: '700' },
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.text,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface },
  pillText: { color: colors.surface, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sheet: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  sheetIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: focusRing(), alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  sheetBody: { fontSize: 15, lineHeight: 22, color: colors.text },
  sheetNote: { fontSize: 13, lineHeight: 19, color: colors.muted },
  honest: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  steps: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: colors.border },
  stepsTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontSize: 12, fontWeight: '700', color: colors.text },
});

/** Carte d'accès (accueil) : calme, et indique la séance en cours. */
export function FocusEntryCard() {
  const { t } = useI18n();
  const { f, now } = useFocusClock();
  const live = f.active ? formatClock(remainingMs(f.active, now)) : null;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={live ? t('focusPillA11y', { t: live }) : `${t('focusHomeTitle')}. ${t('focusHomeText', { min: FOCUS_MIN_MINUTES })}`}
      onPress={() => router.push('/focus')}
      style={entryStyles_().entry}
    >
      <View style={entryStyles_().entryIcon}>
        <Ionicons name="leaf-outline" size={20} color={colors.onPrimary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text maxFontSizeMultiplier={1.6} style={entryStyles_().entryTitle}>{live ? `${t('focusHomeTitle')} · ${live}` : t('focusHomeTitle')}</Text>
        <Text maxFontSizeMultiplier={1.8} style={entryStyles_().entryText}>{t('focusHomeText', { min: FOCUS_MIN_MINUTES })}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </PressableScale>
  );
}
const make_entryStyles = () => StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minHeight: 72 },
  entryIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: focusRing(), alignItems: 'center', justifyContent: 'center' },
  entryTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  entryText: { fontSize: 14, lineHeight: 20, color: colors.muted },
});

const cache_styles: Record<string, ReturnType<typeof make_styles>> = {};
const styles_ = () => (cache_styles[currentScheme()] ??= make_styles());

const cache_entryStyles: Record<string, ReturnType<typeof make_entryStyles>> = {};
const entryStyles_ = () => (cache_entryStyles[currentScheme()] ??= make_entryStyles());
