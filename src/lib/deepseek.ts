// DeepSeek client wrapper — uses DEEPSEEK_API_KEY from env
// Returns a textual completion (no streaming) for prompt generation tasks
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const API_KEY = process.env.DEEPSEEK_API_KEY || '';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chat(
  messages: ChatMessage[],
  opts: { model?: 'deepseek-chat' | 'deepseek-reasoner'; maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  if (!API_KEY) {
    // Local fallback for dev without a real key — return a deterministic stub
    const last = messages[messages.length - 1].content.slice(0, 200);
    return `[本地模拟回答] ${last}`;
  }
  const r = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: opts.model || 'deepseek-chat',
      messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`DeepSeek ${r.status}: ${t.slice(0, 200)}`);
  }
  const json = (await r.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0].message.content;
}

export async function jsonChat<T = unknown>(
  messages: ChatMessage[],
  opts: Parameters<typeof chat>[1] = {}
): Promise<T> {
  const txt = await chat(
    [
      ...messages,
      {
        role: 'system',
        content:
          '严格按 JSON 格式输出，不要 markdown 代码块，不要解释。输出的 JSON 必须可被 JSON.parse 直接解析。',
      },
    ],
    opts
  );
  // strip code fences if any
  const clean = txt
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(clean) as T;
}
