import type { Ingredient, MealLogEntry, Recipe } from './types';
import { normalizeText, toGrams } from './units';

/**
 * Impact environnemental des repas : émissions de gaz à effet de serre, surface agricole
 * (indicateur de la pression sur les forêts) et eau prélevée.
 *
 * Source : Poore & Nemecek (2018), « Reducing food's environmental impacts through producers
 * and consumers », Science — via Our World in Data (CC BY 4.0). Valeurs moyennes mondiales,
 * de la ferme au magasin, par kg de produit (par litre pour les boissons).
 */
export interface ImpactFactor { co2: number; land: number; water: number }

export const IMPACT_SOURCE = 'Poore & Nemecek (2018), Science — via Our World in Data';

export const IMPACT_FACTORS = {
  apples: { co2: 0.43, land: 0.63, water: 180.1 },
  bananas: { co2: 0.86, land: 1.93, water: 114.5 },
  barley: { co2: 1.18, land: 1.11, water: 17.1 },
  beef: { co2: 99.48, land: 326.21, water: 1451.2 },
  beetSugar: { co2: 1.81, land: 1.83, water: 217.7 },
  berries: { co2: 1.53, land: 2.41, water: 419.6 },
  brassicas: { co2: 0.51, land: 0.55, water: 119.4 },
  cheese: { co2: 23.88, land: 87.79, water: 5605.2 },
  citrus: { co2: 0.39, land: 0.86, water: 82.7 },
  coffee: { co2: 28.53, land: 21.62, water: 25.9 },
  darkChocolate: { co2: 46.65, land: 68.96, water: 540.6 },
  eggs: { co2: 4.67, land: 6.27, water: 577.7 },
  fish: { co2: 13.63, land: 8.41, water: 3691.3 },
  groundnuts: { co2: 3.23, land: 9.11, water: 1852.3 },
  lamb: { co2: 39.72, land: 369.81, water: 1802.8 },
  maize: { co2: 1.7, land: 2.94, water: 215.7 },
  milk: { co2: 3.15, land: 8.95, water: 628.2 },
  nuts: { co2: 0.43, land: 12.96, water: 4133.8 },
  oatmeal: { co2: 2.48, land: 7.6, water: 482.4 },
  onionsLeeks: { co2: 0.5, land: 0.39, water: 14.3 },
  otherFruit: { co2: 1.05, land: 0.89, water: 153.5 },
  otherPulses: { co2: 1.79, land: 15.57, water: 435.7 },
  otherVegetables: { co2: 0.53, land: 0.38, water: 102.5 },
  peas: { co2: 0.98, land: 7.46, water: 396.6 },
  pork: { co2: 12.31, land: 17.36, water: 1795.8 },
  potatoes: { co2: 0.46, land: 0.88, water: 59.1 },
  poultry: { co2: 9.87, land: 12.22, water: 660 },
  prawns: { co2: 26.87, land: 2.97, water: 3515.4 },
  rice: { co2: 4.45, land: 2.8, water: 2248.4 },
  rootVegetables: { co2: 0.43, land: 0.33, water: 28.4 },
  tofu: { co2: 3.16, land: 3.52, water: 148.6 },
  tomatoes: { co2: 2.09, land: 0.8, water: 369.8 },
  wheat: { co2: 1.57, land: 3.85, water: 647.5 },
  wine: { co2: 1.79, land: 1.78, water: 78.9 },
  // Boissons végétales (par litre ; même étude, graphique « Environmental footprint of milks »)
  soyMilk: { co2: 0.98, land: 0.66, water: 27.8 },
  oatMilk: { co2: 0.9, land: 0.76, water: 48.2 },
  almondMilk: { co2: 0.7, land: 0.5, water: 371.5 },
  riceMilk: { co2: 1.18, land: 0.34, water: 269.8 },
} satisfies Record<string, ImpactFactor>;

export type ImpactKey = keyof typeof IMPACT_FACTORS;

