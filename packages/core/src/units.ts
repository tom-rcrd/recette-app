import type { Ingredient } from './types';

export type CanonicalUnit =
  | 'g' | 'kg' | 'mg'
  | 'ml' | 'cl' | 'dl' | 'l'
  | 'cas' | 'cac' | 'tasse' | 'pincee'
  | 'piece' | 'gousse' | 'tranche' | 'botte' | 'sachet' | 'boite';

// Variantes rencontrées dans les recettes FR/EN → unité canonique
const UNIT_ALIASES: Record<string, CanonicalUnit> = {
  g: 'g', gr: 'g', gramme: 'g', grammes: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramme: 'kg', kilogrammes: 'kg',
  mg: 'mg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml',
  cl: 'cl', centilitre: 'cl', centilitres: 'cl',
  dl: 'dl', decilitre: 'dl', decilitres: 'dl',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  cas: 'cas', 'c.a.s': 'cas', 'c.à.s': 'cas', 'c. a s': 'cas', cs: 'cas', cuillere_a_soupe: 'cas', tbsp: 'cas', tablespoon: 'cas', tablespoons: 'cas',
  cac: 'cac', 'c.a.c': 'cac', 'c.à.c': 'cac', cc: 'cac', cuillere_a_cafe: 'cac', tsp: 'cac', teaspoon: 'cac', teaspoons: 'cac',
  tasse: 'tasse', tasses: 'tasse', cup: 'tasse', cups: 'tasse', verre: 'tasse', verres: 'tasse',
  pincee: 'pincee', pincees: 'pincee', pinch: 'pincee',
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece', unite: 'piece', unites: 'piece',
  gousse: 'gousse', gousses: 'gousse', clove: 'gousse', cloves: 'gousse',
  tranche: 'tranche', tranches: 'tranche', slice: 'tranche', slices: 'tranche',
  botte: 'botte', bottes: 'botte', bouquet: 'botte', bouquets: 'botte',
  sachet: 'sachet', sachets: 'sachet',
  boite: 'boite', boites: 'boite', can: 'boite', cans: 'boite',
};

/** Retire accents, ponctuation finale et met en minuscules. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeUnit(unit: string | null | undefined): CanonicalUnit | null {
  if (!unit) return null;
  const key = normalizeText(unit).replace(/\.$/, '').replace(/\s+/g, '_');
  return UNIT_ALIASES[key] ?? UNIT_ALIASES[key.replace(/_/g, ' ')] ?? null;
}

const MASS_G: Partial<Record<CanonicalUnit, number>> = { g: 1, kg: 1000, mg: 0.001 };
const VOLUME_ML: Partial<Record<CanonicalUnit, number>> = {
  ml: 1, cl: 10, dl: 100, l: 1000, cas: 15, cac: 5, tasse: 240, pincee: 0.5,
};

/**
 * Convertit une quantité en grammes. Utilise la densité (g/ml, défaut 1) pour
 * les volumes et grams_per_piece pour les unités "pièce". Renvoie null si
 * la conversion est impossible (ex. "1 botte" sans poids connu).
 */
export function toGrams(
  quantity: number | null,
  unit: string | null,
  ingredient?: Pick<Ingredient, 'density' | 'grams_per_piece'> | null,
): number | null {
  if (quantity == null) return null;
  const u = normalizeUnit(unit) ?? (unit ? null : 'piece');
  if (!u) return null;
  const mass = MASS_G[u];
  if (mass != null) return quantity * mass;
  const vol = VOLUME_ML[u];
  if (vol != null) return quantity * vol * (ingredient?.density ?? 1);
  if (ingredient?.grams_per_piece) return quantity * ingredient.grams_per_piece;
  return null;
}

/** Famille d'unité, pour savoir si deux quantités sont additionnables. */
export function unitFamily(unit: string | null): 'mass' | 'volume' | 'count' | null {
  const u = normalizeUnit(unit) ?? (unit ? null : 'piece');
  if (!u) return null;
  if (MASS_G[u] != null) return 'mass';
  if (VOLUME_ML[u] != null) return 'volume';
  return 'count';
}

/** Convertit vers l'unité de base de la famille (g, ml ou nombre). */
export function toBaseUnit(quantity: number, unit: string | null): { quantity: number; unit: 'g' | 'ml' | string } | null {
  const u = normalizeUnit(unit) ?? (unit ? null : 'piece');
  if (!u) return null;
  const mass = MASS_G[u];
  if (mass != null) return { quantity: quantity * mass, unit: 'g' };
  const vol = VOLUME_ML[u];
  if (vol != null) return { quantity: quantity * vol, unit: 'ml' };
  return { quantity, unit: u };
}

/** Affichage lisible : 1500 g → "1,5 kg", 0.25 → "¼". */
export function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity == null) return unit ?? '';
  let q = quantity;
  let u = unit ?? '';
  if (u === 'g' && q >= 1000) { q /= 1000; u = 'kg'; }
  if (u === 'ml' && q >= 1000) { q /= 1000; u = 'l'; }
  const fractions: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };
  const whole = Math.floor(q);
  // Fractions seulement pour les unités "de cuisine" (½ citron, ¼ c. à c.), pas pour g/ml/kg
  const metric = ['g', 'kg', 'mg', 'ml', 'cl', 'dl', 'l'].includes(u);
  const frac = metric ? undefined : fractions[(Math.round((q - whole) * 100) / 100).toString()];
  const num = frac
    ? `${whole > 0 ? whole : ''}${frac}`
    : (Math.round(q * 10) / 10).toString().replace('.', ',');
  const label = u === 'piece' ? '' : u === 'cas' ? 'c. à s.' : u === 'cac' ? 'c. à c.' : u;
  return label ? `${num} ${label}` : num;
}
