import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { resolveDraftIngredients, type Ingredient, type RecipeDraft } from '@recette/core';
import { extractFromJsonLd, extractWithLlm, htmlToText } from './extract';
import { detectSource, fetchHtml, fetchSocialContent } from './sources';
import { getProvider } from './llm/index';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const jwtRole = (key: string) => {
  try { return JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role as string | undefined; } catch { return undefined; }
};
if (SUPABASE_ANON_KEY.startsWith('sb_secret_') || jwtRole(SUPABASE_ANON_KEY) === 'service_role') {
  // La clé secrète contourne la RLS : chaque import verrait les ingrédients de tous les foyers
  console.error('SUPABASE_ANON_KEY contient la clé SECRÈTE. Mets la clé publique (sb_publishable_… ou anon) dans apps/server/.env.');
  process.exit(1);
}

type Env = { Variables: { catalog: Ingredient[] } };
const app = new Hono<Env>();

app.use('/api/*', cors());

app.get('/api/health', (c) => c.json({ ok: true, llm: process.env.LLM_PROVIDER ?? 'gemini' }));

// Authentification : on réutilise le jeton Supabase de l'utilisateur, la RLS fait le reste.
app.use('/api/import/*', async (c, next) => {
  const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return c.json({ error: 'Non connecté' }, 401);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: user, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user.user) return c.json({ error: 'Session invalide' }, 401);
  const { data, error } = await supabase.from('ingredients').select('*');
  if (error) return c.json({ error: error.message }, 500);
  c.set('catalog', data as Ingredient[]);
  await next();
});

function finish(draft: RecipeDraft | null, catalog: Ingredient[]) {
  if (!draft) return { draft: null, error: 'Aucune recette trouvée dans ce contenu.' };
  return { draft: resolveDraftIngredients(draft, catalog) };
}

/** Coller une URL : site de recettes, YouTube, Instagram, TikTok. */
app.post('/api/import/url', async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  const catalog = c.get('catalog');
  const known = catalog.map((i) => i.name);
  try {
    const source = detectSource(url);

    if (source === 'url') {
      const html = await fetchHtml(url);
      // 1. Données structurées : gratuit, instantané, fiable
      const structured = extractFromJsonLd(html, url);
      if (structured && structured.ingredients.length) return c.json({ ...finish(structured, catalog), method: 'schema.org' });
      // 2. Sinon : texte de la page → LLM
      const draft = await extractWithLlm({ text: htmlToText(html), knownIngredients: known, source_type: 'url', source_url: url });
      return c.json({ ...finish(draft, catalog), method: getProvider().name });
    }

    const social = await fetchSocialContent(url, source);
    if (!social.text.trim()) {
      return c.json({
        draft: null,
        needsText: true,
        error: "Impossible de lire la légende de cette publication. Copie-colle le texte de la description pour l'importer.",
      });
    }
    const draft = await extractWithLlm({
      text: [social.title, social.text].filter(Boolean).join('\n\n'),
      knownIngredients: known, source_type: source, source_url: url,
    });
    if (draft && !draft.image_url) draft.image_url = social.image_url;
    return c.json({ ...finish(draft, catalog), method: getProvider().name });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

/** Texte collé (légende Instagram, message, note…). */
app.post('/api/import/text', async (c) => {
  const { text, source_url } = await c.req.json<{ text: string; source_url?: string }>();
  const catalog = c.get('catalog');
  try {
    const draft = await extractWithLlm({ text, knownIngredients: catalog.map((i) => i.name), source_type: 'text', source_url });
    return c.json({ ...finish(draft, catalog), method: getProvider().name });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

/** Photo d'une page de livre ou d'une fiche manuscrite. */
app.post('/api/import/image', async (c) => {
  const { base64, mimeType } = await c.req.json<{ base64: string; mimeType?: string }>();
  const catalog = c.get('catalog');
  try {
    const draft = await extractWithLlm({
      image: { base64, mimeType: mimeType ?? 'image/jpeg' },
      knownIngredients: catalog.map((i) => i.name), source_type: 'photo',
    });
    return c.json({ ...finish(draft, catalog), method: getProvider().name });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

// Version web de l'app (pour ajouter des recettes depuis le PC)
const webDist = resolve(process.env.WEB_DIST ?? '../mobile/dist');
if (existsSync(webDist)) {
  // serveStatic attend un chemin relatif au dossier courant
  app.use('/*', serveStatic({ root: relative(process.cwd(), webDist) }));
  const index = readFileSync(resolve(webDist, 'index.html'), 'utf8');
  app.get('*', (c) => c.html(index));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`Recette server → http://0.0.0.0:${port}  (LLM : ${process.env.LLM_PROVIDER ?? 'gemini'}, web : ${existsSync(webDist) ? webDist : 'non construit'})`);
});
