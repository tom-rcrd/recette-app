import type { Ingredient, Recipe } from './types';

export const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Un ingrédient sans saison renseignée est considéré disponible toute l'année. */
export function isInSeason(ingredient: Pick<Ingredient, 'season_months'>, month: number): boolean {
  return !ingredient.season_months?.length || ingredient.season_months.includes(month);
}

/**
 * Part des ingrédients saisonniers de la recette qui sont de saison (0..1).
 * null si la recette n'a aucun ingrédient saisonnier (pâtes, riz…).
 */
export function recipeSeasonality(recipe: Recipe, catalog: Map<string, Ingredient>, month: number): number | null {
  let seasonal = 0;
  let inSeason = 0;
  for (const line of recipe.ingredients) {
    const ing = line.ingredient_id ? catalog.get(line.ingredient_id) : undefined;
    if (!ing?.season_months?.length) continue;
    seasonal++;
    if (ing.season_months.includes(month)) inSeason++;
  }
  return seasonal ? inSeason / seasonal : null;
}

/** "mars → juin", "toute l'année". Gère les saisons à cheval sur l'année (nov → fév). */
export function formatSeason(months: number[]): string {
  if (!months.length || months.length === 12) return "toute l'année";
  const set = new Set(months);
  // Trouve un début : un mois présent dont le précédent est absent
  const start = months.find((m) => !set.has(m === 1 ? 12 : m - 1));
  if (start == null) return "toute l'année";
  const ranges: string[] = [];
  let m = start;
  for (let i = 0; i < 12; i++) {
    if (set.has(m) && !set.has(m === 1 ? 12 : m - 1)) {
      let end = m;
      while (set.has(end === 12 ? 1 : end + 1) && (end === 12 ? 1 : end + 1) !== m) end = end === 12 ? 1 : end + 1;
      ranges.push(end === m ? MONTHS_FR[m - 1]! : `${MONTHS_FR[m - 1]} → ${MONTHS_FR[end - 1]}`);
    }
    m = m === 12 ? 1 : m + 1;
  }
  return ranges.join(', ');
}
