import { describe, expect, it } from 'vitest';
import {
  applySubstitutions, buildShoppingList, computeRecipeNutrition, isAnimalMilk, missingIngredients,
  substitutionSuggestions, type Ingredient, type Recipe, type Substitution,
} from '../src';

const ing = (id: string, name: string, extra: Partial<Ingredient> = {}): Ingredient => ({
  id, name, aliases: [], kind: 'base', category: 'laitier', season_months: [], allergens: [],
  is_vegan: false, is_vegetarian: true, contains_lactose: false, contains_gluten: false, ...extra,
});
const lait = ing('lait', 'Lait', { allergens: ['lait'], contains_lactose: true, kcal: 46, protein_g: 3.3, density: 1.03 });
const soja = ing('soja', 'Boisson soja', { is_vegan: true, allergens: ['soja'], kcal: 35, protein_g: 3.3, density: 1.03 });
const avoine = ing('avoine', 'Boisson avoine', { is_vegan: true, kcal: 45, protein_g: 1, density: 1.03 });
const coco = ing('coco', 'Lait de coco', { category: 'extra', is_vegan: true, kcal: 190 });
const flocons = ing('flocons', 'Flocons d’avoine', { category: 'feculent', is_vegan: true, kcal: 370, protein_g: 13 });
const catalog = new Map([lait, soja, avoine, coco, flocons].map((i) => [i.id, i]));

const porridge: Recipe = {
  id: 'p', title: 'Porridge', servings: 1, meal_types: ['petit_dejeuner'], prep_min: 2, cook_min: 5, rest_min: 0,
  equipment: [], tags: [], steps: [],
  ingredients: [
    { ingredient_id: 'flocons', quantity: 50, unit: 'g', optional: false, position: 0 },
    { ingredient_id: 'lait', quantity: 200, unit: 'ml', optional: false, position: 1 },
  ],
};
const toSoja: Substitution = { id: 's', from_ingredient_id: 'lait', to_ingredient_id: 'soja', ratio: 1, active: true };

describe('remplacements', () => {
  it('reconnaît le lait animal, pas les boissons végétales ni le lait de coco', () => {
    expect(isAnimalMilk(lait)).toBe(true);
    expect(isAnimalMilk(soja)).toBe(false);
    expect(isAnimalMilk(coco)).toBe(false);
  });

  it('propose les boissons végétales du catalogue quand la recette contient du lait', () => {
    const [s] = substitutionSuggestions(porridge, catalog);
    expect(s!.from.id).toBe('lait');
    expect(s!.candidates.map((c) => c.name)).toEqual(['Boisson avoine', 'Boisson soja']);
  });

  it('remplace la ligne en gardant l’origine, et plus de suggestion ensuite', () => {
    const r = applySubstitutions(porridge, [toSoja]);
    expect(r.ingredients[1]).toMatchObject({ ingredient_id: 'soja', quantity: 200, substituted_from: { ingredient_id: 'lait', quantity: 200 } });
    expect(porridge.ingredients[1]!.ingredient_id).toBe('lait'); // l'original n'est pas modifié
    expect(substitutionSuggestions(r, catalog)).toEqual([]);
  });

  it('nutrition, frigo et courses utilisent le remplaçant', () => {
    const r = applySubstitutions(porridge, [toSoja]);
    expect(computeRecipeNutrition(r, catalog).total.kcal).toBeCloseTo(370 * 0.5 + 35 * 2.06, 0);
    const pantry = [{ id: 'x', ingredient_id: 'soja', location: 'frigo', quantity: null, unit: null, expires_on: null, is_staple: false }];
    expect(missingIngredients(r, pantry)).toEqual(['flocons']);
    expect(buildShoppingList([{ recipe: r }], catalog, []).map((i) => i.label)).toContain('Boisson soja');
  });

  it('applique le ratio et ignore les remplacements désactivés', () => {
    expect(applySubstitutions(porridge, [{ ...toSoja, ratio: 0.5 }]).ingredients[1]!.quantity).toBe(100);
    expect(applySubstitutions(porridge, [{ ...toSoja, active: false }])).toBe(porridge);
  });
});
