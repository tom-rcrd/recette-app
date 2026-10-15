import {
  detectStepTimer, draftIngredientsFromLines, normalizeUnit,
  type DraftIngredient, type MealType, type RecipeDraft, type SourceType,
} from '@recette/core';
import { getProvider, type LlmInput } from './llm/index';

const MEAL_TYPES: MealType[] = ['petit_dejeuner', 'dejeuner', 'diner', 'gouter', 'snack'];

function buildPrompt(knownIngredients: string[], content: string | null): string {
  return `Tu es un assistant qui extrait des recettes de cuisine. Extrais la recette du contenu fourni
${content ? '(texte ci-dessous)' : "(photo d'une page de livre ou d'une fiche manuscrite)"} et réponds UNIQUEMENT avec un objet JSON :

{
  "found": true,                       // false si le contenu ne contient pas de recette
  "title": "…",
  "description": "… (1 phrase, optionnel)",
  "servings": 4,
  "prep_min": 15, "cook_min": 30, "rest_min": 0,
  "meal_types": ["dejeuner", "diner"], // parmi : ${MEAL_TYPES.join(', ')}
  "dish_type": "plat",                 // entree | plat | accompagnement | dessert | sauce | boisson | pain
  "equipment": ["poele", "four"],      // four, poele, casserole, cocotte, wok, mixeur, robot, micro_ondes, airfryer…
  "tags": ["batch_cooking"],           // batch_cooking, une_seule_poele, sans_cuisson, plaisir (pizza, burger, dessert gourmand… si évident)
  "ingredients": [
    { "raw_text": "2 oignons émincés", "name": "oignon", "quantity": 2, "unit": null, "note": "émincés", "group_label": null, "optional": false }
  ],
  "steps": [ { "text": "…", "timer_seconds": 600 } ]
}

Règles :
- Écris en français ; traduis si la source est dans une autre langue.
- "name" = ingrédient seul, au singulier, sans quantité ni préparation.
- Si un ingrédient correspond à l'un des ingrédients déjà connus ci-dessous, utilise EXACTEMENT ce nom.
- Unités : g, kg, ml, cl, l, cas (cuillère à soupe), cac (cuillère à café), pincee, tasse, gousse, tranche, botte, sachet, boite ; null pour des pièces.
- Convertis les mesures américaines (cups, oz, lb) en g ou ml.
- "timer_seconds" uniquement si l'étape contient une durée d'attente ou de cuisson.
- N'invente rien : si une information est absente, mets null.

Ingrédients déjà connus : ${knownIngredients.slice(0, 400).join(', ') || '(aucun)'}
${content ? `\n--- CONTENU ---\n${content.slice(0, 20_000)}` : ''}`;
}

function parseJson(text: string): any {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Le modèle n'a pas renvoyé de JSON exploitable");
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

/** Valide et nettoie la sortie du LLM (on ne lui fait pas confiance aveuglément). */
function toDraft(raw: any, source_type: SourceType, source_url: string | null): RecipeDraft | null {
  if (!raw || raw.found === false || !raw.title) return null;
  const ingredients: DraftIngredient[] = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
    .filter((i: any) => i && (i.name || i.raw_text))
    .map((i: any) => ({
      raw_text: String(i.raw_text ?? i.name),
      name: String(i.name ?? i.raw_text),
      quantity: num(i.quantity),
      unit: i.unit ? normalizeUnit(String(i.unit)) ?? String(i.unit) : null,
      note: i.note ? String(i.note) : null,
      group_label: i.group_label ? String(i.group_label) : null,
      optional: Boolean(i.optional),
    }));
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .map((s: any) => (typeof s === 'string' ? { text: s } : s))
    .filter((s: any) => s?.text)
    .map((s: any) => ({ text: String(s.text), timer_seconds: num(s.timer_seconds) ?? detectStepTimer(String(s.text)) }));

  return {
    title: String(raw.title),
    description: raw.description ? String(raw.description) : null,
    servings: num(raw.servings),
    prep_min: num(raw.prep_min),
    cook_min: num(raw.cook_min),
    rest_min: num(raw.rest_min),
    meal_types: (Array.isArray(raw.meal_types) ? raw.meal_types : []).filter((m: string) => MEAL_TYPES.includes(m as MealType)),
    dish_type: raw.dish_type ? String(raw.dish_type) : null,
    equipment: Array.isArray(raw.equipment) ? raw.equipment.map(String) : [],
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    ingredients,
    steps,
    source_type,
    source_url,
  };
}

export async function extractWithLlm(opts: {
  text?: string;
  image?: LlmInput['image'];
  knownIngredients: string[];
  source_type: SourceType;
  source_url?: string | null;
}): Promise<RecipeDraft | null> {
  const provider = getProvider();
  const out = await provider.complete({ prompt: buildPrompt(opts.knownIngredients, opts.text ?? null), image: opts.image });
  return toDraft(parseJson(out), opts.source_type, opts.source_url ?? null);
}

// -----------------------------------------------------------------------------
// Extraction sans LLM : données structurées schema.org/Recipe (JSON-LD)
// Présentes sur la grande majorité des sites de recettes (Marmiton, 750g, blogs WordPress…)
// -----------------------------------------------------------------------------

function findRecipeNode(node: any): any {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipeNode(n); if (r) return r; }
    return null;
  }
  const type = node['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return node;
  return findRecipeNode(node['@graph']) ?? null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function flattenInstructions(ins: any, group?: string): { text: string }[] {
  if (!ins) return [];
  if (typeof ins === 'string') {
    return ins.split(/\n+|(?<=\.)\s+(?=\d+[.)]\s)/).map((t) => t.trim()).filter(Boolean).map((text) => ({ text }));
  }
  if (Array.isArray(ins)) return ins.flatMap((i) => flattenInstructions(i, group));
  if (ins['@type'] === 'HowToSection') return flattenInstructions(ins.itemListElement, ins.name);
  if (ins.text) return [{ text: String(ins.text) }];
  return [];
}

export function extractFromJsonLd(html: string, url: string): RecipeDraft | null {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, body] of scripts) {
    let data: any;
    try { data = JSON.parse(body!.trim()); } catch { continue; }
    const r = findRecipeNode(data);
    if (!r) continue;

    const minutes = (iso: unknown) => {
      if (typeof iso !== 'string') return null;
      const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
      return m ? Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : null;
    };
    const prep = minutes(r.prepTime);
    const cook = minutes(r.cookTime);
    const total = minutes(r.totalTime);
    const yieldRaw = Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield;
    const servings = yieldRaw != null ? Number(String(yieldRaw).match(/\d+/)?.[0]) || null : null;
    const image = Array.isArray(r.image) ? r.image[0] : r.image;

    return {
      title: decodeEntities(String(r.name ?? 'Recette')),
      description: r.description ? decodeEntities(String(r.description)) : null,
      image_url: typeof image === 'string' ? image : image?.url ?? null,
      servings,
      prep_min: prep,
      cook_min: cook ?? (total != null && prep != null ? Math.max(0, total - prep) : null),
      rest_min: null,
      ingredients: draftIngredientsFromLines((r.recipeIngredient ?? r.ingredients ?? []).map((l: string) => decodeEntities(String(l)))),
      steps: flattenInstructions(r.recipeInstructions).map((s) => {
        const text = decodeEntities(s.text.replace(/<[^>]+>/g, ''));
        return { text, timer_seconds: detectStepTimer(text) };
      }),
      source_type: 'url',
      source_url: url,
    };
  }
  return null;
}

/** Texte lisible d'une page HTML (pour le LLM quand il n'y a pas de JSON-LD). */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}