// Règles nom → catégorie d'impact (la première qui correspond l'emporte)
const NAME_RULES: [RegExp, ImpactKey | null][] = [
  [/\b(boisson|lait)\b.*\bsoja\b/, 'soyMilk'],
  [/\b(boisson|lait)\b.*\bavoine\b/, 'oatMilk'],
  [/\b(boisson|lait)\b.*\bamande\b/, 'almondMilk'],
  [/\b(boisson|lait)\b.*\briz\b/, 'riceMilk'],
  [/\bcoco\b/, null],                                               // pas de donnée
  [/\b(beurre|creme|huile|sel|poivre|epice|sauce|bouillon|levure|vinaigre)\b/, null], // pas de donnée ou quantités infimes
  [/\b(fromage|emmental|gruyere|parmesan|mozzarella|comte|feta|cheddar|chevre|raclette)\b/, 'cheese'],
  [/\b(lait|yaourt|yogourt)\b/, 'milk'],
  [/\boeufs?\b/, 'eggs'],
  [/\b(boeuf|steak|veau|viande hachee|entrecote)\b/, 'beef'],
  [/\b(agneau|mouton)\b/, 'lamb'],
  [/\b(porc|lardons?|jambon|bacon|saucisses?|chorizo)\b/, 'pork'],
  [/\b(poulet|dinde|volaille|canard)\b/, 'poultry'],
  [/\b(crevettes?|gambas)\b/, 'prawns'],
  [/\b(saumon|thon|cabillaud|poisson|sardines?|truite|maquereau)\b/, 'fish'],
  [/\b(tofu|tempeh)\b/, 'tofu'],
  [/\bseitan\b/, 'wheat'],
  [/\bpetits? pois\b/, 'peas'],
  [/\b(lentilles?|pois chiches?|haricots? (rouges?|blancs?|noirs?|secs?)|feves?|flageolets?)\b/, 'otherPulses'],
  [/\bflocons? d.?avoine|\bavoine\b/, 'oatmeal'],
  [/\b(riz)\b/, 'rice'],
  [/\b(pates|spaghetti|penne|farine|pain|baguette|semoule|couscous|boulgour|ble)\b/, 'wheat'],
  [/\b(mais|polenta)\b/, 'maize'],
  [/\borge\b/, 'barley'],
  [/\b(pommes? de terre|patates?)\b/, 'potatoes'],
  [/\btomates?\b/, 'tomatoes'],
  [/\b(oignons?|poireaux?|echalotes?|ail)\b/, 'onionsLeeks'],
  [/\b(carottes?|betteraves?|navets?|radis|panais|celeri)\b/, 'rootVegetables'],
  [/\b(brocolis?|choux?|chou-fleur)\b/, 'brassicas'],
  [/\bpommes?\b/, 'apples'],
  [/\bbananes?\b/, 'bananas'],
  [/\b(citrons?|oranges?|pamplemousses?|clementines?)\b/, 'citrus'],
  [/\b(fraises?|framboises?|myrtilles?|raisins?|cassis)\b/, 'berries'],
  [/\bsucre\b/, 'beetSugar'],                                          // sucre de betterave en France
  [/\bchocolat\b/, 'darkChocolate'],
  [/\bcafe\b/, 'coffee'],
  [/\b(cacahuetes?|arachides?)\b/, 'groundnuts'],
  [/\b(noix|noisettes?|amandes?|cajou|pistaches?)\b/, 'nuts'],
  [/\bvin\b/, 'wine'],
];

/** Catégorie d'impact d'un ingrédient : par son nom, sinon par sa catégorie (légume, fruit). null = non comptabilisé. */
export function impactKeyOf(ing: Ingredient): ImpactKey | null {
  const name = normalizeText(ing.name).replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’']/g, ' ');
  for (const [re, key] of NAME_RULES) if (re.test(name)) return key;
  if (ing.category === 'legume') return 'otherVegetables';
  if (ing.category === 'fruit') return 'otherFruit';
  if (ing.category === 'legumineuse') return 'otherPulses';
  return null;
}

/** Viande de comparaison pour estimer « le même plat avec de la viande ». */
export type ReferenceMeat = 'poultry' | 'pork' | 'beef' | 'mix';
export const REFERENCE_MEATS: { key: ReferenceMeat; label: string }[] = [
  { key: 'poultry', label: 'Poulet' },
  { key: 'pork', label: 'Porc' },
  { key: 'mix', label: 'Moyenne (⅓ volaille, porc, bœuf)' },
  { key: 'beef', label: 'Bœuf' },
];
/** Protéines pour 100 g de viande crue (ordre de grandeur) : sert à remplacer à protéines égales. */
const MEAT_PROTEIN_100G = { poultry: 23, pork: 21, beef: 21 };

function meatFactor(ref: ReferenceMeat): ImpactFactor & { protein: number } {
  if (ref !== 'mix') return { ...IMPACT_FACTORS[ref], protein: MEAT_PROTEIN_100G[ref] };
  const parts = (['poultry', 'pork', 'beef'] as const).map((k) => ({ ...IMPACT_FACTORS[k], protein: MEAT_PROTEIN_100G[k] }));
  const avg = (k: 'co2' | 'land' | 'water' | 'protein') => parts.reduce((s, p) => s + p[k], 0) / parts.length;
  return { co2: avg('co2'), land: avg('land'), water: avg('water'), protein: avg('protein') };
}

/** Sources de protéines végétales remplaçables par de la viande dans la comparaison. */
const PLANT_PROTEIN_KEYS = new Set<ImpactKey>(['tofu', 'otherPulses']);

export interface Impact { co2: number; land: number; water: number }
const zero = (): Impact => ({ co2: 0, land: 0, water: 0 });
const add = (a: Impact, f: ImpactFactor, kg: number) => { a.co2 += f.co2 * kg; a.land += f.land * kg; a.water += f.water * kg; };

export interface RecipeImpact {
  /** Par portion, tel que cuisiné (remplacements inclus) */
  actual: Impact;
  /** Par portion, version « classique » : ingrédients d'origine et protéines végétales remplacées par de la viande */
  conventional: Impact;
  /** Part des lignes d'ingrédients prises en compte (0..1) */
  coverage: number;
  /** Ce qui change entre les deux versions, pour l'expliquer */
  swaps: { from: string; to: string }[];
}

