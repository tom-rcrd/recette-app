import type { Ingredient } from './types';
import { formatAdditive, ORGANIC_LABELS } from './openFoodFacts';

/**
 * Critères personnels du foyer pour noter les produits du commerce.
 * Stockés dans households.score_criteria ; modifiables dans « Mes critères ».
 */
export interface ScoreCriteria {
  /** Importance relative de chaque volet (0 = ignoré) */
  weights: { nutrition: number; processing: number; additives: number; organic: number };
  /** Plafonne la note si le produit contient de l'huile de palme */
  avoidPalmOil: boolean;
  /** Note à 0 si le produit contient l'un de ces allergènes */
  avoidAllergens: string[];
  /** Additifs qu'on veut éviter (tags OFF, ex. "en:e250") : pénalité forte */
  avoidAdditives: string[];
  /** Seuils personnels pour 100 g (null = pas de seuil) */
  maxSugars100g: number | null;
  maxSalt100g: number | null;
  /** Pénalise les produits non végétariens */
  vegetarianOnly: boolean;
}

export const DEFAULT_CRITERIA: ScoreCriteria = {
  weights: { nutrition: 50, processing: 25, additives: 15, organic: 10 },
  avoidPalmOil: false,
  avoidAllergens: [],
  avoidAdditives: [],
  maxSugars100g: null,
  maxSalt100g: null,
  vegetarianOnly: false,
};

/** Complète des critères partiels (enregistrés avant l'ajout d'un nouveau critère, par ex.). */
export function withDefaultCriteria(c: Partial<ScoreCriteria> | null | undefined): ScoreCriteria {
  return { ...DEFAULT_CRITERIA, ...(c ?? {}), weights: { ...DEFAULT_CRITERIA.weights, ...(c?.weights ?? {}) } };
}

export type ScoreLabel = 'excellent' | 'bon' | 'moyen' | 'mauvais';

export interface ProductScore {
  score: number; // 0..100
  label: ScoreLabel;
  /** Sous-notes 0..100 (null = donnée absente, volet ignoré) */
  parts: { nutrition: number | null; processing: number | null; additives: number | null; organic: number | null };
  /** Explications lisibles, de la plus importante à la moins importante */
  reasons: string[];
}

const NUTRISCORE_POINTS: Record<string, number> = { a: 100, b: 75, c: 50, d: 25, e: 0 };
const NOVA_POINTS: Record<number, number> = { 1: 100, 2: 80, 3: 50, 4: 15 };

export const scoreLabel = (s: number): ScoreLabel => (s >= 75 ? 'excellent' : s >= 50 ? 'bon' : s >= 25 ? 'moyen' : 'mauvais');

/**
 * Note personnelle d'un produit du commerce (0..100).
 * Combine Nutri-Score, transformation (NOVA), additifs et bio selon les poids choisis,
 * puis applique les critères éliminatoires du foyer. Renvoie null sans données exploitables
 * (ex. produits de base saisis à la main).
 */
export function scoreProduct(ing: Ingredient, criteria: ScoreCriteria = DEFAULT_CRITERIA): ProductScore | null {
  const hasData = ing.nutriscore_grade != null || ing.nova_group != null || !!ing.barcode;
  if (!hasData) return null;

  const additives = ing.additives ?? [];
  const avoided = additives.filter((a) => criteria.avoidAdditives.includes(a));
  const parts: ProductScore['parts'] = {
    nutrition: ing.nutriscore_grade ? NUTRISCORE_POINTS[ing.nutriscore_grade] ?? null : null,
    processing: ing.nova_group ? NOVA_POINTS[ing.nova_group] ?? null : null,
    // Liste d'additifs connue seulement si le produit vient d'Open Food Facts
    additives: ing.barcode ? Math.max(0, 100 - additives.length * 15 - avoided.length * 35) : null,
    organic: ing.barcode ? ((ing.labels ?? []).some((l) => ORGANIC_LABELS.includes(l)) ? 100 : 0) : null,
  };

  let total = 0;
  let weight = 0;
  for (const k of Object.keys(parts) as (keyof ProductScore['parts'])[]) {
    const p = parts[k];
    const w = criteria.weights[k];
    if (p == null || w <= 0) continue;
    total += p * w;
    weight += w;
  }
  if (weight === 0) return null;
  let score = total / weight;

  const reasons: string[] = [];
  if (parts.nutrition != null) reasons.push(`Nutri-Score ${ing.nutriscore_grade!.toUpperCase()}`);
  if (parts.processing != null) {
    reasons.push(['', 'Non transformé', 'Ingrédient culinaire', 'Transformé', 'Ultra-transformé'][ing.nova_group!] + ` (NOVA ${ing.nova_group})`);
  }
  if (ing.barcode) reasons.push(additives.length ? `${additives.length} additif${additives.length > 1 ? 's' : ''}` : 'Sans additif');
  if (parts.organic === 100) reasons.push('Bio');

  // Critères personnels : pénalités et éliminatoires
  if (avoided.length) reasons.unshift(`Contient ${avoided.map(formatAdditive).join(', ')} (à éviter)`);
  if (criteria.maxSugars100g != null && (ing.sugars_g ?? 0) > criteria.maxSugars100g) {
    score -= 20;
    reasons.unshift(`Sucres ${ing.sugars_g} g/100 g > ton seuil de ${criteria.maxSugars100g} g`);
  }
  if (criteria.maxSalt100g != null && (ing.salt_g ?? 0) > criteria.maxSalt100g) {
    score -= 20;
    reasons.unshift(`Sel ${ing.salt_g} g/100 g > ton seuil de ${criteria.maxSalt100g} g`);
  }
  if (criteria.avoidPalmOil && (ing.analysis_tags ?? []).includes('en:palm-oil')) {
    score = Math.min(score, 25);
    reasons.unshift('Contient de l’huile de palme');
  }
  if (criteria.vegetarianOnly && !ing.is_vegetarian && !ing.is_vegan) {
    score = Math.min(score, 25);
    reasons.unshift('Non végétarien');
  }
  const blocked = (ing.allergens ?? []).filter((a) => criteria.avoidAllergens.includes(a));
  if (blocked.length) {
    score = 0;
    reasons.unshift(`Contient ${blocked.join(', ').replace(/_/g, ' ')}`);
  }

  score = Math.round(Math.max(0, Math.min(100, score)));
  return { score, label: scoreLabel(score), parts, reasons };
}
