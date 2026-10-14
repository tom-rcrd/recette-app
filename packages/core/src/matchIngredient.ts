import type { Ingredient } from './types';
import { normalizeText } from './units';

// Mots qui n'identifient pas l'ingrédient (préparation, qualificatifs)
const STOPWORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'et', 'en', 'pour',
  'frais', 'fraiche', 'fraiches', 'hache', 'hachee', 'hachees', 'haches', 'emince', 'emincee', 'emincees',
  'coupe', 'coupee', 'coupees', 'coupes', 'rape', 'rapee', 'rapees', 'cuit', 'cuite', 'cuits', 'cuites',
  'gros', 'grosse', 'petit', 'petite', 'petits', 'petites', 'moyen', 'moyenne', 'bio', 'environ',
  'en', 'des', 'morceaux', 'des', 'cubes', 'des', 'fines', 'fin', 'fine', 'tranches', 'lamelles',
]);

/** Tokens significatifs, au singulier (pluriels FR simples). */
export function ingredientTokens(name: string): string[] {
  return normalizeText(name)
    .replace(/[œ]/g, 'oe')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && /[sx]$/.test(t) ? t.slice(0, -1) : t));
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export interface IngredientMatch {
  ingredient: Ingredient;
  score: number; // 0..1
}

/**
 * Cherche dans le catalogue l'ingrédient correspondant à un nom libre
 * ("oignons jaunes émincés" → "Oignon"). Utilise le nom et les alias.
 * Renvoie les meilleurs candidats triés ; score ≥ 0.6 = correspondance fiable.
 */
export function matchIngredient(name: string, catalog: Ingredient[], limit = 3): IngredientMatch[] {
  const q = ingredientTokens(name);
  if (!q.length) return [];
  const qJoined = q.join(' ');

  const scored = catalog.map((ingredient) => {
    let best = 0;
    for (const candidate of [ingredient.name, ...(ingredient.aliases ?? [])]) {
      const c = ingredientTokens(candidate);
      if (!c.length) continue;
      const cJoined = c.join(' ');
      let s: number;
      if (cJoined === qJoined) s = 1;
      // Le nom du catalogue est entièrement contenu dans la requête : "ail" ⊂ "ail rose"
      else if (c.every((t) => q.includes(t))) s = 0.75 + 0.2 * (c.length / q.length);
      else s = jaccard(q, c);
      if (s > best) best = s;
    }
    return { ingredient, score: Math.min(best, 1) };
  });

  return scored
    .filter((m) => m.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const CONFIDENT_MATCH = 0.6;
