import { createContext, useState, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type PressState = { pressed: boolean; focused?: boolean };

/** Vrai quand le texte est à l’intérieur d’un contrôle tvOS focalisé. Faux partout ailleurs, y compris sur iPhone. */
export const TvFocusContext = createContext(false);

const FOCUS_FILL = '#F6E7B8';
const FOCUS_EDGE = '#FFFFFF';

function isOn(state: PressState, hot: boolean): boolean {
  return Boolean(state.focused) || hot;
}

/**
 * Fond inversé, bord blanc 4 pt, échelle 1,08. Ombre seulement sur l’élément focalisé.
 * L’opacité reste à 1 : un voile à 0,65 faisait passer les hints et le badge Premium sous le contraste.
 */
export function tvFocusStyle(on: boolean): ViewStyle {
  const base: ViewStyle = {
    opacity: 1,
    borderWidth: 4,
    borderColor: on ? FOCUS_EDGE : 'transparent',
    transform: [{ scale: on ? 1.08 : 1 }],
    overflow: 'visible',
  };
  if (!on) return base;
  return {
    ...base,
    backgroundColor: FOCUS_FILL,
    shadowColor: FOCUS_FILL,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  };
}

type Props = PressableProps & { tvPlain?: boolean };

function userStyle(style: Props['style'], state: PressState): StyleProp<ViewStyle> {
  if (typeof style === 'function') return style(state);
  return style;
}

function TvInner({ style, children, onFocus, onBlur, tvPlain: _plain, ...rest }: Props) {
  const [hot, setHot] = useState(false);
  return (
    <Pressable
      {...rest}
      onFocus={(e) => {
        setHot(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setHot(false);
        onBlur?.(e);
      }}
      style={(state) => {
        const on = isOn(state as PressState, hot);
        return [userStyle(style, state as PressState), tvFocusStyle(on)];
      }}
      {...(Platform.isTV ? { tvParallaxProperties: { enabled: false } } : {})}
    >
      {(state) => {
        const on = isOn(state as PressState, hot);
        const inner = typeof children === 'function' ? children(state) : children;
        return <TvFocusContext.Provider value={on}>{inner as ReactNode}</TvFocusContext.Provider>;
      }}
    </Pressable>
  );
}

/**
 * Sur iPhone, c’est le Pressable d’origine, props inchangées.
 * Sur Apple TV, le même composant prend l’état focus (onFocus/onBlur et le callback `focused`).
 */
export function TVPressable(props: Props) {
  if (!Platform.isTV || props.tvPlain) {
    const { tvPlain: _plain, ...rest } = props;
    return <Pressable {...rest} />;
  }
  return <TvInner {...props} />;
}

export type TVPressableProps = Props;
