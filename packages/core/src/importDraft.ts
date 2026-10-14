import type { Ingredient, MealType, SourceType } from './types';
import { CONFIDENT_MATCH, matchIngredient } from './matchIngredient';
import { parseIngredientLine } from './parseIngredient';
import { normalizeUnit } from './units';

/**
 * Brouillon de recette produit par l'import (schema.org, LLM, OCR…).
 * Il est toujours relu par l'utilisateur avant enregistrement.
 */
export interface RecipeDraft {
  title: string;
  description?: string | null;
  image_url?: string | null;
  servings?: number | null;
  prep_min?: number | null;
  cook_min?: number | null;
  rest_min?: number | null;
  meal_types?: MealType[];
  dish_type?: string | null;
  equipment?: string[];
  tags?: string[];
  ingredients: DraftIngredient[];
  steps: { text: string; timer_seconds?: number | null }[];
  source_type: SourceType;
  source_url?: string | null;
}

export interface DraftIngredient {
  raw_text: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note?: string | null;
  group_label?: string | null;
  optional?: boolean;
  /** Rempli par resolveDraftIngredients */
  match?: {
    ingredient_id: string | null;
    ingredient_name?: string;
    score: number;
    /** Autres candidats proposés à l'utilisateur */
    alternatives: { ingredient_id: string; name: string; score: number }[];
  };
}

/** Transforme des lignes brutes ("200 g de farine") en ingrédients de brouillon. */
export function draftIngredientsFromLines(lines: string[]): DraftIngredient[] {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const p = parseIngredientLine(line);
      return { raw_text: p.raw, name: p.name, quantity: p.quantity, unit: p.unit, note: p.note };
    });
}

/**
 * Relie chaque ingrédient du brouillon au catalogue du foyer.
 * Au-dessus du seuil de confiance → relié automatiquement ; sinon l'utilisateur
 * choisit parmi les alternatives ou crée un nouvel ingrédient.
 */
export function resolveDraftIngredients(draft: RecipeDraft, catalog: Ingredient[]): RecipeDraft {
  return {
    ...draft,
    ingredients: draft.ingredients.map((ing) => {
      const matches = matchIngredient(ing.name, catalog, 4);
      const best = matches[0];
      const confident = best && best.score >= CONFIDENT_MATCH;
      return {
        ...ing,
        unit: normalizeUnit(ing.unit) ?? ing.unit,
        match: {
          ingredient_id: confident ? best.ingredient.id : null,
          ingredient_name: confident ? best.ingredient.name : undefined,
          score: best?.score ?? 0,
          alternatives: matches.map((m) => ({ ingredient_id: m.ingredient.id, name: m.ingredient.name, score: m.score })),
        },
      };
    }),
  };
}

/** Durée ISO 8601 (schema.org : "PT1H15M") → minutes. */
export function isoDurationToMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!m) return null;
  const [, d, h, min, s] = m;
  return (Number(d ?? 0) * 1440) + (Number(h ?? 0) * 60) + Number(min ?? 0) + Math.round(Number(s ?? 0) / 60);
}

/** Repère une durée dans le texte d'une étape ("cuire 12 minutes") pour la minuterie. */
export function detectStepTimer(text: string): number | null {
  const m = normalizeForTimer(text).match(/(\d+(?:[.,]\d+)?)\s*(?:a\s*\d+\s*)?(h|heures?|min(?:ute)?s?|mn|sec(?:onde)?s?|s)\b/);
  if (!m) return null;
  const n = Number(m[1]!.replace(',', '.'));
  const u = m[2]!;
  if (u.startsWith('h')) return Math.round(n * 3600);
  if (u.startsWith('s')) return Math.round(n);
  return Math.round(n * 60);
}

function normalizeForTimer(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
