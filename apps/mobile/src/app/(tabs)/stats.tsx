import { computeStats } from '@recette/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Body, Card, Chip, H2, Loading, Muted, Row, Screen } from '@/components/ui';
import { useData } from '@/lib/data';
import { useTheme } from '@/lib/theme';

const PERIODS = [['7 jours', 7], ['30 jours', 30], ['Depuis le début', null]] as const;

export default function Stats() {
  const t = useTheme();
  const { loading, household, history, recipes, catalog } = useData();
  const [days, setDays] = useState<number | null>(30);

  const stats = useMemo(() => {
    const since = days ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10) : undefined;
    return computeStats(history, recipes, catalog, household?.reference_meal_price ?? 12, since);
  }, [history, recipes, catalog, household, days]);

  if (loading) return <Loading />;

  const tiles = [
    ['Repas cuisinés', String(stats.mealsCooked)],
    ['Portions', String(Math.round(stats.servingsCooked))],
    ['Argent économisé', `${Math.round(stats.moneySaved)} €`],
    ['Aliments sauvés', String(stats.foodSaved)],
  ];

  return (
    <Screen>
      <Row wrap>
        {PERIODS.map(([label, d]) => <Chip key={label} label={label} active={days === d} onPress={() => setDays(d)} />)}
      </Row>
      <Row wrap gap={12} style={{ alignItems: 'stretch' }}>
        {tiles.map(([label, value]) => (
          <Card key={label} style={{ flexBasis: 180, flexGrow: 1 }}>
            <Muted>{label}</Muted>
            <Body style={{ fontSize: 32, fontWeight: '700', color: t.green }}>{value}</Body>
          </Card>
        ))}
      </Row>
      <Muted>
        Économie estimée par rapport à un repas acheté à {household?.reference_meal_price.toFixed(2)} €, sur les plats dont le prix des ingrédients est renseigné.
        « Aliments sauvés » = ingrédients utilisés dans les 3 jours avant leur péremption.
      </Muted>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexBasis: 320, flexGrow: 1 }}>
          <H2>Les plus rentables</H2>
          {stats.mostProfitable.length ? stats.mostProfitable.map((x) => (
            <Row key={x.recipe.id} style={{ justifyContent: 'space-between' }}>
              <Body onPress={() => router.push(`/recipe/${x.recipe.id}`)}>{x.recipe.title}</Body>
              <Muted>{x.costPerServing.toFixed(2)} € / portion</Muted>
            </Row>
          )) : <Muted>Renseigne des prix sur tes ingrédients pour voir ce classement.</Muted>}
        </Card>
        <Card style={{ flexBasis: 320, flexGrow: 1 }}>
          <H2>Les plus cuisinés</H2>
          {stats.mostCooked.length ? stats.mostCooked.map((x) => (
            <Row key={x.recipe.id} style={{ justifyContent: 'space-between' }}>
              <Body onPress={() => router.push(`/recipe/${x.recipe.id}`)}>{x.recipe.title}</Body>
              <Muted>{x.count}×</Muted>
            </Row>
          )) : <Muted>Utilise « J’ai cuisiné ça » ou le mode cuisine.</Muted>}
        </Card>
      </View>
    </Screen>
  );
}
