import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OpenAiTutorProvider, createTutorProvider } from './tutor-openai.js';
import { TutorBudget, TutorBudgetError } from './tutor-budget.js';
import { tutorInstructions, type TutorEnvelope } from './tutor-provider.js';

const envelope: TutorEnvelope = { system: tutorInstructions, data: { level: 1, language: 'ru', mode: 'explain', material: '你好', errors: [], text: '', history: [] }, maxOutputTokens: 1200 };
const response = { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '你好 — здравствуйте.' }] }], usage: { input_tokens: 100, output_tokens: 20 } };
test('OpenAI transport contract: fixed endpoint/model, server key, no storage/tools, usage without fabricated cost', async () => {
  let reserved = 0; let called = 0;
  const transport: typeof fetch = async (url, options) => {
    called++; assert.equal(reserved, 1); assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer TEST-NOT-A-KEY');
    assert.equal(options?.redirect, 'error'); assert.ok(options?.signal);
    const body = JSON.parse(options?.body as string);
    assert.equal(body.model, 'gpt-6-luna'); assert.equal(body.store, false); assert.deepEqual(body.tools, []);
    assert.equal(body.instructions, tutorInstructions); assert.equal(body.max_output_tokens, 1200); assert.equal(body.service_tier, 'default');
    assert.equal(body.input.length, 1); assert.equal(body.input[0].role, 'user');
    return Response.json(response);
  };
  const provider = new OpenAiTutorProvider('TEST-NOT-A-KEY', { reserve: async () => { reserved++; } }, transport);
  const result = await provider.generate(envelope, new AbortController().signal);
  assert.equal(called, 1); assert.deepEqual(result, { text: '你好 — здравствуйте.', usage: { inputTokens: 100, outputTokens: 20 } });
});
test('OpenAI error, refusal, tool output, incomplete response, missing/oversized text and oversized bytes fail safely', async () => {
  const bad = [
    () => new Response('PRIVATE_SERVER_ERROR', { status: 401 }),
    () => Response.json({ ...response, status: 'incomplete' }),
    () => Response.json({ ...response, output: [{ type: 'function_call', name: 'leak' }] }),
    () => Response.json({ ...response, output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'no' }] }] }),
    () => Response.json({ ...response, output: [] }),
    () => Response.json({ ...response, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'x'.repeat(6001) }] }] }),
    () => new Response('x'.repeat(64001)),
  ];
  for (const factory of bad) {
    const provider = new OpenAiTutorProvider('TEST-NOT-A-KEY', { reserve: async () => {} }, async () => factory());
    await assert.rejects(provider.generate(envelope, new AbortController().signal), e => !String(e).includes('PRIVATE_SERVER_ERROR'));
  }
});
test('budget denial, pre-cancel and oversized request do not call transport', async () => {
  let called = false;
  const provider = new OpenAiTutorProvider('TEST-NOT-A-KEY', { reserve: async () => { throw new TutorBudgetError(); } }, async () => { called = true; return Response.json(response); });
  await assert.rejects(provider.generate(envelope, new AbortController().signal), TutorBudgetError);
  const c = new AbortController(); c.abort(); await assert.rejects(provider.generate(envelope, c.signal));
  await assert.rejects(provider.generate({ ...envelope, data: { ...envelope.data, material: '你'.repeat(70000) } }, new AbortController().signal));
  assert.equal(called, false);
});
test('provider usage survives refusal/incomplete output and is recorded once', async () => {
  for (const payload of [response, { ...response, status: 'incomplete' }, { ...response, output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'no' }] }] }]) {
    const records: unknown[] = [];
    const provider = new OpenAiTutorProvider('TEST-NOT-A-KEY', { reserve: async () => {}, record: async usage => { records.push(usage); } }, async () => Response.json(payload));
    if (payload === response) await provider.generate(envelope, new AbortController().signal);
    else await assert.rejects(provider.generate(envelope, new AbortController().signal));
    assert.deepEqual(records, [{ inputTokens: 100, outputTokens: 20 }]);
  }
});
test('budget survives new instances, stops at $5, fails closed on corruption/lock; only own temporary files removed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zhpath-s8-budget-')); const path = join(dir, 'budget.json');
  try {
    await new TutorBudget(path).reserve(); await new TutorBudget(path).reserve();
    assert.equal(JSON.parse(await readFile(path, 'utf8')).reservedCents, 4);
    await new TutorBudget(path).record({ inputTokens: 10, outputTokens: 2 });
    const usage = JSON.parse(await readFile(`${path}.usage.jsonl`, 'utf8'));
    assert.equal(usage.inputTokens, 10); assert.equal(usage.model, 'gpt-6-luna'); assert.equal(usage.cost, undefined);
    await writeFile(path, JSON.stringify({ version: 1, reservedCents: 498 }));
    await new TutorBudget(path).reserve();
    await assert.rejects(new TutorBudget(path).reserve(), TutorBudgetError);
    assert.equal(JSON.parse(await readFile(path, 'utf8')).reservedCents, 500);
    await writeFile(path, 'corrupt'); await assert.rejects(new TutorBudget(path).reserve(), TutorBudgetError);
    await writeFile(`${path}.lock`, 'test-owned'); await assert.rejects(new TutorBudget(path).reserve(), TutorBudgetError);
  } finally {
    for (const file of [path, `${path}.lock`, `${path}.next`, `${path}.usage.jsonl`]) await unlink(file).catch(e => { if (e.code !== 'ENOENT') throw e; });
    await rmdir(dir);
  }
});
test('live adapter cannot activate without BOTH server key and explicit switch', () => {
  const key = process.env.OPENAI_API_KEY, enabled = process.env.ZHPATH_TUTOR_ENABLED;
  try {
    delete process.env.OPENAI_API_KEY; process.env.ZHPATH_TUTOR_ENABLED = 'true'; assert.equal(createTutorProvider().kind, 'unconfigured');
    process.env.OPENAI_API_KEY = 'TEST-NOT-A-KEY'; delete process.env.ZHPATH_TUTOR_ENABLED; assert.equal(createTutorProvider().kind, 'unconfigured');
    process.env.ZHPATH_TUTOR_ENABLED = 'true'; assert.equal(createTutorProvider().kind, 'live');
  } finally {
    if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key;
    if (enabled === undefined) delete process.env.ZHPATH_TUTOR_ENABLED; else process.env.ZHPATH_TUTOR_ENABLED = enabled;
  }
});
