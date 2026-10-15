import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_CRITERIA, formatAdditive, offProductToIngredient, scoreProduct, withDefaultCriteria,
  type Ingredient, type OffProduct,
} from '../src';

const nutella = JSON.parse(readFileSync(new URL('./fixtures/off-nutella.json', import.meta.url), 'utf8')) as OffProduct;
const asIngredient = (p: OffProduct, code: string): Ingredient =>
  ({ id: 'x', aliases: [], season_months: [], ...offProductToIngredient(p, code) }) as Ingredient;

describe('Open Food Facts → ingrédient', () => {
  const ing = offProductToIngredient(nutella, '3017620422003');

  it('reprend nom, marque, quantité et nutrition', () => {
    expect(ing).toMatchObject({
      name: 'Nutella', brand: 'Nutella', kind: 'product', barcode: '3017620422003',
      grams_per_piece: 400, kcal: 539, protein_g: 6.3, sugars_g: 56.3, sat_fat_g: 10.6, salt_g: 0.11,
      nutriscore_grade: 'e', nova_group: 4,
    });
  });

  it('traduit allergènes et régimes', () => {
    expect(ing.allergens).toEqual(['lait', 'fruits_a_coque', 'soja']);
    expect(ing.contains_lactose).toBe(true);
    expect(ing.contains_gluten).toBe(false);
    expect(ing.is_vegetarian).toBe(true);
    expect(ing.is_vegan).toBe(false);
    expect(ing.analysis_tags).toContain('en:palm-oil');
  });

  it('formate les additifs', () => {
    expect(formatAdditive('en:e322i')).toBe('E322i');
  });

  it('tolère un produit presque vide', () => {
    const empty = offProductToIngredient({}, '123');
    expect(empty.name).toBe('Produit 123');
    expect(empty.kcal).toBeNull();
    expect(empty.nutriscore_grade).toBeNull();
  });
});

describe('note personnelle', () => {
  const ing = asIngredient(nutella, '3017620422003');

  it('note par défaut : Nutri-Score E + ultra-transformé → mauvais', () => {
    const s = scoreProduct(ing)!;
    // (0×50 + 15×25 + 70×15 + 0×10) / 100
    expect(s.score).toBe(14);
    expect(s.label).toBe('mauvais');
    expect(s.reasons).toContain('Nutri-Score E');
  });

  it('les poids changent la note', () => {
    const onlyAdditives = withDefaultCriteria({ weights: { nutrition: 0, processing: 0, additives: 100, organic: 0 } });
    expect(scoreProduct(ing, onlyAdditives)!.score).toBe(70);
  });

  it('critères éliminatoires', () => {
    expect(scoreProduct(ing, { ...DEFAULT_CRITERIA, avoidAllergens: ['fruits_a_coque'] })!.score).toBe(0);
    const sugar = scoreProduct(ing, withDefaultCriteria({ maxSugars100g: 10, weights: { nutrition: 0, processing: 0, additives: 100, organic: 0 } }))!;
    expect(sugar.score).toBe(50);
    expect(sugar.reasons[0]).toMatch(/Sucres 56.3 g/);
    const palm = scoreProduct(ing, withDefaultCriteria({ avoidPalmOil: true, weights: { nutrition: 0, processing: 0, additives: 100, organic: 0 } }))!;
    expect(palm.score).toBe(25);
    expect(palm.reasons[0]).toBe('Contient de l’huile de palme');
  });

  it('pas de note pour un produit de base saisi à la main', () => {
    expect(scoreProduct({ ...ing, barcode: null, nutriscore_grade: null, nova_group: null })).toBeNull();
  });

  it('un produit bio, peu transformé, sans additif est excellent', () => {
    const s = scoreProduct({ ...ing, nutriscore_grade: 'a', nova_group: 1, additives: [], labels: ['en:organic'] })!;
    expect(s.score).toBe(100);
    expect(s.label).toBe('excellent');
  });
});
