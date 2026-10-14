import { useColorScheme } from 'react-native';

const light = {
  bg: '#FBF8F3',
  card: '#FFFFFF',
  text: '#2B2620',
  muted: '#7A7066',
  border: '#E8E1D6',
  accent: '#C8553D',
  accentSoft: '#F6E3DC',
  green: '#4F7A4A',
  greenSoft: '#E3EEDF',
  amber: '#B7791F',
  amberSoft: '#FBEFD9',
};

const dark: typeof light = {
  bg: '#1A1714',
  card: '#25211D',
  text: '#F2ECE4',
  muted: '#A69C90',
  border: '#3A342D',
  accent: '#E07A5F',
  accentSoft: '#3D2620',
  green: '#8DB585',
  greenSoft: '#24321F',
  amber: '#E3A64B',
  amberSoft: '#3A2D17',
};

export type Theme = typeof light;
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

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
