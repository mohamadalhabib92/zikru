import { createContext, forwardRef, useState, type ElementRef, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { tvFocusChrome } from '@/lib/tv-surface';

type PressState = { pressed: boolean; focused?: boolean };

/** Vrai quand le texte est à l’intérieur d’un contrôle tvOS focalisé. Faux partout ailleurs, y compris sur iPhone. */
export const TvFocusContext = createContext(false);

function isOn(state: PressState, hot: boolean): boolean {
  return Boolean(state.focused) || hot;
}

/**
 * Focus du salon : fond crème, bord cuivre, échelle 1,05, ombre légère.
 * Au repos, pas de fond imposé : la carte sombre du contrôle reste visible.
 * L’opacité reste à 1.
 */
export function tvFocusStyle(on: boolean): ViewStyle {
  const chrome = tvFocusChrome(on);
  return {
    opacity: 1,
    borderWidth: chrome.borderWidth,
    borderColor: chrome.borderColor,
    backgroundColor: chrome.backgroundColor,
    transform: [{ scale: chrome.scale }],
    overflow: 'visible',
    shadowColor: chrome.shadowColor,
    shadowOpacity: chrome.shadowOpacity,
    shadowRadius: chrome.shadowRadius,
    shadowOffset: { width: 0, height: chrome.shadowOffsetY },
    elevation: on ? 6 : 0,
  };
}

type Props = PressableProps & { tvPlain?: boolean };
type Host = ElementRef<typeof Pressable>;

function userStyle(style: Props['style'], state: PressState): StyleProp<ViewStyle> {
  if (typeof style === 'function') return style(state);
  return style;
}

const TvInner = forwardRef<Host, Props>(function TvInner({ style, children, onFocus, onBlur, tvPlain: _plain, ...rest }, ref) {
  const [hot, setHot] = useState(false);
  return (
    <Pressable
      ref={ref}
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
});

/**
 * Sur iPhone, c’est le Pressable d’origine, props inchangées.
 * Sur Apple TV, le même composant suit le focus (onFocus/onBlur et l’état `focused`).
 */
export const TVPressable = forwardRef<Host, Props>(function TVPressable(props, ref) {
  if (!Platform.isTV || props.tvPlain) {
    const { tvPlain: _plain, ...rest } = props;
    return <Pressable ref={ref} {...rest} />;
  }
  return <TvInner ref={ref} {...props} />;
});

export type TVPressableProps = Props;
