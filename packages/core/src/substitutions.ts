import type { Ingredient, Recipe, Substitution } from './types';
import { normalizeText } from './units';

/**
 * Applique les remplacements actifs du foyer à une recette, sans toucher à l'original :
 * chaque ligne remplacée garde l'ingrédient d'origine dans `substituted_from`.
 * Tout ce qui lit la recette ensuite (nutrition, frigo, courses, mode cuisine) voit le remplaçant.
 */
export function applySubstitutions(recipe: Recipe, substitutions: Substitution[]): Recipe {
  const active = new Map(substitutions.filter((s) => s.active).map((s) => [s.from_ingredient_id, s]));
  if (!active.size) return recipe;
  let changed = false;
  const ingredients = recipe.ingredients.map((line) => {
    const sub = line.ingredient_id ? active.get(line.ingredient_id) : undefined;
    if (!sub) return line;
    changed = true;
    return {
      ...line,
      ingredient_id: sub.to_ingredient_id,
      quantity: line.quantity == null ? null : Math.round(line.quantity * sub.ratio * 100) / 100,
      substituted_from: { ingredient_id: line.ingredient_id!, quantity: line.quantity, unit: line.unit, note: sub.note ?? null },
    };
  });
  return changed ? { ...recipe, ingredients } : recipe;
}

// -----------------------------------------------------------------------------
// Détection : ingrédients d'origine animale qu'on souhaite remplacer
// -----------------------------------------------------------------------------

const PLANT_WORDS = /soja|avoine|amande|riz|coco|noisette|cajou|epeautre|vegetal/;

/** Lait d'origine animale (lait, lait demi-écrémé, lait entier…), pas les boissons végétales. */
export function isAnimalMilk(ing: Ingredient): boolean {
  const n = normalizeText(ing.name);
  if (PLANT_WORDS.test(n) || ing.is_vegan) return false;
  return /^lait\b/.test(n) && (ing.allergens ?? []).includes('lait');
}

/** Boissons végétales du catalogue, proposées comme remplaçants du lait (le lait de coco, ingrédient de cuisine, est exclu). */
export function plantMilks(catalog: Ingredient[]): Ingredient[] {
  return catalog
    .filter((i) => {
      const n = normalizeText(i.name);
      return i.is_vegan && /^(boisson|lait)\b/.test(n) && PLANT_WORDS.test(n) && !n.includes('coco');
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export interface SubstitutionSuggestion {
  from: Ingredient;
  /** Remplaçants possibles trouvés dans le catalogue */
  candidates: Ingredient[];
}

/** Ingrédients de la recette (déjà remplacée) pour lesquels un remplacement serait souhaitable. */
export function substitutionSuggestions(recipe: Recipe, catalog: Map<string, Ingredient>): SubstitutionSuggestion[] {
  const all = [...catalog.values()];
  const seen = new Set<string>();
  const out: SubstitutionSuggestion[] = [];
  for (const line of recipe.ingredients) {
    const ing = line.ingredient_id ? catalog.get(line.ingredient_id) : undefined;
    if (!ing || seen.has(ing.id) || !isAnimalMilk(ing)) continue;
    seen.add(ing.id);
    out.push({ from: ing, candidates: plantMilks(all) });
  }
  return out;
}
