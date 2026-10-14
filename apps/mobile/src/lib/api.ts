import type { RecipeDraft } from '@recette/core';
import { supabase } from './supabase';

// Sur la version web servie par le Pi, l'API est sur la même origine.
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? '';

export interface ImportResult {
  draft: RecipeDraft | null;
  error?: string;
  needsText?: boolean;
  method?: string;
}

async function post(path: string, body: unknown): Promise<ImportResult> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ImportResult;
  if (!res.ok && !json.error) json.error = `Erreur serveur (${res.status})`;
  return { ...json, draft: json.draft ?? null };
}

export const importFromUrl = (url: string) => post('/api/import/url', { url });
export const importFromText = (text: string, source_url?: string) => post('/api/import/text', { text, source_url });
export const importFromImage = (base64: string, mimeType?: string) => post('/api/import/image', { base64, mimeType });
