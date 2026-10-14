import { describe, expect, it } from 'vitest';
import {
  buildShoppingList, computeRecipeNutrition, detectStepTimer, formatQuantity, formatSeason,
  isoDurationToMinutes, matchesFilters, matchIngredient, parseIngredientLine, resolveDraftIngredients,
  suggestRecipes, toGrams, type Ingredient, type PantryItem, type Recipe,
} from '../src';

const ing = (id: string, name: string, extra: Partial<Ingredient> = {}): Ingredient => ({
  id, name, aliases: [], kind: 'base', category: 'autre', season_months: [], allergens: [],
  is_vegan: true, is_vegetarian: true, contains_lactose: false, contains_gluten: false, ...extra,
});

const catalogList: Ingredient[] = [
  ing('riz', 'Riz basmati', { aliases: ['riz'], category: 'feculent', kcal: 350, protein_g: 7, carbs_g: 78, fat_g: 0.6, fiber_g: 1.3, salt_g: 0 }),
  ing('poulet', 'Blanc de poulet', { aliases: ['poulet'], category: 'proteine', is_vegan: false, is_vegetarian: false, kcal: 110, protein_g: 23, fat_g: 1.5 }),
  ing('curry', 'Curry en poudre', { category: 'epice' }),
  ing('oignon', 'Oignon', { category: 'legume', grams_per_piece: 150, kcal: 40, protein_g: 1.1, carbs_g: 9, fiber_g: 1.7 }),
  ing('courgette', 'Courgette', { category: 'legume', season_months: [6, 7, 8, 9], grams_per_piece: 200 }),
  ing('creme', 'Crème fraîche', { category: 'laitier', contains_lactose: true, is_vegan: false }),
  ing('oeuf', 'Œuf', { aliases: ['oeufs'], category: 'proteine', is_vegan: false, grams_per_piece: 55 }),
  ing('huile', "Huile d'olive", { category: 'huile', density: 0.92 }),
];
const catalog = new Map(catalogList.map((i) => [i.id, i]));

const recipe = (id: string, title: string, ids: string[], extra: Partial<Recipe> = {}): Recipe => ({
  id, title, meal_types: ['dejeuner', 'diner'], dish_type: 'plat', servings: 2, prep_min: 10, cook_min: 15, rest_min: 0,
  equipment: ['poele'], tags: [], steps: [],
  ingredients: ids.map((i, position) => ({ ingredient_id: i, quantity: 100, unit: 'g', optional: false, position })),
  ...extra,
});

const rizCurry = recipe('riz-curry', 'Riz au curry', ['riz', 'poulet', 'curry']);
const rizCantonais = recipe('riz-cantonais', 'Riz cantonais', ['riz', 'oeuf', 'oignon']);
const gratin = recipe('gratin', 'Gratin de courgettes', ['courgette', 'creme'], { equipment: ['four'], cook_min: 40 });

describe('parseIngredientLine', () => {
  it.each([
    ['200 g de farine', 200, 'g', 'farine'],
    ['200g de farine', 200, 'g', 'farine'],
    ["2 gousses d'ail", 2, 'gousse', 'ail'],
    ["1 c. à soupe d'huile d'olive", 1, 'cas', "huile d'olive"],
    ['1/2 citron', 0.5, null, 'citron'],
    ['1 1/2 tasse de lait', 1.5, 'tasse', 'lait'],
    ['3 œufs', 3, null, 'œufs'],
    ['sel', null, null, 'sel'],
  ])('%s', (line, q, u, name) => {
    const p = parseIngredientLine(line);
    if (q == null) expect(p.quantity).toBeNull();
    else expect(p.quantity).toBeCloseTo(q);
    expect(p.unit).toBe(u);
    expect(p.name).toBe(name);
  });

  it('sépare la note', () => {
    expect(parseIngredientLine('2 oignons, émincés')).toMatchObject({ name: 'oignons', note: 'émincés' });
  });
});

describe('matchIngredient', () => {
  it('relie les pluriels et qualificatifs', () => {
    expect(matchIngredient('oignons émincés', catalogList)[0]?.ingredient.id).toBe('oignon');
    expect(matchIngredient('riz', catalogList)[0]?.ingredient.id).toBe('riz');
    expect(matchIngredient('œufs', catalogList)[0]?.ingredient.id).toBe('oeuf');
  });
  it('ne relie pas un ingrédient inconnu avec confiance', () => {
    const d = resolveDraftIngredients({ title: 't', source_type: 'text', steps: [], ingredients: [
      { raw_text: '1 mangue', name: 'mangue', quantity: 1, unit: null },
    ] }, catalogList);
    expect(d.ingredients[0]!.match!.ingredient_id).toBeNull();
  });
});

