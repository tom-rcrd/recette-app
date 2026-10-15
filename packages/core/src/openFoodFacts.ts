import type { Ingredient } from './types';

/** Champs demandés à l'API Open Food Facts (limite la taille de la réponse). */
export const OFF_FIELDS = [
  'code', 'product_name', 'product_name_fr', 'generic_name_fr', 'brands', 'quantity', 'product_quantity',
  'product_quantity_unit', 'nutriments', 'nutriscore_grade', 'nova_group', 'allergens_tags',
  'ingredients_analysis_tags', 'labels_tags', 'categories_tags', 'additives_tags', 'image_front_url',
].join(',');

export const offProductUrl = (barcode: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;

/** Sous-ensemble de la réponse Open Food Facts utilisé par l'app. */
export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  generic_name_fr?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  nutriments?: Record<string, number | string | undefined>;
  nutriscore_grade?: string;
  nova_group?: number | string;
  allergens_tags?: string[];
  ingredients_analysis_tags?: string[];
  labels_tags?: string[];
  categories_tags?: string[];
  additives_tags?: string[];
  image_front_url?: string;
}

// Allergènes Open Food Facts → clés de l'app (14 allergènes réglementaires)
const ALLERGEN_MAP: Record<string, string> = {
  'en:gluten': 'gluten', 'en:milk': 'lait', 'en:eggs': 'oeuf', 'en:peanuts': 'arachide', 'en:nuts': 'fruits_a_coque',
  'en:soybeans': 'soja', 'en:fish': 'poisson', 'en:crustaceans': 'crustaces', 'en:celery': 'celeri',
  'en:mustard': 'moutarde', 'en:sesame-seeds': 'sesame', 'en:sulphur-dioxide-and-sulphites': 'sulfites',
  'en:lupin': 'lupin', 'en:molluscs': 'mollusques',
};

// Catégories Open Food Facts → rayons de l'app (première correspondance gagnante)
const CATEGORY_MAP: [string, string][] = [
  ['en:beverages', 'boisson'], ['en:dairies', 'laitier'], ['en:cheeses', 'laitier'], ['en:yogurts', 'laitier'],
  ['en:meats', 'proteine'], ['en:fishes', 'proteine'], ['en:seafood', 'proteine'], ['en:eggs', 'proteine'],
  ['en:legumes', 'legumineuse'], ['en:pulses', 'legumineuse'], ['en:fresh-vegetables', 'legume'], ['en:vegetables', 'legume'],
  ['en:fruits', 'fruit'], ['en:breads', 'boulangerie'], ['en:pastas', 'feculent'], ['en:rices', 'feculent'],
  ['en:cereals-and-potatoes', 'feculent'], ['en:flours', 'feculent'], ['en:fats', 'huile'], ['en:vegetable-oils', 'huile'],
  ['en:spices', 'epice'], ['en:condiments', 'condiment'], ['en:sauces', 'condiment'], ['en:groceries', 'condiment'],
];

export const ORGANIC_LABELS = ['en:organic', 'fr:ab-agriculture-biologique', 'en:eu-organic'];

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** Données d'un produit du commerce prêtes à enregistrer comme ingrédient. */
export type OffIngredient = Pick<Ingredient,
  'name' | 'kind' | 'category' | 'brand' | 'barcode' | 'image_url' | 'grams_per_piece' | 'kcal' | 'protein_g' | 'carbs_g'
  | 'sugars_g' | 'fat_g' | 'sat_fat_g' | 'fiber_g' | 'salt_g' | 'is_vegan' | 'is_vegetarian' | 'contains_lactose'
  | 'contains_gluten' | 'allergens' | 'nutriscore_grade' | 'nova_group' | 'additives' | 'labels' | 'analysis_tags'>;

export function offProductToIngredient(p: OffProduct, barcode: string): OffIngredient {
  const n = p.nutriments ?? {};
  const allergens = [...new Set((p.allergens_tags ?? []).map((t) => ALLERGEN_MAP[t]).filter((x): x is string => !!x))];
  const analysis = p.ingredients_analysis_tags ?? [];
  const labels = p.labels_tags ?? [];
  const cats = p.categories_tags ?? [];
  const glutenFree = labels.includes('en:no-gluten') || labels.includes('en:gluten-free');
  const qtyUnit = (p.product_quantity_unit ?? 'g').toLowerCase();
  const grade = (p.nutriscore_grade ?? '').toLowerCase();
  const nova = num(p.nova_group);

  return {
    name: (p.product_name_fr || p.product_name || p.generic_name_fr || `Produit ${barcode}`).trim(),
    kind: 'product',
    category: CATEGORY_MAP.find(([tag]) => cats.includes(tag))?.[1] ?? 'autre',
    brand: p.brands?.split(',')[0]?.trim() || null,
    barcode,
    image_url: p.image_front_url ?? null,
    // "1 pièce" = le paquet (125 g pour un yaourt, 400 g pour un pot…)
    grams_per_piece: qtyUnit === 'g' || qtyUnit === 'ml' ? num(p.product_quantity) : null,
    kcal: num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) != null ? Math.round(num(n['energy_100g'])! / 4.184) : null),
    protein_g: num(n['proteins_100g']),
    carbs_g: num(n['carbohydrates_100g']),
    sugars_g: num(n['sugars_100g']),
    fat_g: num(n['fat_100g']),
    sat_fat_g: num(n['saturated-fat_100g']),
    fiber_g: num(n['fiber_100g']),
    salt_g: num(n['salt_100g']),
    is_vegan: analysis.includes('en:vegan'),
    is_vegetarian: analysis.includes('en:vegan') || analysis.includes('en:vegetarian'),
    // Le lait est le seul indicateur fiable du lactose sur Open Food Facts
    contains_lactose: allergens.includes('lait') && !labels.includes('en:no-lactose'),
    contains_gluten: allergens.includes('gluten') && !glutenFree,
    allergens,
    nutriscore_grade: ['a', 'b', 'c', 'd', 'e'].includes(grade) ? grade : null,
    nova_group: nova != null && nova >= 1 && nova <= 4 ? nova : null,
    additives: p.additives_tags ?? [],
    labels,
    analysis_tags: analysis,
  };
}

/** "en:e322i" → "E322i" */
export const formatAdditive = (tag: string) => tag.replace(/^[a-z]{2}:e/, 'E');
