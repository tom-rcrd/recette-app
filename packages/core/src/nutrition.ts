import type { Ingredient, Nutrition, Recipe } from './types';
import { toGrams } from './units';

const KEYS: (keyof Nutrition)[] = ['kcal', 'protein_g', 'carbs_g', 'sugars_g', 'fat_g', 'sat_fat_g', 'fiber_g', 'salt_g'];

export const emptyNutrition = (): Nutrition =>
  ({ kcal: 0, protein_g: 0, carbs_g: 0, sugars_g: 0, fat_g: 0, sat_fat_g: 0, fiber_g: 0, salt_g: 0 });

export interface RecipeNutrition {
  total: Nutrition;
  perServing: Nutrition;
  /** Part des ingrédients (en lignes) dont la nutrition a pu être calculée, 0..1 */
  coverage: number;
  /** Lignes non prises en compte (ingrédient inconnu, unité non convertible…) */
  missing: string[];
}

export function computeRecipeNutrition(recipe: Recipe, catalog: Map<string, Ingredient>): RecipeNutrition {
  const total = emptyNutrition();
  const missing: string[] = [];
  let counted = 0;
  const lines = recipe.ingredients.filter((l) => !l.optional);

  for (const line of lines) {
    const ing = line.ingredient_id ? catalog.get(line.ingredient_id) : undefined;
    const grams = ing ? toGrams(line.quantity, line.unit, ing) : null;
    if (!ing || grams == null || ing.kcal == null) {
      missing.push(line.raw_text ?? ing?.name ?? '?');
      continue;
    }
    counted++;
    for (const k of KEYS) total[k] += ((ing[k] ?? 0) * grams) / 100;
  }

  const servings = recipe.servings > 0 ? recipe.servings : 1;
  const perServing = emptyNutrition();
  for (const k of KEYS) perServing[k] = total[k] / servings;

  return { total, perServing, coverage: lines.length ? counted / lines.length : 0, missing };
}

/**
 * Score de complétude nutritionnelle d'une portion (0..100).
 * Ce n'est pas un jugement : il indique si l'assiette "tient au corps" et
 * couvre les grands groupes (protéines, fibres, légumes, énergie raisonnable).
 * Repères : ~1/3 des besoins journaliers d'un adulte pour un repas principal.
 */
export function completenessScore(perServing: Nutrition, recipe: Recipe, catalog: Map<string, Ingredient>): number {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const protein = clamp01(perServing.protein_g / 25);            // ~25 g / repas
  const fiber = clamp01(perServing.fiber_g / 8);                 // ~8 g / repas
  const energy = perServing.kcal <= 0 ? 0 : 1 - clamp01(Math.abs(perServing.kcal - 650) / 650);
  const hasVeg = recipe.ingredients.some((l) => {
    const c = l.ingredient_id ? catalog.get(l.ingredient_id)?.category : undefined;
    return c === 'legume' || c === 'fruit' || c === 'legumineuse';
  }) ? 1 : 0;
  return Math.round((protein * 0.3 + fiber * 0.25 + energy * 0.2 + hasVeg * 0.25) * 100);
}

/** Coût estimé de la recette (total), à partir des prix renseignés sur les ingrédients. */
export function estimateRecipeCost(recipe: Recipe, catalog: Map<string, Ingredient>): { total: number; perServing: number; coverage: number } {
  let total = 0;
  let priced = 0;
  const lines = recipe.ingredients.filter((l) => !l.optional);
  for (const line of lines) {
    const ing = line.ingredient_id ? catalog.get(line.ingredient_id) : undefined;
    if (!ing?.price || !ing.price_quantity) continue;
    const need = toGrams(line.quantity, line.unit, ing);
    const ref = toGrams(ing.price_quantity, ing.price_unit ?? 'g', ing);
    if (need == null || !ref) continue;
    total += (ing.price * need) / ref;
    priced++;
  }
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  return { total, perServing: total / servings, coverage: lines.length ? priced / lines.length : 0 };
}
