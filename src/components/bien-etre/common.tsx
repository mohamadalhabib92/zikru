import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { Text } from "@/ui/Text";
import { loadUthmani } from "@/lib/quran-reader-data";
import { Container, HeroHeader, tapHaptic } from "@/ui/ds";
import { alpha, brand as b, onColor } from "@/ui/theme";
import { L } from "@/lib/l10n";

/** Préférence système « Réduire les animations » (iOS, Android, navigateur), suivie en direct. */
export function useReduceMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setOn(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setOn(!!v),
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return on;
}

/** Retour haptique doux ; sur le web, courte vibration quand le navigateur la permet (Android). */
export function softHaptic(
  kind: "light" | "medium" | "success" | "select" = "light",
) {
  if (Platform.OS !== "web") return tapHaptic(kind);
  try {
    const nav = globalThis.navigator as Navigator | undefined;
    nav?.vibrate?.(
      kind === "success" ? [20, 60, 20] : kind === "medium" ? 18 : 8,
    );
  } catch {}
}

/** Annonce pour lecteur d’écran (séance les yeux fermés). */
export const announce = (s: string) => {
  try {
    AccessibilityInfo.announceForAccessibility(s);
  } catch {}
};

/** Texte uthmani Tanzil (chargé à la demande, partagé avec le lecteur). */
export function useUthmani(): string[] | null {
  const [v, setV] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadUthmani().then((x) => alive && setV(x));
    return () => {
      alive = false;
    };
  }, []);
  return v;
}

/** Horloge monotone (requestAnimationFrame) : temps écoulé en ms tant que `running`. */
export function useClock(
  running: boolean,
  onTick?: (prev: number, now: number) => void,
) {
  const [t, setT] = useState(0);
  const acc = useRef(0);
  const tick = useRef(onTick);
  useEffect(() => {
    tick.current = onTick;
  });
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      const prev = acc.current;
      acc.current += Math.min(1000, now - last);
      last = now;
      tick.current?.(prev, acc.current);
      setT(acc.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  const reset = () => {
    acc.current = 0;
    setT(0);
  };
  return { t, reset };
}

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Gabarit d’écran du module : fond, largeur max, en-tête discret. */
export function BEScreen({
  title,
  sub,
  children,
  bg,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  bg?: string;
}) {
  return (
    <>
      <Stack.Screen options={{ title: L(title) }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: bg ?? b.cream }}
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Container max={720} style={{ padding: 16, gap: 14 }}>
          <HeroHeader>
            <Text
              accessibilityRole="header"
              style={{ color: b.heroText, fontSize: 22, fontWeight: "900" }}
            >
              {title}
            </Text>
            {sub ? (
              <Text
                style={{ color: b.heroMuted, marginTop: 4, lineHeight: 20 }}
              >
                {sub}
              </Text>
            ) : null}
          </HeroHeader>
          {children}
        </Container>
      </ScrollView>
    </>
  );
}

/** Choix à pastilles (cible ≥ 44 pt), une seule valeur. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  label,
  color = b.green,
}: {
  options: { label: string; value: T; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  color?: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label ? L(label) : undefined}
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            accessibilityLabel={L(o.label) + (o.sub ? ", " + L(o.sub) : "")}
            onPress={() => {
              softHaptic("select");
              onChange(o.value);
            }}
            style={{
              minHeight: 44,
              minWidth: 44,
              paddingHorizontal: 14,
              paddingVertical: 8,
              justifyContent: "center",
              borderRadius: 22,
              borderWidth: on ? 2 : 1,
              borderColor: on ? color : b.line,
              backgroundColor: on ? color : b.paper,
            }}
          >
            <Text
              maxFontSizeMultiplier={1.35}
              style={{
                color: on ? onColor(color) : b.ink,
                fontWeight: "800",
                fontSize: 14,
                textAlign: "center",
              }}
            >
              {o.label}
            </Text>
            {o.sub ? (
              <Text
                maxFontSizeMultiplier={1.35}
                style={{
                  color: on ? onColor(color) : b.inkMuted,
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                {o.sub}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Carte sobre du module. */
export function Panel({
  children,
  tint,
}: {
  children: ReactNode;
  tint?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: tint ? alpha(tint, 0.08) : b.paper,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: tint ? alpha(tint, 0.35) : b.line,
        padding: 16,
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}
