import type { DurationClass, Ingredient, MealType, PantryItem, Recipe } from './types';
import { normalizeText } from './units';

export type Diet = 'vegan' | 'vegetarien' | 'sans_lactose' | 'sans_gluten';

// Ustensiles de cuisson : une recette "une seule poêle" n'en utilise qu'un
const COOKWARE = new Set(['four', 'poele', 'casserole', 'cocotte', 'wok', 'sauteuse', 'airfryer', 'micro_ondes']);

export interface RecipeFilters {
  query?: string;
  mealTypes?: MealType[];
  dishTypes?: string[];
  durationClasses?: DurationClass[];
  maxMinutes?: number;
  diets?: Diet[];
  excludeAllergens?: string[];
  /** Matériel disponible : la recette ne doit rien demander d'autre */
  availableEquipment?: string[];
  /** Doit contenir tous ces ingrédients */
  withIngredientIds?: string[];
  /** Doit avoir tous ces tags (batch_cooking, enfant_friendly…) */
  tags?: string[];

  // Filtres anti-frustration
  noOven?: boolean;
  onePan?: boolean;
  /** "Avec ce que j'ai" : nombre max d'ingrédients manquants (0 = tout dans le frigo) */
  maxMissingIngredients?: number;
}

export interface FilterContext {
  catalog: Map<string, Ingredient>;
  pantry: PantryItem[];
}

export function totalMinutes(r: Recipe): number {
  return r.total_min ?? r.prep_min + r.cook_min + r.rest_min;
}

export function durationClass(r: Recipe): DurationClass {
  const t = totalMinutes(r);
  return r.duration_class ?? (t <= 30 ? 'rapide' : t <= 60 ? 'moyen' : 'long');
}

/** Ingrédients obligatoires absents du frigo/placards (ids). Les lignes non reliées au catalogue sont ignorées. */
export function missingIngredients(recipe: Recipe, pantry: PantryItem[]): string[] {
  const have = new Set(pantry.map((p) => p.ingredient_id));
  return recipe.ingredients
    .filter((l) => !l.optional && l.ingredient_id && !have.has(l.ingredient_id))
    .map((l) => l.ingredient_id!);
}

/** Vérifie un régime. Seuls les conflits connus excluent (une ligne non reliée au catalogue ne bloque pas). */
export function matchesDiet(recipe: Recipe, diet: Diet, catalog: Map<string, Ingredient>): boolean {
  return recipe.ingredients.every((l) => {
    const ing = l.ingredient_id ? catalog.get(l.ingredient_id) : undefined;
    if (!ing || l.optional) return true;
    switch (diet) {
      case 'vegan': return ing.is_vegan;
      case 'vegetarien': return ing.is_vegetarian || ing.is_vegan;
      case 'sans_lactose': return !ing.contains_lactose;
      case 'sans_gluten': return !ing.contains_gluten;
    }
  });
}

export function matchesFilters(recipe: Recipe, f: RecipeFilters, ctx: FilterContext): boolean {
  if (f.query) {
    const q = normalizeText(f.query);
    const hay = normalizeText(
      [recipe.title, recipe.description ?? '', ...recipe.ingredients.map((l) =>
        (l.ingredient_id && ctx.catalog.get(l.ingredient_id)?.name) || l.raw_text || '')].join(' '),
    );
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  if (f.mealTypes?.length && !f.mealTypes.some((m) => recipe.meal_types.includes(m))) return false;
  if (f.dishTypes?.length && !f.dishTypes.includes(recipe.dish_type ?? '')) return false;
  if (f.durationClasses?.length && !f.durationClasses.includes(durationClass(recipe))) return false;
  if (f.maxMinutes != null && totalMinutes(recipe) > f.maxMinutes) return false;
  if (f.diets?.some((d) => !matchesDiet(recipe, d, ctx.catalog))) return false;
  if (f.excludeAllergens?.length) {
    const hit = recipe.ingredients.some((l) => {
      const ing = l.ingredient_id ? ctx.catalog.get(l.ingredient_id) : undefined;
      return !l.optional && ing?.allergens.some((a) => f.excludeAllergens!.includes(a));
    });
    if (hit) return false;
  }
  if (f.availableEquipment && !recipe.equipment.every((e) => f.availableEquipment!.includes(e))) return false;
  if (f.withIngredientIds?.length) {
    const ids = new Set(recipe.ingredients.map((l) => l.ingredient_id));
    if (!f.withIngredientIds.every((id) => ids.has(id))) return false;
  }
  if (f.tags?.length && !f.tags.every((t) => recipe.tags.includes(t))) return false;
  if (f.noOven && recipe.equipment.includes('four')) return false;
  if (f.onePan && !recipe.tags.includes('une_seule_poele')
      && recipe.equipment.filter((e) => COOKWARE.has(e)).length > 1) return false;
  if (f.maxMissingIngredients != null && missingIngredients(recipe, ctx.pantry).length > f.maxMissingIngredients) return false;
  return true;
}

/** Raccourcis prêts à l'emploi pour les puces de l'écran d'accueil. */
export const QUICK_FILTERS: { key: string; label: string; filters: RecipeFilters }[] = [
  { key: 'frigo', label: 'Avec ce que j’ai', filters: { maxMissingIngredients: 0 } },
  { key: 'presque', label: 'Il manque 1–2 trucs', filters: { maxMissingIngredients: 2 } },
  { key: 'moins30', label: 'Moins de 30 min', filters: { maxMinutes: 30 } },
  { key: 'sans_four', label: 'Sans four', filters: { noOven: true } },
  { key: 'une_poele', label: 'Une seule poêle', filters: { onePan: true } },
  { key: 'sans_lactose', label: 'Sans lactose', filters: { diets: ['sans_lactose'] } },
  { key: 'vegetarien', label: 'Végétarien', filters: { diets: ['vegetarien'] } },
  { key: 'batch', label: 'Batch cooking', filters: { tags: ['batch_cooking'] } },
  { key: 'enfants', label: 'Enfant-friendly', filters: { tags: ['enfant_friendly'] } },
];

/** Fusionne plusieurs jeux de filtres (puces cumulées). */
export function mergeFilters(...list: RecipeFilters[]): RecipeFilters {
  const out: RecipeFilters = {};
  for (const f of list) {
    for (const [k, v] of Object.entries(f) as [keyof RecipeFilters, never][]) {
      const prev = out[k] as unknown;
      if (Array.isArray(v)) (out as Record<string, unknown>)[k] = [...new Set([...((prev as unknown[]) ?? []), ...(v as unknown[])])];
      else if (typeof v === 'number') (out as Record<string, unknown>)[k] = prev == null ? v : Math.min(prev as number, v);
      else (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
