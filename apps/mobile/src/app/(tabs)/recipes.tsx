import { matchesFilters, type Diet, type DurationClass, type MealType, type RecipeFilters } from '@recette/core';
import { useMemo, useState } from 'react';
import { RecipeCard } from '@/components/RecipeCard';
import { Chip, Empty, Field, H1, Loading, Muted, Row, Screen } from '@/components/ui';
import { useData } from '@/lib/data';
import { DURATION_LABELS, EQUIPMENT_LABELS, MEAL_TYPE_LABELS } from '@/lib/theme';

const DIETS: { key: Diet; label: string }[] = [
  { key: 'vegetarien', label: 'Végétarien' }, { key: 'vegan', label: 'Vegan' },
  { key: 'sans_gluten', label: 'Sans gluten' },
];
const DISH_TYPES = ['entree', 'plat', 'accompagnement', 'dessert', 'sauce', 'boisson', 'pain'];

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function Recipes() {
  const { loading, recipes, catalog, pantry } = useData();
  const [query, setQuery] = useState('');
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [durations, setDurations] = useState<DurationClass[]>([]);
  const [dishTypes, setDishTypes] = useState<string[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  // Matériel absent : exclut les recettes qui en ont besoin
  const [missingEquipment, setMissingEquipment] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const f: RecipeFilters = { query, mealTypes, durationClasses: durations, dishTypes, diets };
    return recipes.filter((r) =>
      matchesFilters(r, f, { catalog, pantry }) && !r.equipment.some((e) => missingEquipment.includes(e)));
  }, [recipes, catalog, pantry, query, mealTypes, durations, dishTypes, diets, missingEquipment]);

  if (loading) return <Loading />;

  return (
    <Screen>
      <H1>Recettes</H1>
      <Field placeholder="Rechercher un plat, un ingrédient…" value={query} onChangeText={setQuery} />
      <Row wrap>
        {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((m) => (
          <Chip key={m} label={MEAL_TYPE_LABELS[m]!} active={mealTypes.includes(m)} onPress={() => setMealTypes(toggle(mealTypes, m))} />
        ))}
      </Row>
      <Row wrap>
        {(['rapide', 'moyen', 'long'] as DurationClass[]).map((d) => (
          <Chip key={d} tone="green" label={DURATION_LABELS[d]!} active={durations.includes(d)} onPress={() => setDurations(toggle(durations, d))} />
        ))}
        {DISH_TYPES.map((d) => (
          <Chip key={d} tone="amber" label={d} active={dishTypes.includes(d)} onPress={() => setDishTypes(toggle(dishTypes, d))} />
        ))}
      </Row>
      <Row wrap>
        {DIETS.map((d) => (
          <Chip key={d.key} tone="green" label={d.label} active={diets.includes(d.key)} onPress={() => setDiets(toggle(diets, d.key))} />
        ))}
      </Row>
      <Row wrap>
        <Muted>Je n’ai pas :</Muted>
        {Object.entries(EQUIPMENT_LABELS).map(([k, label]) => (
          <Chip key={k} tone="neutral" label={label} active={missingEquipment.includes(k)} onPress={() => setMissingEquipment(toggle(missingEquipment, k))} />
        ))}
      </Row>

      <Muted>{filtered.length} recette{filtered.length > 1 ? 's' : ''}</Muted>
      {filtered.length === 0 ? (
        <Empty title="Rien ici" hint="Essaie d’enlever un filtre." />
      ) : (
        <Row wrap gap={14} style={{ alignItems: 'stretch' }}>
          {filtered.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </Row>
      )}
    </Screen>
  );
}
