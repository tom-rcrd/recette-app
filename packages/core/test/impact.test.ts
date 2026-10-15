import { describe, expect, it } from 'vitest';
import {
  applySubstitutions, containsMeat, impactKeyOf, impactSummary, recipeImpact,
  type Ingredient, type Recipe,
} from '../src';

const ing = (id: string, name: string, category: string, extra: Partial<Ingredient> = {}): Ingredient => ({
  id, name, aliases: [], kind: 'base', category, season_months: [], allergens: [],
  is_vegan: true, is_vegetarian: true, contains_lactose: false, contains_gluten: false, ...extra,
});
const list = [
  ing('lentilles', 'Lentilles corail', 'legumineuse', { protein_g: 24 }),
  ing('riz', 'Riz', 'feculent'),
  ing('lait', 'Lait', 'laitier', { allergens: ['lait'], is_vegan: false, density: 1.03 }),
  ing('soja', 'Boisson soja', 'laitier', { density: 1.03 }),
  ing('flocons', 'Flocons d’avoine', 'feculent'),
  ing('oeuf', 'Œuf', 'proteine', { is_vegan: false, grams_per_piece: 55 }),
  ing('poulet', 'Blanc de poulet', 'proteine', { is_vegan: false, is_vegetarian: false }),
  ing('huile', 'Huile d’olive', 'huile', { density: 0.92 }),
  ing('champignon', 'Champignon de Paris', 'legume'),
];
const catalog = new Map(list.map((i) => [i.id, i]));
const recipe = (id: string, servings: number, lines: [string, number, string | null][]): Recipe => ({
  id, title: id, servings, meal_types: ['diner'], prep_min: 10, cook_min: 10, rest_min: 0, equipment: [], tags: [], steps: [],
  ingredients: lines.map(([i, quantity, unit], position) => ({ ingredient_id: i, quantity, unit, optional: false, position })),
});

describe('impact environnemental', () => {
  it('relie les ingrédients du catalogue aux catégories de l’étude', () => {
    expect(impactKeyOf(catalog.get('oeuf')!)).toBe('eggs');
    expect(impactKeyOf(catalog.get('soja')!)).toBe('soyMilk');
    expect(impactKeyOf(catalog.get('lait')!)).toBe('milk');
    expect(impactKeyOf(catalog.get('flocons')!)).toBe('oatmeal');
    expect(impactKeyOf(catalog.get('champignon')!)).toBe('otherVegetables');
    expect(impactKeyOf(catalog.get('huile')!)).toBeNull();
    expect(impactKeyOf(ing('x', 'Lait de coco', 'extra'))).toBeNull();
    expect(impactKeyOf(ing('y', 'Bœuf haché', 'proteine'))).toBe('beef');
  });

  it('lentilles : comparées à la même quantité de protéines en viande', () => {
    const dal = recipe('dal', 1, [['lentilles', 100, 'g'], ['riz', 75, 'g']]);
    const poultry = recipeImpact(dal, catalog, 'poultry');
    // réel : 0,1 kg × 1,79 + 0,075 × 4,45 ; classique : 24 g de protéines → 104 g de poulet × 9,87 + riz
    expect(poultry.actual.co2).toBeCloseTo(0.179 + 0.334, 2);
    expect(poultry.conventional.co2).toBeCloseTo((24 / 23) * 0.1 * 9.87 + 0.334, 2);
    expect(poultry.swaps).toEqual([{ from: 'poulet', to: 'Lentilles corail' }]);
    const beef = recipeImpact(dal, catalog, 'beef');
    expect(beef.conventional.co2).toBeGreaterThan(poultry.conventional.co2 * 5);
  });

  it('lait remplacé par une boisson soja : la version classique garde le lait', () => {
    const porridge = recipe('porridge', 1, [['flocons', 50, 'g'], ['lait', 200, 'ml']]);
    const swapped = applySubstitutions(porridge, [{ id: 's', from_ingredient_id: 'lait', to_ingredient_id: 'soja', ratio: 1, active: true }]);
    const imp = recipeImpact(swapped, catalog);
    expect(imp.conventional.co2 - imp.actual.co2).toBeCloseTo(0.206 * (3.15 - 0.98), 3);
    expect(imp.swaps).toEqual([{ from: 'Lait', to: 'Boisson soja' }]);
  });

  it('rien d’évité quand il n’y a rien à remplacer', () => {
    const omelette = recipe('omelette', 1, [['oeuf', 3, null], ['champignon', 100, 'g']]);
    const imp = recipeImpact(omelette, catalog);
    expect(imp.conventional).toEqual(imp.actual);
  });

  it('bilan des repas cuisinés, par portions, filtré par date', () => {
    const dal = recipe('dal', 4, [['lentilles', 250, 'g'], ['riz', 300, 'g']]);
    const poulet = recipe('poulet-riz', 2, [['poulet', 300, 'g'], ['riz', 150, 'g']]);
    expect(containsMeat(poulet, catalog)).toBe(true);
    const sum = impactSummary(
      [
        { recipe_id: 'dal', eaten_on: '2026-10-14', servings: 2 },
        { recipe_id: 'poulet-riz', eaten_on: '2026-10-15', servings: 2 },
        { recipe_id: 'dal', eaten_on: '2026-09-01', servings: 4 },
      ],
      [dal, poulet], catalog, { since: '2026-10-01' },
    );
    expect(sum.meals).toBe(2);
    expect(sum.plantMeals).toBe(1);
    const perServing = recipeImpact(dal, catalog);
    expect(sum.saved.co2).toBeCloseTo((perServing.conventional.co2 - perServing.actual.co2) * 2, 5);
    expect(sum.perMeal[0]!.recipe.id).toBe('poulet-riz');
  });
});
