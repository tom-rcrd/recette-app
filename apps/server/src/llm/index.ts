// Fournisseurs LLM interchangeables pour l'extraction de recettes.
// Chacun reçoit un prompt texte (+ image optionnelle) et renvoie du JSON brut.

export interface LlmInput {
  prompt: string;
  image?: { base64: string; mimeType: string };
}

export interface LlmProvider {
  name: string;
  complete(input: LlmInput): Promise<string>;
}

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

const gemini: LlmProvider = {
  name: 'gemini',
  async complete({ prompt, image }) {
    const model = env('GEMINI_MODEL', 'gemini-2.5-flash');
    const parts: unknown[] = [{ text: prompt }];
    if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } },
      { 'x-goog-api-key': env('GEMINI_API_KEY') },
    );
    return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  },
};

const ollama: LlmProvider = {
  name: 'ollama',
  async complete({ prompt, image }) {
    const data = await postJson(`${env('OLLAMA_HOST', 'http://localhost:11434')}/api/chat`, {
      model: env('OLLAMA_MODEL', 'qwen2.5vl:7b'),
      stream: false,
      format: 'json',
      options: { temperature: 0.1 },
      messages: [{ role: 'user', content: prompt, ...(image ? { images: [image.base64] } : {}) }],
    });
    return data.message?.content ?? '';
  },
};

const openaiCompatible: LlmProvider = {
  name: 'openai',
  async complete({ prompt, image }) {
    const content: unknown[] = [{ type: 'text', text: prompt }];
    if (image) content.push({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } });
    const data = await postJson(
      `${env('OPENAI_BASE_URL')}/chat/completions`,
      {
        model: env('OPENAI_MODEL'),
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content }],
      },
      { authorization: `Bearer ${env('OPENAI_API_KEY')}` },
    );
    return data.choices?.[0]?.message?.content ?? '';
  },
};

const PROVIDERS: Record<string, LlmProvider> = { gemini, ollama, openai: openaiCompatible };

export function getProvider(): LlmProvider {
  const name = process.env.LLM_PROVIDER ?? 'gemini';
  const p = PROVIDERS[name];
  if (!p) throw new Error(`LLM_PROVIDER inconnu : ${name} (gemini | ollama | openai)`);
  return p;
}
