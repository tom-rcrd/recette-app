import { useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';

/**
 * Survol à la souris (desktop / web). Sur iPad sans souris, hovered reste false.
 * Usage : const { hovered, hoverProps } = useHover(); <Pressable {...hoverProps} … />
 */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    hoverProps: { onHoverIn: () => setHovered(true), onHoverOut: () => setHovered(false) },
  };
}

/** Curseur main + transition douce, uniquement sur le web (propriétés CSS ignorées en natif). */
export const interactive: ViewStyle = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'transform, box-shadow, background-color, border-color, opacity', transitionDuration: '150ms' } as ViewStyle)
  : {};

/** Élévation au survol : légère montée + ombre portée. */
export const lifted: ViewStyle = {
  transform: [{ translateY: -3 }],
  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.10)',
};
