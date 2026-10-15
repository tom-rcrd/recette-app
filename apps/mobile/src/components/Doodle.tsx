import { memo, useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { DOODLES, type DoodleName } from '@/assets/doodles';
import { useTheme } from '@/lib/theme';

/**
 * Illustration au trait (Open Doodles, CC0), teintée aux couleurs du thème :
 * trait = brun du texte, aplat = beige des blocs (ou une couleur choisie).
 * Les illustrations sont au format 4:3.
 */
export const Doodle = memo(function Doodle({ name, width, ink, accent }: {
  name: DoodleName; width: number; ink?: string; accent?: string;
}) {
  const t = useTheme();
  const xml = useMemo(
    () => DOODLES[name].replace(/\{\{INK\}\}/g, ink ?? t.text).replace(/\{\{ACCENT\}\}/g, accent ?? t.accentSoft),
    [name, ink, accent, t.text, t.accentSoft],
  );
  return <SvgXml xml={xml} width={width} height={(width * 3) / 4} />;
});
