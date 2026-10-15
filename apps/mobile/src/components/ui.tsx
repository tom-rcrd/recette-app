import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { Doodle } from './Doodle';
import { interactive, lifted, useHover } from '@/lib/hover';
import { FONTS, useTheme, type Theme } from '@/lib/theme';

export type Tone = 'accent' | 'green' | 'amber' | 'danger' | 'neutral';

export function toneColors(t: Theme, tone: Tone): [fg: string, bg: string] {
  return {
    accent: [t.accent, t.accentSoft], green: [t.green, t.greenSoft], amber: [t.amber, t.amberSoft],
    danger: [t.danger, t.dangerSoft], neutral: [t.muted, t.surface],
  }[tone] as [string, string];
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  const inner = <View style={styles.inner}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>{inner}</ScrollView> : inner}
    </View>
  );
}

/** Titre en serif (Young Serif), comme la DA. */
export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[styles.h1, { color: t.text }, style]}>{children}</Text>;
}

export function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.h2Row}>
      <Text style={[styles.h2, { color: t.text }]}>{children}</Text>
      {right}
    </View>
  );
}

/** Petit libellé en capitales espacées (« POUR LE DÎNER »). */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: t.muted, fontFamily: FONTS.medium, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: t.muted, fontSize: 14, fontFamily: FONTS.regular }, style]}>{children}</Text>;
}

export function Body({ children, style, onPress }: { children: ReactNode; style?: StyleProp<TextStyle>; onPress?: () => void }) {
  const t = useTheme();
  return <Text onPress={onPress} style={[{ color: t.text, fontSize: 16, lineHeight: 23, fontFamily: FONTS.regular }, style]}>{children}</Text>;
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const { hovered, hoverProps } = useHover();
  const base = [styles.card, { backgroundColor: t.card, borderColor: t.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} {...hoverProps}
      style={({ pressed }) => [...base, interactive, hovered && [lifted, { borderColor: t.muted }], pressed && { opacity: 0.8 }]}>
      {children}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, tone = 'accent' }: {
  label: string; active?: boolean; onPress?: () => void; tone?: Tone;
}) {
  const t = useTheme();
  const { hovered, hoverProps } = useHover();
  const [fg, bg] = toneColors(t, tone);
  const hover = hovered && !!onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      {...hoverProps}
      style={[
        styles.chip,
        { borderColor: active || hover ? fg : t.border, backgroundColor: active || hover ? bg : t.card },
        onPress ? interactive : null,
      ]}
    >
      <Text style={{ color: active ? fg : t.text, fontSize: 14, fontFamily: active ? FONTS.semibold : FONTS.regular }}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = useTheme();
  const [fg, bg] = toneColors(t, tone);
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontFamily: FONTS.semibold }}>{label}</Text>
    </View>
  );
}

/** Pastille foncée façon DA (« 🗓 7 jours »). */
export function Pill({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start' }}>
      <Text style={{ color: t.onAccent, fontSize: 13, fontFamily: FONTS.medium }}>{label}</Text>
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', disabled, loading }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; loading?: boolean;
}) {
  const t = useTheme();
  const { hovered, hoverProps } = useHover();
  const bg = variant === 'primary' ? t.accent : variant === 'danger' ? t.danger : t.card;
  const fg = variant === 'secondary' ? t.text : t.onAccent;
  const hover = hovered && !disabled && !loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      {...hoverProps}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? (hover ? t.muted : t.border) : bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        interactive,
        hover && (variant === 'secondary' ? { backgroundColor: t.surface } : { opacity: 0.88, transform: [{ translateY: -1 }] }),
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontFamily: FONTS.semibold, fontSize: 16 }}>{label}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 4, flexGrow: 1 }}>
      {label ? <Text style={{ color: t.muted, fontSize: 13, fontFamily: FONTS.regular }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.muted}
        {...rest}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }, style]}
      />
    </View>
  );
}

export function Row({ children, gap = 8, wrap, style }: { children: ReactNode; gap?: number; wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Loading() {
  const t = useTheme();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}><ActivityIndicator color={t.accent} /></View>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ paddingVertical: 32, alignItems: 'center', gap: 6 }}>
      <Doodle name="laying" width={200} />
      <Body style={{ fontFamily: FONTS.semibold }}>{title}</Body>
      {hint ? <Muted style={{ textAlign: 'center' }}>{hint}</Muted> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { padding: 20, gap: 16, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  h1: { fontSize: 32, fontFamily: FONTS.serif, letterSpacing: -0.5 },
  h2Row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  h2: { fontSize: 22, fontFamily: FONTS.serif },
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  button: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, fontFamily: FONTS.regular },
});
