import { durationClass, totalMinutes, type Recipe } from '@recette/core';
import { router } from 'expo-router';
import { Image, View } from 'react-native';
import { DURATION_LABELS, useTheme } from '@/lib/theme';
import { Body, Card, Muted, Row, Tag } from './ui';

export function RecipeCard({ recipe, reasons, missing }: { recipe: Recipe; reasons?: string[]; missing?: number }) {
  const t = useTheme();
  const dc = durationClass(recipe);
  return (
    <Card onPress={() => router.push(`/recipe/${recipe.id}`)} style={{ flexBasis: 320, flexGrow: 1, maxWidth: 520, padding: 0, overflow: 'hidden' }}>
      {recipe.image_url ? (
        <Image source={{ uri: recipe.image_url }} style={{ width: '100%', height: 150, backgroundColor: t.border }} />
      ) : (
        <View style={{ height: 6, backgroundColor: t.accentSoft }} />
      )}
      <View style={{ padding: 14, gap: 6 }}>
        <Body style={{ fontWeight: '700', fontSize: 17 }}>{recipe.title}</Body>
        <Row wrap gap={6}>
          <Tag label={`${DURATION_LABELS[dc]} · ${totalMinutes(recipe)} min`} tone={dc === 'rapide' ? 'green' : dc === 'moyen' ? 'amber' : 'accent'} />
          {recipe.rating ? <Tag label={'★'.repeat(recipe.rating)} tone="amber" /> : null}
          {missing === 0 ? <Tag label="Tout au frigo" tone="green" /> : null}
        </Row>
        {reasons?.length ? <Muted>{reasons.join(' · ')}</Muted> : null}
      </View>
    </Card>
  );
}
