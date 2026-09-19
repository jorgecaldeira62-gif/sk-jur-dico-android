import { getSettings } from './settings';

function safeKey(k: string): string { return k.replace(/[^\x20-\x7E]/g, "").trim(); }

const GROQ_FALLBACK = [
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
  "llama3-8b-8192",
  "mixtral-8x7b-32768",
  "llama-3.3-70b-versatile",
];

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callAI(messages: ChatMessage[], extraSystem?: string): Promise<string> {
  const { apiKey, baseUrl, model } = getSettings();

  if (!apiKey) {
    throw new Error('Chave de API não configurada. Clique no ícone ⚙️ e adicione sua chave.');
  }

  const cleanKey = safeKey(apiKey);
  const base = baseUrl.replace(/\/$/, '');
  const isGroq = base.includes("groq.com");
  const modelsToTry = isGroq ? GROQ_FALLBACK : [model];

  const allMessages: ChatMessage[] = extraSystem
    ? [{ role: 'system', content: extraSystem }, ...messages]
    : messages;

  let lastErr = "";
  for (const m of modelsToTry) {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cleanKey}` },
      body: JSON.stringify({ model: m, messages: allMessages, max_tokens: 8000 }),
    });

    if (response.status === 403 || response.status === 404) {
      lastErr = `modelo ${m} bloqueado (${response.status})`;
      continue;
    }

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      throw new Error(`Erro da IA (${response.status}): ${err}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('A IA retornou uma resposta vazia.');
    return content;
  }

  throw new Error(`Nenhum modelo disponível. ${lastErr}`);
}

export const JURIDICO_SYSTEM = `Você é um assistente jurídico especializado no direito brasileiro.
Seja preciso, objetivo e use linguagem técnica adequada.
Quando não tiver certeza, diga claramente que não tem a informação e recomende consultar um advogado.
Não invente dados, jurisprudências, leis ou números de processos.`;

export const CAMPO_LIVRE_SYSTEM = `Você é um assistente inteligente e prestativo.
Responda sempre em português brasileiro, de forma clara e direta.`;
