import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OllamaTutorProvider, languageReminder, localOllamaUrl } from './tutor-ollama.js';
import { createTutorProvider } from './tutor-openai.js';
import { tutorInstructions, type TutorEnvelope } from './tutor-provider.js';

const envelope: TutorEnvelope = { system: tutorInstructions, data: { level: 1, language: 'ru', mode: 'explain', material: '你好', errors: [], text: '', history: [] }, maxOutputTokens: 1200 };
const response = { model: 'qwen2.5:7b', done: true, done_reason: 'stop', message: { role: 'assistant', content: '你好 — здравствуйте.' }, prompt_eval_count: 100, eval_count: 20 };

test('Ollama transport contract: local /api/chat, system + data messages, token limit, no streaming', async () => {
  let called = 0;
  const transport: typeof fetch = async (url, options) => {
    called++; assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(options?.redirect, 'error'); assert.ok(options?.signal);
    assert.equal(new Headers(options?.headers).get('Authorization'), null);
    const body = JSON.parse(options?.body as string);
    assert.equal(body.model, 'qwen2.5:7b'); assert.equal(body.stream, false); assert.equal(body.options.num_predict, 1200);
    assert.equal(body.tools, undefined);
    assert.deepEqual(body.messages.map((m: { role: string }) => m.role), ['system', 'user']);
    assert.ok(body.messages[0].content.startsWith(tutorInstructions)); assert.match(body.messages[0].content, /whole answer in Russian/);
    assert.equal(JSON.parse(body.messages[1].content).material, '你好');
    return Response.json(response);
  };
  const provider = new OllamaTutorProvider('http://127.0.0.1:11434', 'qwen2.5:7b', transport);
  assert.equal(provider.kind, 'live'); assert.ok(provider.timeoutMs > 20000);
  assert.deepEqual(await provider.generate(envelope, new AbortController().signal), { text: '你好 — здравствуйте.', usage: { inputTokens: 100, outputTokens: 20 } });
  assert.equal(called, 1);
});

test('Ollama error, cut-off, tool call, empty/oversized text and oversized bytes fail safely', async () => {
  const bad = [
    () => new Response('PRIVATE_SERVER_ERROR', { status: 404 }),
    () => Response.json({ ...response, done: false }),
    () => Response.json({ ...response, done_reason: 'length' }),
    () => Response.json({ ...response, message: { role: 'tool', content: 'leak' } }),
    () => Response.json({ ...response, message: { role: 'assistant', content: '   ' } }),
    () => Response.json({ ...response, message: { role: 'assistant', content: 'x'.repeat(6001) } }),
    () => new Response('x'.repeat(64001)),
  ];
  for (const factory of bad) {
    const provider = new OllamaTutorProvider('http://127.0.0.1:11434', 'qwen2.5:7b', async () => factory());
    await assert.rejects(provider.generate(envelope, new AbortController().signal), e => !String(e).includes('PRIVATE_SERVER_ERROR'));
  }
});

test('pre-cancelled and oversized requests do not reach Ollama', async () => {
  let called = false;
  const provider = new OllamaTutorProvider('http://127.0.0.1:11434', 'qwen2.5:7b', async () => { called = true; return Response.json(response); });
  const c = new AbortController(); c.abort(); await assert.rejects(provider.generate(envelope, c.signal));
  await assert.rejects(provider.generate({ ...envelope, data: { ...envelope.data, material: '你'.repeat(70000) } }, new AbortController().signal));
  assert.equal(called, false);
});

test('Ollama address must stay on this computer', () => {
  assert.equal(localOllamaUrl(undefined), 'http://127.0.0.1:11434');
  assert.equal(localOllamaUrl('http://localhost:11434/'), 'http://localhost:11434');
  for (const bad of ['https://127.0.0.1:11434', 'http://192.168.1.5:11434', 'http://ollama.example.com', 'http://user:pw@127.0.0.1:11434', 'http://127.0.0.1.attacker.invalid'])
    assert.throws(() => localOllamaUrl(bad));
});

test('provider switch: Ollama needs only the explicit switch; OpenAI still needs a key', () => {
  const names = ['ZHPATH_TUTOR_ENABLED', 'ZHPATH_TUTOR_PROVIDER', 'ZHPATH_OLLAMA_URL', 'ZHPATH_OLLAMA_MODEL', 'OPENAI_API_KEY'] as const;
  const saved = Object.fromEntries(names.map(n => [n, process.env[n]]));
  try {
    for (const n of names) delete process.env[n];
    process.env.ZHPATH_TUTOR_PROVIDER = 'ollama';
    assert.equal(createTutorProvider().kind, 'unconfigured');
    process.env.ZHPATH_TUTOR_ENABLED = 'true';
    assert.ok(createTutorProvider() instanceof OllamaTutorProvider);
    process.env.ZHPATH_OLLAMA_URL = 'http://10.0.0.1:11434'; assert.equal(createTutorProvider().kind, 'unconfigured');
    delete process.env.ZHPATH_OLLAMA_URL;
    process.env.ZHPATH_TUTOR_PROVIDER = 'something-else'; assert.equal(createTutorProvider().kind, 'unconfigured');
    process.env.ZHPATH_TUTOR_PROVIDER = 'openai'; assert.equal(createTutorProvider().kind, 'unconfigured');
  } finally {
    for (const n of names) { if (saved[n] === undefined) delete process.env[n]; else process.env[n] = saved[n]; }
  }
});

test('language reminder names the explanation language, English for unknown codes', () => {
  assert.match(languageReminder('kk'), /Kazakh/); assert.match(languageReminder('en'), /English/); assert.match(languageReminder('xx'), /English/);
});
