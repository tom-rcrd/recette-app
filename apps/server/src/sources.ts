import type { SourceType } from '@recette/core';
import { htmlToText } from './extract';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

export function detectSource(url: string): SourceType {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'youtube';
  if (host.endsWith('instagram.com')) return 'instagram';
  if (host.endsWith('tiktok.com')) return 'tiktok';
  return 'url';
}

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Impossible de charger la page (${res.status})`);
  return res.text();
}

function meta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  return html.match(re)?.[1] ?? html.match(re2)?.[1] ?? null;
}

export interface SocialContent {
  text: string;
  title: string | null;
  image_url: string | null;
}

/**
 * Récupère le texte disponible d'une publication (légende, description).
 * Les recettes des vidéos sont presque toujours écrites dans la description/légende.
 * La transcription de l'audio n'est pas (encore) gérée.
 */
export async function fetchSocialContent(url: string, source: SourceType): Promise<SocialContent> {
  if (source === 'youtube') {
    const html = await fetchHtml(url);
    const desc = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
    const title = html.match(/"title":"((?:[^"\\]|\\.)*)"/)?.[1];
    const text = desc ? JSON.parse(`"${desc}"`) as string : meta(html, 'og:description') ?? '';
    return {
      text,
      title: title ? JSON.parse(`"${title}"`) : meta(html, 'og:title'),
      image_url: meta(html, 'og:image'),
    };
  }

  if (source === 'tiktok') {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15_000) });
    if (res.ok) {
      const data = await res.json() as { title?: string; thumbnail_url?: string };
      return { text: data.title ?? '', title: null, image_url: data.thumbnail_url ?? null };
    }
  }

  // Instagram (et repli TikTok) : balises Open Graph de la page publique.
  // Instagram bloque souvent les requêtes anonymes → l'app propose alors de coller la légende.
  const html = await fetchHtml(url);
  const og = meta(html, 'og:description') ?? meta(html, 'description');
  return {
    text: og ? htmlToText(og) : '',
    title: meta(html, 'og:title'),
    image_url: meta(html, 'og:image'),
  };
}
