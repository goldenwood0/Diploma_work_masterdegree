import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { TutorBudget } from './tutor-budget.js';
import { unconfiguredProvider, type TutorEnvelope, type TutorProvider } from './tutor-provider.js';

const responseSchema = z.object({
  status: z.literal('completed'),
  output: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('message'), role: z.literal('assistant'), content: z.array(z.object({ type: z.literal('output_text'), text: z.string().max(6000) })).min(1).max(4) }),
    z.object({ type: z.literal('reasoning') }),
  ])).min(1).max(8),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative().max(1200) }).optional(),
});
export class OpenAiTutorProvider implements TutorProvider {
  readonly kind = 'live' as const;
  constructor(private key: string, private budget: Pick<TutorBudget, 'reserve'> & Partial<Pick<TutorBudget, 'record'>>, private transport: typeof fetch = fetch) {}
  async generate(input: TutorEnvelope, signal: AbortSignal) {
    const body = JSON.stringify({ model: 'gpt-6-luna', instructions: input.system,
      input: [{ role: 'user', content: JSON.stringify(input.data) }],
      store: false, tools: [], service_tier: 'default', reasoning: { effort: 'none' }, max_output_tokens: 1200,
    });
    if (Buffer.byteLength(body, 'utf8') > 70000 || signal.aborted) throw new Error('Input unavailable');
    await this.budget.reserve();
    if (signal.aborted) throw new Error('Cancelled');
    const response = await this.transport('https://api.openai.com/v1/responses', {
      method: 'POST', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' }, body,
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('Provider unavailable'); }
    // Bound bytes before JSON parsing; never log provider bodies or headers.
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
    const payload: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    // A refusal or incomplete answer can still consume billable tokens.
    // Persist valid provider usage before validating the educational output.
    const reported = z.object({ usage: z.object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
    }) }).safeParse(payload);
    if (reported.success) await this.budget.record?.({ inputTokens: reported.data.usage.input_tokens, outputTokens: reported.data.usage.output_tokens });
    const parsed = responseSchema.parse(payload);
    const text = parsed.output.flatMap(item => item.type === 'message' ? item.content.map(c => c.text) : []).join('\n');
    if (!text.trim() || text.length > 6000) throw new Error('Invalid response');
    return { text, ...(parsed.usage ? { usage: { inputTokens: parsed.usage.input_tokens, outputTokens: parsed.usage.output_tokens } } : {}) };
  }
}
export function createTutorProvider(): TutorProvider {
  // Fail closed until server-side activation is explicitly configured. Never VITE_*.
  if (!process.env.OPENAI_API_KEY || process.env.ZHPATH_TUTOR_ENABLED !== 'true') return unconfiguredProvider;
  return new OpenAiTutorProvider(process.env.OPENAI_API_KEY, new TutorBudget(resolve(fileURLToPath(new URL('../logs/tutor-budget.json', import.meta.url)))));
}
