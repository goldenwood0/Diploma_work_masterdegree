import { z } from 'zod';
import type { TutorEnvelope, TutorProvider } from './tutor-provider.js';

// Local model served by Ollama (https://ollama.com) on this computer: no API key,
// no per-request charge, lesson data never leaves the machine.
export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b';

const responseSchema = z.object({
  done: z.literal(true),
  // "length" means the answer was cut at the token limit: treat it as incomplete.
  done_reason: z.literal('stop').optional(),
  message: z.object({ role: z.literal('assistant'), content: z.string().max(6000) }),
  prompt_eval_count: z.number().int().nonnegative().optional(),
  eval_count: z.number().int().nonnegative().max(1200).optional(),
});

// Only loopback hosts: the tutor must not forward lesson data or learner text to another machine.
export function localOllamaUrl(value: string | undefined) {
  const url = new URL(value || DEFAULT_OLLAMA_URL);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash)
    throw new Error('ZHPATH_OLLAMA_URL must be a local http address such as http://127.0.0.1:11434');
  return url.origin;
}

const languageNames: Record<string, string> = { ru: 'Russian', kk: 'Kazakh', en: 'English' };

// Small local models ignore the bare language code in the data, so name the language explicitly.
export function languageReminder(code: string) {
  const name = languageNames[code] ?? 'English';
  return `Write the whole answer in ${name}. Use Chinese characters only for the Chinese words, phrases and examples themselves, always with pinyin.`;
}

export class OllamaTutorProvider implements TutorProvider {
  readonly kind = 'live' as const;
  // A local model may need to load into GPU memory first; generation is slower than a hosted API.
  readonly timeoutMs = 90000;
  constructor(private baseUrl: string, private model: string, private transport: typeof fetch = fetch) {}
  async generate(input: TutorEnvelope, signal: AbortSignal) {
    const body = JSON.stringify({
      model: this.model, stream: false, keep_alive: '30m',
      messages: [{ role: 'system', content: `${input.system}
${languageReminder(input.data.language)}` }, { role: 'user', content: JSON.stringify(input.data) }],
      options: { num_predict: input.maxOutputTokens, temperature: 0.3 },
    });
    if (Buffer.byteLength(body, 'utf8') > 70000 || signal.aborted) throw new Error('Input unavailable');
    const response = await this.transport(`${this.baseUrl}/api/chat`, {
      method: 'POST', redirect: 'error', signal, headers: { 'Content-Type': 'application/json' }, body,
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('Provider unavailable'); }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty response');
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 64000) throw new Error('Response too large');
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel(); reader.releaseLock(); }
    const parsed = responseSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    const text = parsed.message.content.trim();
    if (!text) throw new Error('Invalid response');
    const usage = parsed.prompt_eval_count !== undefined && parsed.eval_count !== undefined
      ? { usage: { inputTokens: parsed.prompt_eval_count, outputTokens: parsed.eval_count } } : {};
    return { text, ...usage };
  }
}
