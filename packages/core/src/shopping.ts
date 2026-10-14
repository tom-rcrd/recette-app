import type { Ingredient, PantryItem, Recipe } from './types';
import { toBaseUnit, unitFamily } from './units';

export interface PlannedRecipe {
  recipe: Recipe;
  /** Portions voulues ; défaut = portions de la recette */
  servings?: number;
}

export interface ShoppingItem {
  key: string;
  ingredient_id: string | null;
  label: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  from_recipe_ids: string[];
}

// Ordre des rayons pour une liste lisible en magasin
export const AISLE_ORDER = [
  'fruit', 'legume', 'legumineuse', 'feculent', 'proteine', 'laitier', 'boulangerie',
  'epice', 'huile', 'condiment', 'extra', 'boisson', 'autre',
];

/**
 * Construit la liste de courses pour un ensemble de plats :
 * met les quantités à l'échelle des portions, additionne les mêmes ingrédients
 * (dans des unités compatibles) et retire ce qui est déjà au frigo.
 */
export function buildShoppingList(
  planned: PlannedRecipe[],
  catalog: Map<string, Ingredient>,
  pantry: PantryItem[],
): ShoppingItem[] {
  const items = new Map<string, ShoppingItem>();

  for (const { recipe, servings } of planned) {
    const factor = servings && recipe.servings ? servings / recipe.servings : 1;
    for (const line of recipe.ingredients) {
      if (line.optional) continue;
      const ing = line.ingredient_id ? catalog.get(line.ingredient_id) : undefined;
      const label = ing?.name ?? line.raw_text ?? '?';
      const base = line.quantity != null ? toBaseUnit(line.quantity * factor, line.unit) : null;
      const family = unitFamily(line.unit) ?? 'unknown';
      // Une ligne par (ingrédient, famille d'unité) : 200 g + 0,5 kg s'additionnent, 2 pièces + 300 g non
      const key = `${line.ingredient_id ?? label.toLowerCase()}|${family}|${base?.unit ?? ''}`;
      const existing = items.get(key);
      if (existing) {
        if (existing.quantity != null && base) existing.quantity += base.quantity;
        if (!existing.from_recipe_ids.includes(recipe.id)) existing.from_recipe_ids.push(recipe.id);
      } else {
        items.set(key, {
          key,
          ingredient_id: line.ingredient_id,
          label,
          category: ing?.category ?? 'autre',
          quantity: base?.quantity ?? null,
          unit: base?.unit ?? line.unit,
          from_recipe_ids: [recipe.id],
        });
      }
    }
  }

  // Déduire le frigo (même famille d'unité) ; un produit "toujours là" sort de la liste
  for (const p of pantry) {
    for (const item of items.values()) {
      if (item.ingredient_id !== p.ingredient_id) continue;
      if (p.is_staple || p.quantity == null) { items.delete(item.key); continue; }
      const have = toBaseUnit(p.quantity, p.unit);
      if (item.quantity != null && have && have.unit === item.unit) {
        item.quantity -= have.quantity;
        if (item.quantity <= 0) items.delete(item.key);
      }
    }
  }

  return [...items.values()].sort((a, b) => {
    const ca = AISLE_ORDER.indexOf(a.category);
    const cb = AISLE_ORDER.indexOf(b.category);
    return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb) || a.label.localeCompare(b.label, 'fr');
  });
}
