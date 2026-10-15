import { offProductToIngredient, offProductUrl, type OffIngredient, type OffProduct } from '@recette/core';
import { Platform } from 'react-native';

/**
 * Cherche un produit sur Open Food Facts (base ouverte, sans clé).
 * Appel direct depuis l'app : l'API autorise les requêtes du navigateur (CORS).
 * Renvoie null si le produit n'y est pas référencé.
 */
export async function lookupBarcode(barcode: string): Promise<OffIngredient | null> {
  const res = await fetch(offProductUrl(barcode), {
    // Open Food Facts demande d'identifier l'app ; les navigateurs interdisent de modifier User-Agent
    headers: Platform.OS === 'web' ? {} : { 'User-Agent': 'Recettes/0.1 (app perso)' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts indisponible (${res.status})`);
  const json = (await res.json()) as { status: number; product?: OffProduct };
  if (json.status !== 1 || !json.product) return null;
  return offProductToIngredient(json.product, barcode);
}

/** Code-barres alimentaire plausible (EAN-8, UPC-A, EAN-13, GTIN-14). */
export const isBarcode = (s: string) => /^\d{8}$|^\d{12,14}$/.test(s.trim());
