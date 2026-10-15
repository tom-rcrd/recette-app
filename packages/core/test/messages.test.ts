import { describe, expect, it } from 'vitest';
import { computeRecipeNutrition, nutritionMessages, type Ingredient, type Recipe } from '../src';

// Valeurs du catalogue de départ (supabase/migrations/0002_seed_basics.sql)
const ing = (id: string, name: string, category: string, n: Partial<Ingredient>): Ingredient => ({
  id, name, aliases: [], kind: 'base', category, season_months: [], allergens: [],
  is_vegan: true, is_vegetarian: true, contains_lactose: false, contains_gluten: false,
  kcal: 0, protein_g: 0, carbs_g: 0, sugars_g: 0, fat_g: 0, sat_fat_g: 0, fiber_g: 0, salt_g: 0, ...n,
});
const list = [
  ing('lentilles', 'Lentilles corail', 'legumineuse', { kcal: 340, protein_g: 24, carbs_g: 50, sugars_g: 2, fat_g: 1.5, sat_fat_g: 0.2, fiber_g: 11, salt_g: 0.02, density: 0.85 }),
  ing('coco', 'Lait de coco', 'extra', { kcal: 190, protein_g: 2, carbs_g: 3, sugars_g: 2, fat_g: 19, sat_fat_g: 17, salt_g: 0.03, density: 1 }),
  ing('tomates', 'Tomates concassées', 'extra', { kcal: 22, protein_g: 1.2, carbs_g: 3.5, sugars_g: 3, fat_g: 0.2, fiber_g: 1.2, salt_g: 0.3, density: 1.05 }),
  ing('oignon', 'Oignon', 'legume', { kcal: 40, protein_g: 1.2, carbs_g: 7.6, sugars_g: 5, fat_g: 0.2, fiber_g: 1.7, salt_g: 0.01, grams_per_piece: 150 }),
  ing('riz', 'Riz', 'feculent', { kcal: 350, protein_g: 7.5, carbs_g: 77, sugars_g: 0.3, fat_g: 0.6, sat_fat_g: 0.2, fiber_g: 1.3 }),
  ing('farine', 'Farine de blé', 'feculent', { kcal: 345, protein_g: 10, carbs_g: 72, sugars_g: 1, fat_g: 1.2, sat_fat_g: 0.2, fiber_g: 3 }),
  ing('emmental', 'Emmental râpé', 'laitier', { kcal: 375, protein_g: 28, fat_g: 29, sat_fat_g: 19, salt_g: 0.7, is_vegan: false }),
  ing('oeuf', 'Œuf', 'proteine', { kcal: 140, protein_g: 12.7, carbs_g: 0.5, sugars_g: 0.3, fat_g: 9.8, sat_fat_g: 2.6, salt_g: 0.35, grams_per_piece: 55, is_vegan: false }),
  ing('beurre', 'Beurre', 'laitier', { kcal: 745, protein_g: 0.7, carbs_g: 0.6, sugars_g: 0.6, fat_g: 82, sat_fat_g: 54, salt_g: 0.02, density: 0.91, is_vegan: false }),
  ing('champignon', 'Champignon de Paris', 'legume', { kcal: 22, protein_g: 3.1, carbs_g: 0.3, fat_g: 0.3, fiber_g: 1.5, salt_g: 0.02 }),
  ing('sel', 'Sel', 'epice', { salt_g: 100, density: 1.2 }),
  ing('soja', 'Sauce soja', 'condiment', { kcal: 60, protein_g: 8, carbs_g: 5, salt_g: 14, density: 1.15 }),
];
const catalog = new Map(list.map((i) => [i.id, i]));

const recipe = (title: string, servings: number, lines: [string, number, string | null][]): Recipe => ({
  id: title, title, servings, meal_types: ['dejeuner', 'diner'], dish_type: 'plat',
  prep_min: 10, cook_min: 20, rest_min: 0, equipment: [], tags: [], steps: [],
  ingredients: lines.map(([id, quantity, unit], position) => ({ ingredient_id: id, quantity, unit, optional: false, position })),
});
const messages = (r: Recipe) => nutritionMessages(computeRecipeNutrition(r, catalog).perServing, r, catalog);
const byKey = (r: Recipe, key: string) => messages(r).find((m) => m.key === key);

const dal = recipe('Dal', 4, [['lentilles', 250, 'g'], ['coco', 400, 'ml'], ['tomates', 400, 'g'], ['oignon', 1, null], ['riz', 300, 'g']]);
const pizza = recipe('Pizza', 2, [['farine', 300, 'g'], ['tomates', 200, 'g'], ['emmental', 150, 'g'], ['champignon', 100, 'g']]);
const omelette = recipe('Omelette', 1, [['oeuf', 3, null], ['beurre', 10, 'g'], ['champignon', 60, 'g'], ['sel', 1, 'pincee']]);

describe('repères nutritionnels', () => {
  it('nomme l’ingrédient responsable et propose une alternative (lait de coco)', () => {
    const m = byKey(dal, 'satfat')!;
    expect(m.title).toBe('Très riche en graisses saturées');
    expect(m.detail).toBe('17,3 g par portion, soit 86 % du repère de 20 g/jour, dont 17 g apportés par « Lait de coco ».');
    expect(m.tip).toMatch(/lait de coco allégé/);
  });

  it('fromage : alternative adaptée', () => {
    const m = byKey(pizza, 'satfat')!;
    expect(m.detail).toMatch(/« Emmental râpé »/);
    expect(m.tip).toMatch(/mozzarella/);
  });

  it('messages positifs : légumineuses, fibres, peu salé', () => {
    expect(byKey(dal, 'legumes')!.detail).toMatch(/lentilles corail/);
    expect(byKey(dal, 'fiber')!.title).toBe('Excellente source de fibres');
    expect(byKey(dal, 'salt-low')).toBeDefined();
  });

  it('plat principal pauvre en fibres et en légumes', () => {
    expect(byKey(omelette, 'fiber-low')!.tip).toMatch(/légumes/);
    expect(byKey(omelette, 'veg-low')!.detail).toMatch(/60 g par portion/);
    expect(byKey(omelette, 'protein')!.title).toBe('Bonne source de protéines');
  });

  it('niveaux gradués pour le sel, avec le condiment responsable', () => {
    const lightSoy = recipe('Sauté', 1, [['champignon', 200, 'g'], ['soja', 1, 'cas']]);
    const heavySoy = recipe('Sauté salé', 1, [['champignon', 200, 'g'], ['soja', 2, 'cas']]);
    expect(byKey(lightSoy, 'salt')!.title).toBe('Plutôt salé');
    const high = byKey(heavySoy, 'salt')!;
    expect(high.title).toBe('Très salé');
    expect(high.tip).toMatch(/« Sauce soja » de 25 %/);
  });

  it('les points d’attention passent avant les points forts, du plus marqué au moins marqué', () => {
    const tones = messages(pizza).map((m) => m.tone);
    expect(tones.indexOf('positive')).toBeGreaterThan(tones.lastIndexOf('attention'));
    expect(messages(dal)[0]!.key).toBe('satfat');
  });
});
