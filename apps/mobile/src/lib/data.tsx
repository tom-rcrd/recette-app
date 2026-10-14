import {
  type Ingredient, type MealLogEntry, type MealType, type PantryItem, type Recipe, type RecipeDraft,
  estimateRecipeCost,
} from '@recette/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

interface Household { id: string; name: string; reference_meal_price: number }

interface DataState {
  loading: boolean;
  error: string | null;
  household: Household | null;
  ingredients: Ingredient[];
  catalog: Map<string, Ingredient>;
  recipes: Recipe[];
  pantry: PantryItem[];
  history: MealLogEntry[];
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataState | null>(null);

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>');
  return ctx;
}

export const today = () => new Date().toISOString().slice(0, 10);

function toRecipe(row: any): Recipe {
  return {
    ...row,
    servings: Number(row.servings),
    ingredients: [...(row.recipe_ingredients ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({ ...l, quantity: l.quantity == null ? null : Number(l.quantity) })),
    steps: [...(row.recipe_steps ?? [])].sort((a, b) => a.position - b.position),
  };
}

const numericKeys = ['kcal', 'protein_g', 'carbs_g', 'sugars_g', 'fat_g', 'sat_fat_g', 'fiber_g', 'salt_g',
  'grams_per_piece', 'density', 'price', 'price_quantity'] as const;
function toIngredient(row: any): Ingredient {
  const out = { ...row };
  // Postgres "numeric" arrive en chaîne via PostgREST
  for (const k of numericKeys) if (out[k] != null) out[k] = Number(out[k]);
  return out;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<DataState, 'refresh' | 'catalog'>>({
    loading: true, error: null, household: null, ingredients: [], recipes: [], pantry: [], history: [],
  });

  const refresh = useCallback(async () => {
    try {
      const [hh, ing, rec, pan, hist] = await Promise.all([
        supabase.from('households').select('id, name, reference_meal_price').limit(1).single(),
        supabase.from('ingredients').select('*').order('name'),
        supabase.from('recipes').select('*, recipe_ingredients(*), recipe_steps(*)').order('created_at', { ascending: false }),
        supabase.from('pantry_items').select('*'),
        supabase.from('meal_log').select('*').order('eaten_on', { ascending: false }).limit(1000),
      ]);
      const err = hh.error ?? ing.error ?? rec.error ?? pan.error ?? hist.error;
      if (err) throw err;
      setState({
        loading: false,
        error: null,
        household: { ...(hh.data as Household), reference_meal_price: Number(hh.data!.reference_meal_price) },
        ingredients: (ing.data ?? []).map(toIngredient),
        recipes: (rec.data ?? []).map(toRecipe),
        pantry: (pan.data ?? []).map((p: any) => ({ ...p, quantity: p.quantity == null ? null : Number(p.quantity) })),
        history: hist.data ?? [],
      });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo<DataState>(() => ({
    ...state,
    catalog: new Map(state.ingredients.map((i) => [i.id, i])),
    refresh,
  }), [state, refresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// -----------------------------------------------------------------------------
// Écritures
// -----------------------------------------------------------------------------

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

/** Choix de l'utilisateur pour chaque ingrédient du brouillon : relier à l'existant ou créer. */
export type IngredientDecision =
  | { kind: 'existing'; ingredient_id: string }
  | { kind: 'new'; name: string; category: string; ingredientKind: 'base' | 'product' }
  | { kind: 'skip' };

export async function saveDraft(
  householdId: string,
  draft: RecipeDraft,
  decisions: IngredientDecision[],
  meta: { meal_types: MealType[]; dish_type: string | null; equipment: string[]; tags: string[] },
): Promise<string> {
  // 1. Créer les nouveaux ingrédients du catalogue
  const ids: (string | null)[] = [];
  for (const d of decisions) {
    if (d.kind === 'existing') ids.push(d.ingredient_id);
    else if (d.kind === 'skip') ids.push(null);
    else {
      const row = check(await supabase.from('ingredients')
        .upsert({ household_id: householdId, name: d.name.trim(), category: d.category, kind: d.ingredientKind },
          { onConflict: 'household_id,name,brand' })
        .select('id').single());
      ids.push(row.id);
    }
  }

  // 2. La recette
  const recipe = check(await supabase.from('recipes').insert({
    household_id: householdId,
    title: draft.title,
    description: draft.description,
    image_url: draft.image_url,
    servings: draft.servings ?? 2,
    prep_min: draft.prep_min ?? 0,
    cook_min: draft.cook_min ?? 0,
    rest_min: draft.rest_min ?? 0,
    source_type: draft.source_type,
    source_url: draft.source_url,
    ...meta,
  }).select('id').single());

  // 3. Lignes d'ingrédients et étapes
  const lines = draft.ingredients.map((ing, position) => ({
    recipe_id: recipe.id,
    ingredient_id: ids[position] ?? null,
    raw_text: ing.raw_text,
    quantity: ing.quantity,
    unit: ing.unit,
    note: ing.note,
    group_label: ing.group_label,
    optional: ing.optional ?? false,
    position,
  }));
  if (lines.length) check(await supabase.from('recipe_ingredients').insert(lines));
  const steps = draft.steps.map((s, position) => ({ recipe_id: recipe.id, position, text: s.text, timer_seconds: s.timer_seconds }));
  if (steps.length) check(await supabase.from('recipe_steps').insert(steps));
  return recipe.id;
}

/** "J'ai cuisiné ça" : alimente l'anti-répétition et les statistiques. Retire du frigo ce qui allait périmer. */
export async function logMeal(
  householdId: string,
  recipe: Recipe,
  catalog: Map<string, Ingredient>,
  pantry: PantryItem[],
  opts: { meal_type?: MealType; servings?: number } = {},
) {
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const used = new Set(recipe.ingredients.map((l) => l.ingredient_id));
  const saved = pantry.filter((p) => used.has(p.ingredient_id) && p.expires_on && p.expires_on <= soon);
  const servings = opts.servings ?? recipe.servings;
  const cost = estimateRecipeCost(recipe, catalog);
  check(await supabase.from('meal_log').insert({
    household_id: householdId,
    recipe_id: recipe.id,
    eaten_on: today(),
    meal_type: opts.meal_type ?? null,
    servings,
    cost: cost.coverage >= 0.7 ? Math.round(cost.perServing * servings * 100) / 100 : null,
    saved_ingredient_ids: saved.map((p) => p.ingredient_id),
  }));
}

export async function addNote(recipeId: string, kind: 'note' | 'improvement' | 'variant' | 'cook_feedback', body: string) {
  check(await supabase.from('recipe_notes').insert({ recipe_id: recipeId, kind, body }));
}

export async function fetchNotes(recipeId: string) {
  return check(await supabase.from('recipe_notes').select('*').eq('recipe_id', recipeId).order('created_at', { ascending: false })) as
    { id: string; kind: string; body: string; created_at: string }[];
}

export async function upsertPantryItem(householdId: string, item: Partial<PantryItem> & { ingredient_id: string }) {
  check(await supabase.from('pantry_items').upsert({ household_id: householdId, location: 'frigo', ...item, updated_at: new Date().toISOString() }));
}

export async function deletePantryItem(id: string) {
  check(await supabase.from('pantry_items').delete().eq('id', id));
}

export async function saveIngredient(householdId: string, ing: Partial<Ingredient> & { name: string }) {
  const { id, ...rest } = ing;
  if (id) check(await supabase.from('ingredients').update(rest).eq('id', id));
  else check(await supabase.from('ingredients').insert({ household_id: householdId, ...rest }));
}

export async function setRating(recipeId: string, rating: number) {
  check(await supabase.from('recipes').update({ rating }).eq('id', recipeId));
}

export async function deleteRecipe(recipeId: string) {
  check(await supabase.from('recipes').delete().eq('id', recipeId));
}
