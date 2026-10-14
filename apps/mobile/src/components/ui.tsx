import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { useTheme } from '@/lib/theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  const inner = <View style={styles.inner}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>{inner}</ScrollView> : inner}
    </View>
  );
}

export function H1({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.h1, { color: t.text }]}>{children}</Text>;
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

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const t = useTheme();
  return <Text style={[{ color: t.muted, fontSize: 14 }, style]}>{children}</Text>;
}

export function Body({ children, style, onPress }: { children: ReactNode; style?: object; onPress?: () => void }) {
  const t = useTheme();
  return <Text onPress={onPress} style={[{ color: t.text, fontSize: 16, lineHeight: 23 }, style]}>{children}</Text>;
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const base = [styles.card, { backgroundColor: t.card, borderColor: t.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.75 }]}>
      {children}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, tone = 'accent' }: {
  label: string; active?: boolean; onPress?: () => void; tone?: 'accent' | 'green' | 'amber' | 'neutral';
}) {
  const t = useTheme();
  const colors = {
    accent: [t.accent, t.accentSoft], green: [t.green, t.greenSoft], amber: [t.amber, t.amberSoft], neutral: [t.muted, t.border],
  }[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, { borderColor: active ? colors[0] : t.border, backgroundColor: active ? colors[1] : t.card }]}
    >
      <Text style={{ color: active ? colors[0] : t.text, fontSize: 14, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'accent' | 'green' | 'amber' | 'neutral' }) {
  const t = useTheme();
  const [fg, bg] = { accent: [t.accent, t.accentSoft], green: [t.green, t.greenSoft], amber: [t.amber, t.amberSoft], neutral: [t.muted, t.border] }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', disabled, loading }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; loading?: boolean;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : variant === 'danger' ? '#B3261E' : t.card;
  const fg = variant === 'secondary' ? t.text : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: variant === 'secondary' ? t.border : bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '600', fontSize: 16 }}>{label}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 4, flexGrow: 1 }}>
      {label ? <Text style={{ color: t.muted, fontSize: 13 }}>{label}</Text> : null}
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
    <View style={{ paddingVertical: 48, alignItems: 'center', gap: 6 }}>
      <Body style={{ fontWeight: '600' }}>{title}</Body>
      {hint ? <Muted style={{ textAlign: 'center' }}>{hint}</Muted> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { padding: 20, gap: 16, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  h1: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  h2Row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  h2: { fontSize: 20, fontWeight: '700' },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  button: { paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});
