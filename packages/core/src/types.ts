// Types partagés, alignés sur supabase/migrations/0001_init.sql (snake_case conservé).

export type MealType = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'gouter' | 'snack';
export type DurationClass = 'rapide' | 'moyen' | 'long';
export type IngredientKind = 'base' | 'product';
export type SourceType = 'manual' | 'url' | 'instagram' | 'tiktok' | 'youtube' | 'photo' | 'text';
export type NoteKind = 'note' | 'improvement' | 'variant' | 'cook_feedback';

export interface Nutrition {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  sugars_g: number;
  fat_g: number;
  sat_fat_g: number;
  fiber_g: number;
  salt_g: number;
}

export interface Ingredient extends Partial<Record<keyof Nutrition, number | null>> {
  id: string;
  name: string;
  aliases: string[];
  kind: IngredientKind;
  category: string;
  brand?: string | null;
  season_months: number[];
  grams_per_piece?: number | null;
  density?: number | null;
  is_vegan: boolean;
  is_vegetarian: boolean;
  contains_lactose: boolean;
  contains_gluten: boolean;
  allergens: string[];
  price?: number | null;
  price_quantity?: number | null;
  price_unit?: string | null;
  pairs_with?: string[];
}

export interface RecipeIngredient {
  id?: string;
  ingredient_id: string | null;
  raw_text?: string | null;
  quantity: number | null;
  unit: string | null;
  note?: string | null;
  group_label?: string | null;
  optional: boolean;
  position: number;
}

export interface RecipeStep {
  id?: string;
  position: number;
  text: string;
  timer_seconds?: number | null;
  technique_id?: string | null;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  meal_types: MealType[];
  dish_type?: string | null;
  servings: number;
  prep_min: number;
  cook_min: number;
  rest_min: number;
  total_min?: number;
  duration_class?: DurationClass;
  equipment: string[];
  tags: string[];
  rating?: number | null;
  source_type?: SourceType | null;
  source_url?: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface PantryItem {
  id: string;
  ingredient_id: string;
  location: string;
  quantity: number | null;
  unit: string | null;
  expires_on: string | null; // YYYY-MM-DD
  is_staple: boolean;
}

export interface MealLogEntry {
  recipe_id: string | null;
  eaten_on: string; // YYYY-MM-DD
  meal_type?: MealType | null;
  servings?: number | null;
  cost?: number | null;
  saved_ingredient_ids?: string[];
}
