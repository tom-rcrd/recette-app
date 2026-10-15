import { useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { interactive, lifted, useHover } from '@/lib/hover';
import { useTheme } from '@/lib/theme';

/** Grande tuile cliquable (sélection d'un repas, d'une envie…). */
export function Tile({ icon, label, hint, active, onPress, style }: {
  icon: string;
  label: string;
  hint?: string;
  active?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      onPress={onPress}
      {...hoverProps}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [{
        flexBasis: 170, flexGrow: 1, minHeight: 128, borderRadius: 20, padding: 18, gap: 6,
        justifyContent: 'space-between',
        backgroundColor: active ? t.accentSoft : t.card,
        borderWidth: 2, borderColor: active || hovered ? t.accent : t.border,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      }, interactive, hovered && !pressed && lifted, style]}
    >
      <Text style={{ fontSize: 34 }}>{icon}</Text>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: active ? t.accent : t.text }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 13, color: t.muted }}>{hint}</Text> : null}
      </View>
      {active ? (
        <View style={{ position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 13, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.onAccent, fontWeight: '800' }}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Indicateur d'étapes cliquable : 1 Repas — 2 Envies — 3 Suggestions. */
export function Stepper({ steps, current, onSelect }: { steps: string[]; current: number; onSelect: (i: number) => void }) {
  const t = useTheme();
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => onSelect(i)} disabled={i > current} hitSlop={8}
              onHoverIn={() => setHoveredStep(i)} onHoverOut={() => setHoveredStep(null)}
              style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: i > current ? 0.45 : 1 }, i <= current ? interactive : null]}>
              <View style={{
                width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                backgroundColor: active || done ? t.accent : t.border,
              }}>
                <Text style={{ color: active || done ? t.onAccent : t.muted, fontWeight: '800' }}>{done ? '✓' : i + 1}</Text>
              </View>
              <Text style={{
                fontSize: 15, fontWeight: active ? '700' : '500', color: active || (hoveredStep === i && i < current) ? t.text : t.muted,
                textDecorationLine: hoveredStep === i && i < current ? 'underline' : 'none',
              }}>{label}</Text>
            </Pressable>
            {i < steps.length - 1 ? <View style={{ width: 28, height: 2, backgroundColor: done ? t.accent : t.border }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Gros bouton d'action principal. */
export function BigButton({ label, onPress, variant = 'primary', disabled }: {
  label: string; onPress: () => void; variant?: 'primary' | 'ghost'; disabled?: boolean;
}) {
  const t = useTheme();
  const { hovered, hoverProps } = useHover();
  const primary = variant === 'primary';
  const hover = hovered && !disabled;
  return (
    <Pressable onPress={onPress} disabled={disabled} {...hoverProps}
      style={({ pressed }) => [interactive, {
        paddingHorizontal: 28, paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        backgroundColor: primary ? t.accent : 'transparent', borderWidth: primary ? 0 : 2, borderColor: t.border,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1, minWidth: 200,
      }, hover && (primary
        ? { transform: [{ translateY: -2 }], boxShadow: '0 8px 20px rgba(59, 43, 36, 0.28)' }
        : { borderColor: t.muted, backgroundColor: t.surface })]}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: primary ? t.onAccent : t.text }}>{label}</Text>
    </Pressable>
  );
}
