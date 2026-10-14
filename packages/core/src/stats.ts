import type { Ingredient, MealLogEntry, Recipe } from './types';
import { estimateRecipeCost } from './nutrition';

export interface GentleStats {
  mealsCooked: number;
  servingsCooked: number;
  /** Différence avec le prix d'un repas acheté, sur les repas dont le coût est connu */
  moneySaved: number;
  /** Nombre d'ingrédients utilisés juste avant péremption */
  foodSaved: number;
  mostProfitable: { recipe: Recipe; costPerServing: number }[];
  mostCooked: { recipe: Recipe; count: number }[];
}

export function computeStats(
  history: MealLogEntry[],
  recipes: Recipe[],
  catalog: Map<string, Ingredient>,
  referenceMealPrice: number,
  since?: string,
): GentleStats {
  const entries = since ? history.filter((h) => h.eaten_on >= since) : history;
  const byId = new Map(recipes.map((r) => [r.id, r]));

  let servingsCooked = 0;
  let moneySaved = 0;
  let foodSaved = 0;
  const counts = new Map<string, number>();

  for (const h of entries) {
    const r = h.recipe_id ? byId.get(h.recipe_id) : undefined;
    const servings = h.servings ?? r?.servings ?? 1;
    servingsCooked += servings;
    const cost = h.cost ?? (r ? estimateRecipeCost(r, catalog).perServing * servings : null);
    if (cost != null && cost > 0) moneySaved += Math.max(0, referenceMealPrice * servings - cost);
    foodSaved += h.saved_ingredient_ids?.length ?? 0;
    if (h.recipe_id) counts.set(h.recipe_id, (counts.get(h.recipe_id) ?? 0) + 1);
  }

  const mostProfitable = recipes
    .map((recipe) => ({ recipe, ...estimateRecipeCost(recipe, catalog) }))
    .filter((x) => x.coverage >= 0.7 && x.perServing > 0)
    .sort((a, b) => a.perServing - b.perServing)
    .slice(0, 5)
    .map(({ recipe, perServing }) => ({ recipe, costPerServing: perServing }));

  const mostCooked = [...counts.entries()]
    .map(([id, count]) => ({ recipe: byId.get(id)!, count }))
    .filter((x) => x.recipe)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { mealsCooked: entries.length, servingsCooked, moneySaved, foodSaved, mostProfitable, mostCooked };
}
