import type { Ingredient, Nutrition, Recipe } from './types';
import { toGrams } from './units';

/**
 * Repères nutritionnels d'une portion : points d'attention ET points forts.
 * Principes : niveaux gradués, repère chiffré, ingrédient responsable, alternative concrète,
 * jamais de jugement moral. Formulations descriptives (« peu sucré »), pas les allégations
 * réglementaires UE (« faible teneur en sucres »…), dont les définitions sont plus strictes.
 */

/** Repères journaliers d'un adulte (apports de référence UE, règlement 1169/2011 ; fibres : conseil ~30 g). */
export const DAILY_REFERENCE = { kcal: 2000, salt_g: 6, sugars_g: 90, sat_fat_g: 20, fiber_g: 30 } as const;

/** Seuils par portion. Regroupés ici pour être un jour adaptés au profil (voir docs/idees/profils-nutrition.md). */
export const MESSAGE_THRESHOLDS = {
  kcalHigh: 650,
  salt: { low: 0.6, moderate: 1.5, high: 2.5 },
  sugars: { low: 5, moderate: 15, high: 30 },
  satFat: { low: 2, moderate: 6, high: 12 },
  fiber: { low: 4, good: 5, excellent: 8 },
  protein: { low: 12, good: 20 },          // plats principaux
  vegetables_g: { low: 80, rich: 150 },    // plats principaux
  legumes_g: { cooked: 60, dry: 25 },      // ~60–80 g cuits ≈ 25 g secs
};

export type MessageTone = 'positive' | 'attention';

export interface NutritionMessage {
  key: string;
  tone: MessageTone;
  /** 1 = modéré, 2 = élevé, 3 = très élevé (attention) ; 1 = bon, 2 = excellent (positif) */
  level: 1 | 2 | 3;
  title: string;
  detail: string;
  /** Alternative concrète (points d'attention uniquement) */
  tip?: string;
}

type NutrientKey = 'salt_g' | 'sugars_g' | 'sat_fat_g';

interface Contribution { name: string; amount: number; ingredient: Ingredient }

const fmt = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',').replace(/,0$/, '');
const pct = (part: number, total: number) => `${Math.round((part / total) * 100)} %`;