export function recipeImpact(recipe: Recipe, catalog: Map<string, Ingredient>, ref: ReferenceMeat = 'poultry'): RecipeImpact {
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  const actual = zero();
  const conventional = zero();
  const swaps: RecipeImpact['swaps'] = [];
  const meat = meatFactor(ref);
  const meatLabel = REFERENCE_MEATS.find((m) => m.key === ref)!.label.toLowerCase();
  let counted = 0;
  const lines = recipe.ingredients.filter((l) => !l.optional);

  for (const line of lines) {
    const ing = line.ingredient_id ? catalog.get(line.ingredient_id) : undefined;
    const key = ing ? impactKeyOf(ing) : null;
    const grams = ing ? toGrams(line.quantity, line.unit, ing) : null;
    if (!ing || grams == null) continue;
    counted++;
    if (key) add(actual, IMPACT_FACTORS[key], grams / 1000);

    // 1. Ingrédient remplacé par le foyer (lait → boisson soja) : la version classique garde l'original
    const orig = line.substituted_from ? catalog.get(line.substituted_from.ingredient_id) : undefined;
    if (orig) {
      const origKey = impactKeyOf(orig);
      const origGrams = toGrams(line.substituted_from!.quantity, line.substituted_from!.unit, orig);
      if (origKey && origGrams != null) add(conventional, IMPACT_FACTORS[origKey], origGrams / 1000);
      swaps.push({ from: orig.name, to: ing.name });
      continue;
    }
    // 2. Protéine végétale : la version classique utilise de la viande, à protéines égales
    if (key && PLANT_PROTEIN_KEYS.has(key)) {
      const protein = ing.protein_g ? (grams * ing.protein_g) / 100 : null;
      const meatGrams = protein != null ? (protein / meat.protein) * 100 : grams;
      add(conventional, meat, meatGrams / 1000);
      swaps.push({ from: meatLabel, to: ing.name });
      continue;
    }
    if (key) add(conventional, IMPACT_FACTORS[key], grams / 1000);
  }

  const per = (i: Impact): Impact => ({ co2: i.co2 / servings, land: i.land / servings, water: i.water / servings });
  return { actual: per(actual), conventional: per(conventional), coverage: lines.length ? counted / lines.length : 0, swaps };
}

/** Le plat contient-il de la viande ou du poisson ? */
export function containsMeat(recipe: Recipe, catalog: Map<string, Ingredient>): boolean {
  return recipe.ingredients.some((l) => {
    const ing = l.ingredient_id ? catalog.get(l.ingredient_id) : undefined;
    const key = ing ? impactKeyOf(ing) : null;
    return key === 'beef' || key === 'lamb' || key === 'pork' || key === 'poultry' || key === 'fish' || key === 'prawns';
  });
}

export interface ImpactSummary {
  meals: number;
  plantMeals: number;
  actual: Impact;
  conventional: Impact;
  /** Évité = classique − réel (jamais négatif) */
  saved: Impact;
  /** Un élément par repas cuisiné, du plus récent au plus ancien */
  perMeal: { recipe: Recipe; eaten_on: string; saved: Impact }[];
}

/** Bilan des repas cuisinés (historique « J'ai cuisiné ça » / mode cuisine). */
export function impactSummary(
  history: MealLogEntry[], recipes: Recipe[], catalog: Map<string, Ingredient>,
  opts: { ref?: ReferenceMeat; since?: string } = {},
): ImpactSummary {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const sum: ImpactSummary = { meals: 0, plantMeals: 0, actual: zero(), conventional: zero(), saved: zero(), perMeal: [] };
  for (const h of history) {
    if (opts.since && h.eaten_on < opts.since) continue;
    const r = h.recipe_id ? byId.get(h.recipe_id) : undefined;
    if (!r) continue;
    const imp = recipeImpact(r, catalog, opts.ref);
    const k = (h.servings ?? r.servings) || 1;
    const saved: Impact = {
      co2: Math.max(0, imp.conventional.co2 - imp.actual.co2) * k,
      land: Math.max(0, imp.conventional.land - imp.actual.land) * k,
      water: Math.max(0, imp.conventional.water - imp.actual.water) * k,
    };
    sum.meals++;
    if (!containsMeat(r, catalog)) sum.plantMeals++;
    for (const key of ['co2', 'land', 'water'] as const) {
      sum.actual[key] += imp.actual[key] * k;
      sum.conventional[key] += imp.conventional[key] * k;
      sum.saved[key] += saved[key];
    }
    sum.perMeal.push({ recipe: r, eaten_on: h.eaten_on, saved });
  }
  sum.perMeal.sort((a, b) => b.eaten_on.localeCompare(a.eaten_on));
  return sum;
}

/** Équivalences parlantes (ordres de grandeur). */
export const EQUIVALENTS = {
  /** kg CO₂e par km en voiture thermique moyenne */
  carKgPerKm: 0.2,
  /** m² d'un terrain de tennis (double) */
  tennisCourtM2: 260,
  /** litres d'une douche de 5 minutes */
  showerLiters: 60,
};
