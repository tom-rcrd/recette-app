import { formatAdditive, scoreProduct, type Ingredient, type ScoreCriteria, type ScoreLabel } from '@recette/core';
import { router } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { useTheme, type Theme } from '@/lib/theme';
import { Body, Card, Chip, H2, Muted, Row, Tag } from './ui';

const LABELS: Record<ScoreLabel, string> = { excellent: 'Excellent', bon: 'Bon', moyen: 'Moyen', mauvais: 'Mauvais' };

export function scoreColor(t: Theme, label: ScoreLabel): [fg: string, bg: string] {
  return label === 'excellent' || label === 'bon' ? [t.green, t.greenSoft] : label === 'moyen' ? [t.amber, t.amberSoft] : [t.danger, t.dangerSoft];
}

/** Pastille compacte pour les listes : "72/100". */
export function ScoreBadge({ ingredient, criteria }: { ingredient: Ingredient; criteria: ScoreCriteria }) {
  const t = useTheme();
  const s = scoreProduct(ingredient, criteria);
  if (!s) return null;
  const [fg, bg] = scoreColor(t, s.label);
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 12 }}>{s.score}/100</Text>
    </View>
  );
}

const NUTRISCORE_COLORS: Record<string, string> = { a: '#038141', b: '#85BB2F', c: '#FECB02', d: '#EE8100', e: '#E63E11' };

/** Carte détaillée de la fiche produit : note perso, Nutri-Score, NOVA, additifs. */
export function ProductScoreCard({ ingredient, criteria }: { ingredient: Ingredient; criteria: ScoreCriteria }) {
  const t = useTheme();
  const s = scoreProduct(ingredient, criteria);
  const grade = ingredient.nutriscore_grade;
  const [fg, bg] = s ? scoreColor(t, s.label) : [t.muted, t.border];

  return (
    <Card>
      <Row style={{ alignItems: 'flex-start', gap: 16 }}>
        {ingredient.image_url ? (
          <Image source={{ uri: ingredient.image_url }} style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: t.border }} resizeMode="contain" />
        ) : null}
        <View style={{ flex: 1, gap: 8 }}>
          <H2 right={<Chip label="Mes critères" onPress={() => router.push('/criteria')} />}>Note perso</H2>
          {s ? (
            <Row>
              <View style={{ backgroundColor: bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ color: fg, fontSize: 28, fontWeight: '800' }}>{s.score}<Text style={{ fontSize: 14 }}>/100</Text></Text>
              </View>
              <Body style={{ color: fg, fontWeight: '700' }}>{LABELS[s.label]}</Body>
            </Row>
          ) : <Muted>Pas assez de données pour noter ce produit.</Muted>}
          {s?.reasons.map((r) => <Muted key={r}>• {r}</Muted>)}
        </View>
      </Row>
      <Row wrap>
        {grade ? (
          <View style={{ backgroundColor: NUTRISCORE_COLORS[grade], borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Nutri-Score {grade.toUpperCase()}</Text>
          </View>
        ) : null}
        {ingredient.nova_group ? <Tag label={`NOVA ${ingredient.nova_group}`} tone={ingredient.nova_group >= 4 ? 'danger' : ingredient.nova_group === 3 ? 'amber' : 'green'} /> : null}
        {(ingredient.additives ?? []).map((a) => (
          <Tag key={a} label={formatAdditive(a)} tone={criteria.avoidAdditives.includes(a) ? 'danger' : 'neutral'} />
        ))}
        {(ingredient.analysis_tags ?? []).includes('en:palm-oil') ? <Tag label="huile de palme" tone="amber" /> : null}
      </Row>
      {ingredient.barcode ? <Muted style={{ fontSize: 12 }}>Code-barres {ingredient.barcode} · données Open Food Facts (ODbL)</Muted> : null}
    </Card>
  );
}
