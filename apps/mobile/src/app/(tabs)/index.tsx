import { mergeFilters, QUICK_FILTERS, suggestRecipes, type MealType } from '@recette/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RecipeCard } from '@/components/RecipeCard';
import { Button, Chip, Empty, H1, H2, Loading, Muted, Row, Screen } from '@/components/ui';
import { today, useData } from '@/lib/data';
import { MEAL_TYPE_LABELS } from '@/lib/theme';

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'petit_dejeuner';
  if (h < 14) return 'dejeuner';
  if (h < 18) return 'gouter';
  return 'diner';
}

export default function Today() {
  const { loading, error, recipes, catalog, pantry, history } = useData();
  const [mealType, setMealType] = useState<MealType | null>(defaultMealType());
  const [quick, setQuick] = useState<string[]>([]);

  const suggestions = useMemo(() => {
    const filters = mergeFilters(
      mealType ? { mealTypes: [mealType] } : {},
      ...QUICK_FILTERS.filter((q) => quick.includes(q.key)).map((q) => q.filters),
    );
    return suggestRecipes(recipes, { catalog, pantry, history, today: today() }, filters);
  }, [recipes, catalog, pantry, history, mealType, quick]);

  const expiring = pantry
    .filter((p) => p.expires_on && p.expires_on <= new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10))
    .map((p) => catalog.get(p.ingredient_id)?.name)
    .filter(Boolean);

  if (loading) return <Loading />;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>Qu’est-ce qu’on mange ?</H1>
        <Button label="+ Importer" onPress={() => router.push('/import')} />
      </Row>
      {error ? <Muted style={{ color: '#B3261E' }}>{error}</Muted> : null}

      <Row wrap>
        {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((m) => (
          <Chip key={m} label={MEAL_TYPE_LABELS[m]!} active={mealType === m} onPress={() => setMealType(mealType === m ? null : m)} />
        ))}
      </Row>
      <Row wrap>
        {QUICK_FILTERS.map((q) => (
          <Chip
            key={q.key}
            label={q.label}
            tone="green"
            active={quick.includes(q.key)}
            onPress={() => setQuick((cur) => (cur.includes(q.key) ? cur.filter((k) => k !== q.key) : [...cur, q.key]))}
          />
        ))}
      </Row>

      {expiring.length ? <Muted>À finir bientôt : {expiring.join(', ')}</Muted> : null}

      <H2>Suggestions</H2>
      {suggestions.length === 0 ? (
        <Empty
          title={recipes.length ? 'Aucune recette ne correspond' : 'Ta bibliothèque est vide'}
          hint={recipes.length ? 'Retire un filtre ou ajoute des produits au frigo.' : 'Importe une recette depuis un site, une vidéo ou une photo.'}
        />
      ) : (
        <Row wrap gap={14} style={{ alignItems: 'stretch' }}>
          {suggestions.slice(0, 12).map((s) => (
            <RecipeCard key={s.recipe.id} recipe={s.recipe} reasons={s.reasons} missing={s.missingIngredientIds.length} />
          ))}
        </Row>
      )}
    </Screen>
  );
}
