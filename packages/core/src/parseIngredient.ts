import { normalizeUnit } from './units';

export interface ParsedIngredientLine {
  raw: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  note: string | null;
}

const UNICODE_FRACTIONS: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

// Unités en plusieurs mots à reconnaître avant la tokenisation
const MULTIWORD_UNITS: [RegExp, string][] = [
  [/^c(?:uill[eè]res?)?\.?\s*(?:à|a)\s*s(?:oupe)?\.?/i, 'cas'],
  [/^c(?:uill[eè]res?)?\.?\s*(?:à|a)\s*c(?:af[eé])?\.?/i, 'cac'],
  [/^cuill[eè]res?\s+(?:à|a)\s+soupe/i, 'cas'],
  [/^cuill[eè]res?\s+(?:à|a)\s+caf[eé]/i, 'cac'],
];

function parseNumber(token: string): number | null {
  const t = token.replace(',', '.');
  if (UNICODE_FRACTIONS[t] != null) return UNICODE_FRACTIONS[t];
  const mixed = t.match(/^(\d+)([¼½¾⅓⅔])$/);
  if (mixed) return Number(mixed[1]) + (UNICODE_FRACTIONS[mixed[2]!] ?? 0);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const range = t.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2; // "2-3" → 2.5
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Découpe une ligne d'ingrédient libre ("200 g de farine T55", "2 gousses d'ail hachées",
 * "1 c. à soupe d'huile d'olive") en quantité / unité / nom / note.
 * Sert à l'import sans LLM (données schema.org) et en garde-fou après le LLM.
 */
export function parseIngredientLine(line: string): ParsedIngredientLine {
  const raw = line.trim();
  let rest = raw.replace(/^[-•*]\s*/, '');

  // Quantité (avec "1 1/2" possible)
  let quantity: number | null = null;
  const qMatch = rest.match(/^(\d+\/\d+|\d+(?:[.,]\d+)?-\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?(?:[¼½¾⅓⅔])?|[¼½¾⅓⅔])\s*/);
  if (qMatch) {
    quantity = parseNumber(qMatch[1]!);
    rest = rest.slice(qMatch[0].length);
    const second = rest.match(/^(\d+\/\d+)\s*/);
    if (second && quantity != null) {
      quantity += parseNumber(second[1]!) ?? 0;
      rest = rest.slice(second[0].length);
    }
  }

  // Unité
  let unit: string | null = null;
  for (const [re, u] of MULTIWORD_UNITS) {
    const m = rest.match(re);
    if (m) { unit = u; rest = rest.slice(m[0].length).trimStart(); break; }
  }
  if (!unit) {
    const word = rest.match(/^([^\s]+)\s*/);
    // "g", "kg" peuvent être collés au nombre : "200g"
    const candidate = word?.[1];
    if (candidate) {
      const u = normalizeUnit(candidate);
      if (u) { unit = u; rest = rest.slice(word![0].length); }
    }
  }
  if (!unit && quantity != null) {
    const glued = raw.match(/^\s*[\d.,]+\s*(g|kg|ml|cl|l|mg)\b/i);
    if (glued) unit = normalizeUnit(glued[1]!);
  }

  // "de", "d'", "of"
  rest = rest.replace(/^(?:de\s+|d['’]\s*|des\s+|du\s+|of\s+)/i, '').trim();

  // Note : après une virgule ou entre parenthèses
  let note: string | null = null;
  const paren = rest.match(/\(([^)]*)\)/);
  if (paren) {
    note = paren[1]!.trim();
    rest = rest.replace(paren[0], '').trim();
  }
  const comma = rest.indexOf(',');
  if (comma > 0) {
    const after = rest.slice(comma + 1).trim();
    note = note ? `${note}, ${after}` : after;
    rest = rest.slice(0, comma).trim();
  }

  return { raw, quantity, unit, name: rest.replace(/\s+/g, ' '), note: note || null };
}
