import { useColorScheme } from 'react-native';

// Direction artistique : crème et beige, brun profond, cartes douces très arrondies
const light = {
  bg: '#F4F1EA',          // fond crème
  card: '#FBFAF6',        // cartes claires
  surface: '#E9E5DC',     // blocs beige (mise en avant, sections)
  text: '#33261F',        // brun profond
  muted: '#8A8076',
  border: '#E2DDD2',
  accent: '#3B2B24',      // brun : boutons, pastilles, sélection
  accentSoft: '#E6DFD4',
  onAccent: '#FBF8F2',    // texte sur fond accent
  green: '#5B8A4E',
  greenSoft: '#E2EAD9',
  amber: '#A8742A',
  amberSoft: '#F1E6D2',
  danger: '#B5543C',      // alertes marquées, périmé
  dangerSoft: '#F3E0D8',
};

const dark: typeof light = {
  bg: '#1D1915',
  card: '#272220',
  surface: '#312B26',
  text: '#F1EBE2',
  muted: '#A79D92',
  border: '#3B342E',
  accent: '#EDE5D8',
  accentSoft: '#3A332D',
  onAccent: '#2A211C',
  green: '#93B987',
  greenSoft: '#263023',
  amber: '#E0AC5C',
  amberSoft: '#3A2F1C',
  danger: '#E38A70',
  dangerSoft: '#3D2620',
};

export type Theme = typeof light;
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Polices : serif pour les titres (Young Serif), sans-serif arrondie pour le texte (Outfit). */
export const FONTS = {
  serif: 'YoungSerif_400Regular',
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
} as const;

export const MEAL_TYPE_LABELS: Record<string, string> = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  gouter: 'Goûter',
  snack: 'Snack',
};

export const DURATION_LABELS: Record<string, string> = { rapide: 'Rapide', moyen: 'Moyen', long: 'Long' };

export const INGREDIENT_CATEGORIES: Record<string, string> = {
  legume: 'Légumes', fruit: 'Fruits', legumineuse: 'Légumineuses', feculent: 'Féculents',
  proteine: 'Protéines', laitier: 'Produits laitiers', boulangerie: 'Boulangerie', epice: 'Épices',
  huile: 'Huiles', condiment: 'Condiments', extra: 'Extras', boisson: 'Boissons', autre: 'Autre',
};

export const PANTRY_LOCATIONS: Record<string, string> = {
  frigo: 'Frigo', congelateur: 'Congélateur', placard: 'Placard', epices: 'Étagère à épices',
  huiles: 'Huiles & vinaigres', extras: 'Extras',
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  four: 'Four', poele: 'Poêle', casserole: 'Casserole', cocotte: 'Cocotte', wok: 'Wok', mixeur: 'Mixeur',
  robot: 'Robot', micro_ondes: 'Micro-ondes', airfryer: 'Airfryer', sauteuse: 'Sauteuse',
};
