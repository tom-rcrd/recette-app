import type { Ingredient, MealLogEntry, PantryItem, Recipe } from './types';
import { matchesFilters, type RecipeFilters } from './filters';
import { recipeSeasonality } from './seasons';

export interface SuggestContext {
  catalog: Map<string, Ingredient>;
  pantry: PantryItem[];
  history: MealLogEntry[];
  today: string; // YYYY-MM-DD
}

export interface SuggestWeights {
  /** Pénalité si la recette a été mangée récemment */
  repetition: number;
  /** Demi-vie (jours) de la pénalité de répétition */
  repetitionHalfLifeDays: number;
  /** Pénalité plus légère si l'ingrédient principal a été beaucoup mangé ces derniers jours */
  mainIngredientRepetition: number;
  /** Bonus selon la part des ingrédients déjà disponibles */
  pantryCoverage: number;
  /** Bonus par ingrédient bientôt périmé utilisé (anti-gaspi) */
  expiringSoon: number;
  expiringWithinDays: number;
  seasonality: number;
  rating: number;
  /** Bonus "redécouverte" pour une recette pas cuisinée depuis longtemps */
  rediscover: number;
}

export const DEFAULT_WEIGHTS: SuggestWeights = {
  repetition: 60,
  repetitionHalfLifeDays: 3,
  mainIngredientRepetition: 10,
  pantryCoverage: 40,
  expiringSoon: 12,
  expiringWithinDays: 3,
  seasonality: 15,
  rating: 4,
  rediscover: 6,
};

export interface Suggestion {
  recipe: Recipe;
  score: number;
  reasons: string[];
  missingIngredientIds: string[];
  expiringUsedIds: string[];
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

// Catégories d'ingrédients considérées comme "base du plat" pour la variété
const MAIN_CATEGORIES = new Set(['feculent', 'proteine', 'legumineuse']);

/**
 * Classe les recettes importées selon le contexte : frigo, saison, historique.
 * Rien n'est généré : on ordonne la bibliothèque existante et on explique pourquoi.
 */
export function suggestRecipes(
  recipes: Recipe[],
  ctx: SuggestContext,
  filters: RecipeFilters = {},
  weights: SuggestWeights = DEFAULT_WEIGHTS,
): Suggestion[] {
  const month = new Date(ctx.today).getUTCMonth() + 1;
  const have = new Set(ctx.pantry.map((p) => p.ingredient_id));
  const expiring = new Set(
    ctx.pantry
      .filter((p) => p.expires_on && daysBetween(ctx.today, p.expires_on) <= weights.expiringWithinDays)
      .map((p) => p.ingredient_id),
  );

  // Dernière fois que chaque recette a été mangée
  const lastEaten = new Map<string, number>();
  for (const h of ctx.history) {
    if (!h.recipe_id) continue;
    const d = daysBetween(h.eaten_on, ctx.today);
    if (d < 0) continue;
    const prev = lastEaten.get(h.recipe_id);
    if (prev == null || d < prev) lastEaten.set(h.recipe_id, d);
  }

  // Ingrédients "principaux" mangés ces 3 derniers jours, pondérés par la récence
  const recentMain = new Map<string, number>();
  const byId = new Map(recipes.map((r) => [r.id, r]));
  for (const h of ctx.history) {
    const r = h.recipe_id ? byId.get(h.recipe_id) : undefined;
    const d = daysBetween(h.eaten_on, ctx.today);
    if (!r || d < 0 || d > 3) continue;
    for (const l of r.ingredients) {
      const cat = l.ingredient_id ? ctx.catalog.get(l.ingredient_id)?.category : undefined;
      if (l.ingredient_id && cat && MAIN_CATEGORIES.has(cat)) {
        recentMain.set(l.ingredient_id, (recentMain.get(l.ingredient_id) ?? 0) + 1 / (d + 1));
      }
    }
  }

  const out: Suggestion[] = [];
  for (const recipe of recipes) {
    if (!matchesFilters(recipe, filters, ctx)) continue;
    const reasons: string[] = [];
    let score = 50;

    // 1. Répétition de la même recette
    const last = lastEaten.get(recipe.id);
    if (last != null) {
      const penalty = weights.repetition * Math.pow(0.5, last / weights.repetitionHalfLifeDays);
      score -= penalty;
      if (last === 0) reasons.push("Déjà au menu aujourd'hui");
      else if (last === 1) reasons.push('Mangé hier');
      else if (last <= 7) reasons.push(`Mangé il y a ${last} jours`);
      else if (last >= 30) {
        score += weights.rediscover;
        reasons.push('Pas cuisiné depuis un moment');
      }
    }

    // 2. Ingrédient principal déjà beaucoup mangé (sauf s'il reste au frigo : on finit les restes)
    const required = recipe.ingredients.filter((l) => !l.optional && l.ingredient_id);
    let mainRep = 0;
    for (const l of required) {
      const w = recentMain.get(l.ingredient_id!);
      if (w && !have.has(l.ingredient_id!)) mainRep = Math.max(mainRep, w);
    }
    if (mainRep > 0) score -= Math.min(1, mainRep) * weights.mainIngredientRepetition;

    // 3. Ce qu'on a déjà
    const missing = required.filter((l) => !have.has(l.ingredient_id!)).map((l) => l.ingredient_id!);
    const coverage = required.length ? 1 - missing.length / required.length : 0;
    score += coverage * weights.pantryCoverage;
    if (required.length && missing.length === 0) reasons.push('Tout est dans le frigo');
    else if (missing.length > 0 && missing.length <= 2) reasons.push(`Il manque ${missing.length} ingrédient${missing.length > 1 ? 's' : ''}`);

    // 4. Anti-gaspi : utilise ce qui va périmer
    const expiringUsed = [...new Set(required.filter((l) => expiring.has(l.ingredient_id!)).map((l) => l.ingredient_id!))];
    if (expiringUsed.length) {
      score += expiringUsed.length * weights.expiringSoon;
      const names = expiringUsed.map((id) => ctx.catalog.get(id)?.name).filter(Boolean);
      reasons.push(`Utilise ${names.join(', ')} à finir vite`);
    }

    // 5. Saison
    const season = recipeSeasonality(recipe, ctx.catalog, month);
    if (season != null) {
      score += (season - 0.5) * 2 * weights.seasonality;
      if (season === 1) reasons.push('De saison');
    }

    // 6. Note
    if (recipe.rating) score += (recipe.rating - 3) * weights.rating;

    out.push({ recipe, score, reasons, missingIngredientIds: missing, expiringUsedIds: expiringUsed });
  }

  return out.sort((a, b) => b.score - a.score);
}