describe('unités & nutrition', () => {
  it('convertit en grammes', () => {
    expect(toGrams(2, null, catalog.get('oignon'))).toBe(300);
    expect(toGrams(1, 'cas', catalog.get('huile'))).toBeCloseTo(13.8);
    expect(toGrams(1, 'botte', null)).toBeNull();
  });
  it('calcule la nutrition par portion', () => {
    const n = computeRecipeNutrition(rizCurry, catalog);
    expect(n.perServing.protein_g).toBeCloseTo((7 + 23) / 2);
    expect(n.missing).toEqual(['Curry en poudre']); // pas de valeurs renseignées
  });
  it('formate les quantités', () => {
    expect(formatQuantity(1500, 'g')).toBe('1,5 kg');
    expect(formatQuantity(0.5, 'piece')).toBe('½');
  });
});

describe('saisons & durées', () => {
  it('formate une saison', () => {
    expect(formatSeason([6, 7, 8, 9])).toBe('juin → sept.');
    expect(formatSeason([11, 12, 1, 2])).toBe('nov. → févr.');
    expect(formatSeason([])).toBe("toute l'année");
  });
  it('lit les durées ISO et les minuteries', () => {
    expect(isoDurationToMinutes('PT1H15M')).toBe(75);
    expect(detectStepTimer('Laisser cuire 12 minutes à feu doux')).toBe(720);
    expect(detectStepTimer('Enfourner pour 1 h')).toBe(3600);
    expect(detectStepTimer('Mélanger')).toBeNull();
  });
});

describe('filtres anti-frustration', () => {
  const ctx = { catalog, pantry: [] as PantryItem[] };
  it('sans four / sans lactose / moins de 30 min', () => {
    expect(matchesFilters(gratin, { noOven: true }, ctx)).toBe(false);
    expect(matchesFilters(gratin, { diets: ['sans_lactose'] }, ctx)).toBe(false);
    expect(matchesFilters(rizCurry, { maxMinutes: 30 }, ctx)).toBe(true);
    expect(matchesFilters(gratin, { maxMinutes: 30 }, ctx)).toBe(false);
  });
  it('avec ce que j’ai au frigo', () => {
    const pantry: PantryItem[] = ['riz', 'oeuf', 'oignon'].map((id) => ({
      id, ingredient_id: id, location: 'frigo', quantity: null, unit: null, expires_on: null, is_staple: false,
    }));
    expect(matchesFilters(rizCantonais, { maxMissingIngredients: 0 }, { catalog, pantry })).toBe(true);
    expect(matchesFilters(rizCurry, { maxMissingIngredients: 0 }, { catalog, pantry })).toBe(false);
  });
});

describe('suggestions', () => {
  const pantry: PantryItem[] = [
    { id: 'p1', ingredient_id: 'riz', location: 'frigo', quantity: 300, unit: 'g', expires_on: '2026-10-16', is_staple: false },
  ];

  it('le riz au curry mangé hier descend, mais le riz restant favorise une autre recette au riz', () => {
    const before = suggestRecipes([rizCurry, rizCantonais, gratin], { catalog, pantry, history: [], today: '2026-10-14' });
    const after = suggestRecipes([rizCurry, rizCantonais, gratin], {
      catalog, pantry, today: '2026-10-15',
      history: [{ recipe_id: 'riz-curry', eaten_on: '2026-10-14' }],
    });
    const scoreOf = (s: typeof before, id: string) => s.find((x) => x.recipe.id === id)!.score;
    expect(scoreOf(after, 'riz-curry')).toBeLessThan(scoreOf(before, 'riz-curry') - 20);
    expect(after[0]!.recipe.id).toBe('riz-cantonais');
    expect(after.find((x) => x.recipe.id === 'riz-curry')!.reasons).toContain('Mangé hier');
    expect(after[0]!.reasons.some((r) => r.includes('Riz basmati'))).toBe(true); // anti-gaspi
  });
});

describe('liste de courses', () => {
  it('additionne, met à l’échelle et retire le frigo', () => {
    const pantry: PantryItem[] = [
      { id: 'p', ingredient_id: 'riz', location: 'placard', quantity: 50, unit: 'g', expires_on: null, is_staple: false },
      { id: 's', ingredient_id: 'curry', location: 'epices', quantity: null, unit: null, expires_on: null, is_staple: true },
    ];
    const list = buildShoppingList([{ recipe: rizCurry, servings: 4 }, { recipe: rizCantonais }], catalog, pantry);
    const riz = list.find((i) => i.ingredient_id === 'riz')!;
    expect(riz.quantity).toBe(200 + 100 - 50);
    expect(riz.from_recipe_ids).toEqual(['riz-curry', 'riz-cantonais']);
    expect(list.find((i) => i.ingredient_id === 'curry')).toBeUndefined();
    expect(list[0]!.category).toBe('legume'); // rangé par rayon
  });
});