/** Ingrédients qui apportent le nutriment, par portion, du plus gros au plus petit. */
function contributions(recipe: Recipe, catalog: Map<string, Ingredient>, key: NutrientKey): Contribution[] {
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  const out: Contribution[] = [];
  for (const l of recipe.ingredients) {
    if (l.optional || !l.ingredient_id) continue;
    const ing = catalog.get(l.ingredient_id);
    const grams = ing ? toGrams(l.quantity, l.unit, ing) : null;
    if (!ing || grams == null || !ing[key]) continue;
    out.push({ name: ing.name, amount: (grams * (ing[key] as number)) / 100 / servings, ingredient: ing });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** « dont 14,3 g apportés par « Emmental râpé » » si un ingrédient pèse au moins la moitié du total. */
function culpritText(list: Contribution[], total: number): string {
  const top = list[0];
  if (!top || top.amount < total * 0.5) return '';
  return `, dont ${fmt(top.amount)} g apportés par « ${top.name} »`;
}

function satFatTip(top?: Contribution): string {
  if (!top) return 'Une portion plus petite ou une version moins grasse d’un ingrédient réduirait ce chiffre.';
  const n = top.name.toLowerCase();
  if (n.includes('coco')) return 'Du lait de coco allégé, ou moitié moins de lait de coco complété par du bouillon, diviserait ce chiffre par deux.';
  if (top.ingredient.category === 'laitier' && /emmental|gruy|parmesan|fromage|comt/.test(n)) {
    return 'Une portion de fromage plus petite, ou remplacer une partie par de la mozzarella, réduirait ce chiffre.';
  }
  if (/beurre|crème|creme/.test(n)) return `Remplacer une partie de « ${top.name} » par de l’huile d’olive ou de colza réduirait ce chiffre.`;
  return `Réduire la quantité de « ${top.name} » ou en choisir une version allégée réduirait ce chiffre.`;
}

function saltTip(top?: Contribution): string {
  const n = top?.name.toLowerCase() ?? '';
  if (!top || n === 'sel') return 'Réduire le sel ajouté de 20–30 % ferait déjà une différence.';
  return `Réduire la quantité de « ${top.name} » de 25 % ou utiliser une version réduite en sel ferait déjà une différence.`;
}

/** Grammes par portion des ingrédients d'une famille. */
function gramsWhere(recipe: Recipe, catalog: Map<string, Ingredient>, keep: (ing: Ingredient) => boolean): { grams: number; items: Ingredient[] } {
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  let grams = 0;
  const items: Ingredient[] = [];
  for (const l of recipe.ingredients) {
    if (l.optional || !l.ingredient_id) continue;
    const ing = catalog.get(l.ingredient_id);
    if (!ing || !keep(ing)) continue;
    const g = toGrams(l.quantity, l.unit, ing);
    if (g == null) continue;
    grams += g / servings;
    items.push(ing);
  }
  return { grams, items };
}

// Légumes « vrais » : on écarte les féculents classés légumes (pomme de terre…) via leur teneur en glucides
const isVegetable = (i: Ingredient) => i.category === 'legume' && (i.carbs_g ?? 0) <= 12;
const isLegume = (i: Ingredient) => i.category === 'legumineuse';

/** Plat principal = servi au déjeuner ou au dîner (un porridge du petit-déjeuner n'en est pas un). */
export function isMainDish(recipe: Recipe): boolean {
  if (recipe.meal_types.length) return recipe.meal_types.some((m) => m === 'dejeuner' || m === 'diner');
  return recipe.dish_type === 'plat';
}

/**
 * Calcule les repères d'une portion. Les points d'attention sont triés du plus marqué au moins marqué ;
 * les points forts suivent l'ordre fibres → protéines → légumes → légumineuses → sel/sucre/gras bas.
 */
export function nutritionMessages(
  perServing: Nutrition,
  recipe: Recipe,
  catalog: Map<string, Ingredient>,
  thresholds = MESSAGE_THRESHOLDS,
): NutritionMessage[] {
  const T = thresholds;
  const R = DAILY_REFERENCE;
  const main = isMainDish(recipe);
  const attention: NutritionMessage[] = [];
  const positive: NutritionMessage[] = [];
  const { salt_g: salt, sugars_g: sugars, sat_fat_g: sat, fiber_g: fiber, protein_g: protein, kcal } = perServing;

  // --- Sel -------------------------------------------------------------------------------
  if (salt > T.salt.moderate) {
    const list = contributions(recipe, catalog, 'salt_g');
    const high = salt > T.salt.high;
    attention.push({
      key: 'salt', tone: 'attention', level: high ? 2 : 1,
      title: high ? 'Très salé' : 'Plutôt salé',
      detail: `${fmt(salt)} g de sel par portion, soit ${pct(salt, R.salt_g)} du repère de ${R.salt_g} g/jour${culpritText(list, salt)}.`,
      tip: saltTip(list[0]),
    });
  } else if (salt <= T.salt.low) {
    positive.push({ key: 'salt-low', tone: 'positive', level: 1, title: 'Peu salé', detail: `${fmt(salt)} g de sel par portion.` });
  }

  // --- Sucres ----------------------------------------------------------------------------
  if (sugars > T.sugars.moderate) {
    const list = contributions(recipe, catalog, 'sugars_g');
    const high = sugars > T.sugars.high;
    attention.push({
      key: 'sugars', tone: 'attention', level: high ? 2 : 1,
      title: high ? 'Très sucré' : 'Assez sucré',
      detail: `${fmt(sugars, 0)} g de sucres par portion, soit ${pct(sugars, R.sugars_g)} du repère de ${R.sugars_g} g/jour${culpritText(list, sugars)}.`,
      tip: list[0] && list[0].ingredient.category === 'fruit'
        ? 'Ces sucres viennent surtout des fruits : rien d’inquiétant dans une semaine variée.'
        : 'Réduire le sucre, le sirop, le miel ou les fruits secs aiderait.',
    });
  } else if (sugars <= T.sugars.low) {
    positive.push({ key: 'sugars-low', tone: 'positive', level: 1, title: 'Peu sucré', detail: `${fmt(sugars, 0)} g de sucres par portion.` });
  }

  // --- Graisses saturées -----------------------------------------------------------------
  if (sat > T.satFat.moderate) {
    const list = contributions(recipe, catalog, 'sat_fat_g');
    const veryHigh = sat > T.satFat.high;
    attention.push({
      key: 'satfat', tone: 'attention', level: veryHigh ? 3 : 2,
      title: veryHigh ? 'Très riche en graisses saturées' : 'Riche en graisses saturées',
      detail: `${fmt(sat)} g par portion, soit ${pct(sat, R.sat_fat_g)} du repère de ${R.sat_fat_g} g/jour${culpritText(list, sat)}.`,
      tip: satFatTip(list[0]),
    });
  } else if (sat <= T.satFat.low) {
    positive.push({ key: 'satfat-low', tone: 'positive', level: 1, title: 'Peu de graisses saturées', detail: `${fmt(sat)} g par portion.` });
  }

  // --- Énergie ---------------------------------------------------------------------------
  if (kcal > T.kcalHigh) {
    attention.push({
      key: 'kcal', tone: 'attention', level: 1, title: 'Plutôt calorique',
      detail: `${Math.round(kcal)} kcal par portion, environ ${pct(kcal, R.kcal)} d’un besoin de ${R.kcal} kcal/jour (à ajuster selon ton activité).`,
      tip: 'Une portion un peu plus petite, complétée de légumes, garderait le même volume dans l’assiette.',
    });
  }

  // --- Fibres ----------------------------------------------------------------------------
  if (fiber >= T.fiber.excellent) {
    positive.push({ key: 'fiber', tone: 'positive', level: 2, title: 'Excellente source de fibres', detail: `${fmt(fiber)} g par portion, soit ${pct(fiber, R.fiber_g)} des ~${R.fiber_g} g/jour conseillés.` });
  } else if (fiber >= T.fiber.good) {
    positive.push({ key: 'fiber', tone: 'positive', level: 1, title: 'Bonne source de fibres', detail: `${fmt(fiber)} g par portion, soit ${pct(fiber, R.fiber_g)} des ~${R.fiber_g} g/jour conseillés.` });
  } else if (main && fiber < T.fiber.low) {
    attention.push({
      key: 'fiber-low', tone: 'attention', level: 1, title: 'Peu de fibres',
      detail: `${fmt(fiber)} g par portion, moins de ${pct(T.fiber.low, R.fiber_g)} des ~${R.fiber_g} g/jour conseillés.`,
      tip: 'Ajouter des légumes, des légumineuses ou un féculent complet améliorerait le profil.',
    });
  }

  // --- Protéines (plats principaux) ------------------------------------------------------
  if (main && protein >= T.protein.good) {
    positive.push({ key: 'protein', tone: 'positive', level: 1, title: 'Bonne source de protéines', detail: `${fmt(protein, 0)} g par portion.` });
  } else if (main && protein < T.protein.low) {
    attention.push({
      key: 'protein-low', tone: 'attention', level: 1, title: 'Peu de protéines',
      detail: `${fmt(protein, 0)} g par portion pour un plat principal.`,
      tip: 'Ajouter des légumineuses, du tofu, des œufs ou des produits laitiers peut aider.',
    });
  }

  // --- Composition : légumes et légumineuses ---------------------------------------------
  const veg = gramsWhere(recipe, catalog, isVegetable);
  if (veg.grams >= T.vegetables_g.rich) {
    positive.push({ key: 'veg', tone: 'positive', level: 1, title: 'Riche en légumes', detail: `${Math.round(veg.grams)} g par portion.` });
  } else if (main && veg.grams < T.vegetables_g.low) {
    attention.push({
      key: 'veg-low', tone: 'attention', level: 1, title: 'Peu de légumes',
      detail: veg.grams > 0 ? `${Math.round(veg.grams)} g par portion, moins d’une portion de légumes (80–100 g).` : 'Pas de légumes dans ce plat.',
      tip: 'Une salade, des crudités ou des légumes rôtis à côté compléteraient l’assiette.',
    });
  }

  // Légumineuses : seuil plus bas pour les produits secs (≈ 340 kcal/100 g) que pour les cuites ou en conserve
  const leg = gramsWhere(recipe, catalog, isLegume);
  const legEnough = leg.items.some((i) => (i.kcal ?? 0) > 200) ? leg.grams >= T.legumes_g.dry : leg.grams >= T.legumes_g.cooked;
  if (leg.items.length && legEnough) {
    const names = [...new Set(leg.items.map((i) => i.name.toLowerCase()))].join(' et ');
    positive.push({ key: 'legumes', tone: 'positive', level: 1, title: 'Contient des légumineuses', detail: `${Math.round(leg.grams)} g de ${names} par portion : fibres et protéines végétales.` });
  }

  return [...attention.sort((a, b) => b.level - a.level), ...positive];
}
