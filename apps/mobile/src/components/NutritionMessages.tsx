import type { NutritionMessage } from '@recette/core';
import { Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

/** Points d'attention (gradués) puis points forts d'une portion. */
export function NutritionMessageList({ messages }: { messages: NutritionMessage[] }) {
  const t = useTheme();
  const attention = messages.filter((m) => m.tone === 'attention');
  const positive = messages.filter((m) => m.tone === 'positive');
  if (!messages.length) return null;

  // Couleur selon l'intensité : modéré → ambre, élevé/très élevé → rouge brique
  const color = (m: NutritionMessage) => (m.tone === 'positive' ? t.green : m.level >= 2 ? t.danger : t.amber);
  const soft = (m: NutritionMessage) => (m.tone === 'positive' ? t.greenSoft : m.level >= 2 ? t.dangerSoft : t.amberSoft);

  const row = (m: NutritionMessage) => (
    <View key={m.key} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: soft(m), alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Text style={{ color: color(m), fontWeight: '800', fontSize: 12 }}>{m.tone === 'positive' ? '✓' : '!'.repeat(Math.min(m.level, 3))}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.text, fontSize: 15 }}>
          <Text style={{ fontWeight: '700', color: color(m) }}>{m.title}</Text>
          <Text style={{ color: t.muted }}> · {m.detail}</Text>
        </Text>
        {m.tip ? <Text style={{ color: t.text, fontSize: 14 }}>💡 {m.tip}</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={{ gap: 14, marginTop: 4 }}>
      {positive.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: t.green, letterSpacing: 0.6, textTransform: 'uppercase' }}>Points forts</Text>
          {positive.map(row)}
        </View>
      ) : null}
      {attention.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: t.amber, letterSpacing: 0.6, textTransform: 'uppercase' }}>Points d’attention</Text>
          {attention.map(row)}
        </View>
      ) : null}
      <Text style={{ fontSize: 12, color: t.muted }}>
        Repères par portion, comparés aux apports de référence d’un adulte (sel 6 g, sucres 90 g, graisses saturées 20 g, fibres ~30 g par jour). Un plat se juge dans la semaine, pas seul.
      </Text>
    </View>
  );
}
