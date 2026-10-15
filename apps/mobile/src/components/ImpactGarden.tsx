import { memo } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';
import { useTheme } from '@/lib/theme';

export type FlowerKind = 'rosette' | 'daisy' | 'loops';

/** Tête de fleur au trait, centrée en (0,0), de rayon r. Trois dessins, comme sur la maquette. */
function FlowerHead({ kind, r, stroke, width }: { kind: FlowerKind; r: number; stroke: string; width: number }) {
  if (kind === 'rosette') {
    // Cercles qui se chevauchent autour du centre
    const n = 8;
    return (
      <G>
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2;
          return <Circle key={i} cx={Math.cos(a) * r * 0.5} cy={Math.sin(a) * r * 0.5} r={r * 0.5} stroke={stroke} strokeWidth={width} fill="none" />;
        })}
      </G>
    );
  }
  if (kind === 'daisy') {
    // Pétales en ellipses + cœur
    const n = 6;
    return (
      <G>
        {Array.from({ length: n }, (_, i) => (
          <Ellipse key={i} cx={0} cy={-r * 0.55} rx={r * 0.28} ry={r * 0.45} stroke={stroke} strokeWidth={width} fill="none"
            transform={`rotate(${(i / n) * 360})`} />
        ))}
        <Circle r={r * 0.16} stroke={stroke} strokeWidth={width} fill="none" />
      </G>
    );
  }
  // Boucles qui se croisent au centre
  const n = 4;
  return (
    <G>
      {Array.from({ length: n }, (_, i) => (
        <Ellipse key={i} rx={r} ry={r * 0.35} stroke={stroke} strokeWidth={width} fill="none" transform={`rotate(${(i / n) * 180})`} />
      ))}
      <Circle r={r * 0.12} stroke={stroke} strokeWidth={width} fill="none" />
    </G>
  );
}

/** Petite icône de fleur pour les lignes d'indicateurs. */
export function FlowerIcon({ kind, size = 44 }: { kind: FlowerKind; size?: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="-26 -26 52 52">
      <FlowerHead kind={kind} r={22} stroke={t.text} width={1.6} />
    </Svg>
  );
}

export interface GardenFlower {
  key: string;
  /** Taille relative 0..1 (selon le CO₂ évité) */
  size: number;
}

// Pseudo-aléatoire stable : le jardin ne « bouge » pas d'un affichage à l'autre
function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const KINDS: FlowerKind[] = ['rosette', 'daisy', 'loops'];

/** Le jardin : une fleur par repas qui a évité des émissions. */
export const ImpactGarden = memo(function ImpactGarden({ flowers, width, height }: { flowers: GardenFlower[]; width: number; height: number }) {
  const t = useTheme();
  const ground = height - 6;
  const shown = flowers.slice(0, 30);
  const n = shown.length;

  return (
    <Svg width={width} height={height}>
      {n === 0 ? (
        // Jardin vide : quelques pousses
        [0.3, 0.5, 0.7].map((x, i) => (
          <G key={i}>
            <Line x1={width * x} y1={ground} x2={width * x} y2={ground - 26 - i * 6} stroke={t.text} strokeWidth={1.6} />
            <Path d={`M${width * x} ${ground - 18} q -12 -10 -16 2 q 10 4 16 -2`} stroke={t.text} strokeWidth={1.4} fill="none" />
            <Path d={`M${width * x} ${ground - 22} q 12 -10 16 2 q -10 4 -16 -2`} stroke={t.text} strokeWidth={1.4} fill="none" />
          </G>
        ))
      ) : (
        shown.map((f, i) => {
          const rnd = seeded(f.key);
          // Répartition régulière de gauche à droite, avec un peu de jeu
          const slot = width / (n + 1);
          const x = slot * (i + 1) + (rnd() - 0.5) * slot * 0.6;
          const r = 10 + f.size * Math.min(46, width / 9);
          const top = 18 + r + rnd() * Math.max(0, height * 0.45 - r);
          const y = Math.min(top, ground - r - 24);
          const leafY = y + r + (ground - y - r) * (0.35 + rnd() * 0.4);
          const leafSide = rnd() > 0.5 ? 1 : -1;
          const kind = KINDS[Math.floor(rnd() * KINDS.length)]!;
          return (
            <G key={f.key}>
              <Line x1={x} y1={y + r} x2={x} y2={ground} stroke={t.text} strokeWidth={1.6} />
              <Path d={`M${x} ${leafY} q ${leafSide * 18} -18 ${leafSide * 28} -3 q ${-leafSide * 15} 9 ${-leafSide * 28} 3`} fill={t.text} />
              <G transform={`translate(${x} ${y})`}>
                <FlowerHead kind={kind} r={r} stroke={t.text} width={1.6} />
              </G>
            </G>
          );
        })
      )}
    </Svg>
  );
});
