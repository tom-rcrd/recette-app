import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Une clé secrète (sb_secret_… / service_role) contourne toutes les règles d'accès :
// elle ne doit jamais se retrouver dans l'app. On refuse de l'utiliser.
function jwtRole(key: string): string | null {
  try {
    const payload = key.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(payload)) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}
const isSecretKey = rawKey.startsWith('sb_secret_') || (rawKey.startsWith('eyJ') && jwtRole(rawKey) === 'service_role');
const anonKey = isSecretKey ? '' : rawKey;

export const configError = !url || !rawKey
  ? "Supabase n'est pas configuré : copie apps/mobile/.env.example en .env et renseigne l'URL et la clé publique."
  : isSecretKey
    ? "La clé renseignée est la clé SECRÈTE (sb_secret_…). Mets la clé publique (sb_publishable_… ou anon) dans apps/mobile/.env."
    : null;
export const isConfigured = configError === null;

export const supabase = createClient(url || 'http://localhost', anonKey || 'missing', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
