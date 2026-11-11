// Opt-in integration check. Uses existing schema; never migrates, seeds, sends mail or calls OpenAI.
// npm run server:build && node --env-file=.env scripts/test-tutor-postgres.mjs [--serve]
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import { Database } from '../dist-server/database.js';
import { AuthService } from '../dist-server/auth.service.js';
import { Mailer } from '../dist-server/mailer.js';
import { digest } from '../dist-server/passwords.js';
import { getConfig } from '../dist-server/config.js';
import { cookieName, OriginGuard, SessionGuard } from '../dist-server/security.js';
import { TutorService } from '../dist-server/tutor.service.js';
import { TutorController } from '../dist-server/tutor.controller.js';
import { TUTOR_PROVIDER } from '../dist-server/tutor-provider.js';
import { createApp } from '../dist-server/app.js';

const config = getConfig();
assert.notEqual(config.NODE_ENV, 'production', 'Local test only');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(config.DATABASE_URL).hostname), 'Local DB only');
assert.ok(!process.env.OPENAI_API_KEY && process.env.ZHPATH_TUTOR_ENABLED !== 'true', 'Run only with unconfigured real provider');
const db = new Database();
const recovery = process.argv.find(arg => arg.startsWith('--cleanup='))?.slice('--cleanup='.length);
if (recovery) assert.match(recovery, /^tutor-check-[a-f0-9-]{36}$/);
const run = recovery ?? `tutor-check-${randomUUID()}`;
const users = [0, 1, 2].map(i => `${run}-${i}`);
const slugs = ['fixture', 'draft', 'locked', 'other'].map(s => `${run}-${s}`);
const tokens = users.map(() => randomBytes(32).toString('hex'));
const calls = [];
let app, realApp, failed = false, cleaned = false;
const localized = text => ({ ru: text, kk: text, en: text });
const adapter = { kind: 'test', async generate(input, signal) {
  calls.push(input);
  if (input.data.text === 'FAIL_ONCE' && !failed) { failed = true; throw new Error('SIMULATED'); }
  if (['SLOW', 'TIMEOUT'].includes(input.data.text)) await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, input.data.text === 'SLOW' ? 10000 : 30000);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
  });
  return { text: `TEST ONLY / НЕ НАСТОЯЩИЙ ИИ — ${input.data.language} / ${input.data.mode}\n${input.data.material}\nNo methodological assessment.` };
} };
async function cleanup() {
  if (cleaned) return;
  await app?.close(); await realApp?.close();
  // Exact UUID-owned IDs only. Remove dependent attempts before their quizzes.
  await db.$transaction(async tx => {
    const owned = await tx.user.findMany({ where: { id: { in: users } }, select: { id: true, name: true, email: true } });
    for (const user of owned) {
      assert.equal(user.name, 'TEST ONLY');
      assert.equal(user.email, `${user.id}@example.invalid`);
    }
    const curriculum = await tx.curriculum.findUnique({ where: { id: run } });
    if (curriculum) assert.deepEqual(curriculum.title, localized('TEST ONLY'));
    const lessons = await tx.lesson.findMany({ where: { unitId: run }, select: { slug: true } });
    for (const lesson of lessons) assert.ok(slugs.includes(lesson.slug));
    await tx.user.deleteMany({ where: { id: { in: users } } });
    await tx.lesson.deleteMany({ where: { slug: slugs[2], unitId: run } });
    await tx.curriculum.deleteMany({ where: { id: run } });
  });
  assert.equal(await db.user.count({ where: { id: { in: users } } }), 0);
  assert.equal(await db.lesson.count({ where: { slug: { in: slugs } } }), 0);
  await db.$disconnect();
  cleaned = true;
  console.log('CLEANUP OK: exact temporary users/sessions/settings/progress/attempts/curriculum removed');
}
try {
  await db.$connect();
  console.log(`Temporary fixture ID (retain for interrupted cleanup): ${run}`);
  if (recovery) {
    await cleanup();
  } else {
  await db.$transaction(async tx => {
    await tx.curriculum.create({ data: { id: run, title: localized('TEST ONLY'), levels: { create: { id: run, number: 1, units: { create: { id: run, position: 1, title: localized('TEST ONLY') } } } } } });
    for (let i = 0; i < 4; i++) await tx.lesson.create({ data: {
      id: slugs[i], slug: slugs[i], unitId: run, position: i, published: i !== 1, revision: 2,
      title: localized('TEST ONLY'), draft: { secret: 'PRIVATE_DRAFT' },
      ...(i === 2 ? { prerequisiteId: slugs[0] } : {}),
      blocks: { create: [0, 1, 2].map(position => ({ position, kind: 'reading', content: { hanzi: `${i === 3 ? 'OTHER_LESSON' : 'BLOCK'}_${position}`, pinyin: 'nǐ hǎo', translation: localized('你好'), secret: 'PRIVATE_METADATA' } })) },
      ...(i === 0 ? { quiz: { create: { id: run, revision: 3, questions: [] } } } : {}),
    } });
    for (let i = 0; i < users.length; i++) await tx.user.create({ data: {
      id: users[i], email: `${users[i]}@example.invalid`, name: 'TEST ONLY', passwordHash: 'NO_LOGIN', emailVerifiedAt: new Date(),
      settings: { create: { explanationLanguage: ['kk', 'en', 'ru'][i], startLevel: i + 1 } },
      sessions: { create: { tokenHash: digest(tokens[i]), expiresAt: new Date(Date.now() + 3600000) } },
      lessonProgress: { create: { lessonId: slugs[0], revision: i === 2 ? 1 : 2, nextBlock: i === 1 ? 0 : 1, ...(i === 0 ? { completedAt: new Date() } : {}) } },
    } });
    for (const [userId, lessonRevision, quizRevision, topic] of [[users[0], 2, 3, 'greetings'], [users[1], 2, 3, 'courtesy'], [users[0], 1, 3, 'introductions'], [users[0], 2, 2, 'introductions']]) {
      await tx.quizAttempt.create({ data: { userId, quizId: run, requestId: randomUUID(), requestHash: 'TEST', lessonRevision, quizRevision, snapshot: {}, answers: { secret: 'PRIVATE_ANSWER' }, result: { items: [{ correct: false, value: 'PRIVATE_ANSWER', question: { kind: 'input', topic, skill: 'grammar', prompt: 'PRIVATE_PROMPT' } }] }, score: 0, total: 1, passed: false } });
    }
  });
  const request = (api, who, slug = slugs[0], extra = {}) => api.post('/api/tutor/ask')
    .set('Cookie', `${cookieName()}=${tokens[who]}`).set('Origin', config.APP_ORIGIN).set('X-ZhPath-Request', '1')
    .send({ lessonSlug: slug, mode: 'explain', ...extra });
  // Production app wiring and real DB-backed session, with its actual unconfigured provider.
  realApp = await createApp();
  let api = supertest(realApp.getHttpServer());
  await api.get('/api/tutor/status').expect(401);
  await api.get('/api/tutor/status').set('Cookie', `${cookieName()}=${tokens[0]}`).expect(200, { provider: 'unconfigured' });
  await request(api, 0).expect(503);
  await request(api, 0, slugs[1]).expect(404);
  await request(api, 1, slugs[2]).expect(403);
  await realApp.close(); realApp = undefined;
  console.log('PASS: production app + PostgreSQL + real sessions, unconfigured/draft/locked');

  class IntegrationModule {}
  Module({ controllers: [TutorController], providers: [TutorService, Database, AuthService, SessionGuard,
    { provide: Mailer, useValue: { send() { throw new Error('Mail forbidden in test'); } } },
    { provide: TUTOR_PROVIDER, useValue: adapter }, { provide: APP_GUARD, useClass: OriginGuard }] })(IntegrationModule);
  app = await NestFactory.create(IntegrationModule, { logger: false });
  app.use(cookieParser()); app.setGlobalPrefix('api');
  // Browser-only fixture endpoint: real temporary sessions, never imported by production app.
  app.use('/api/tutor-fixture', async (req, res, next) => {
    try {
      if (req.get('x-zhpath-request') !== '1' || !['ru', 'kk', 'en'].includes(req.query.language)) return res.sendStatus(400);
      const who = ['kk', 'en', 'ru'].indexOf(req.query.language);
      adapter.kind = req.query.state === 'unconfigured' ? 'unconfigured' : 'test'; failed = false;
      res.cookie(cookieName(), tokens[who], { httpOnly: true, sameSite: 'strict' }).json({ testOnly: true, lessonSlugs: slugs });
    } catch (error) { next(error); }
  });
  await app.init(); api = supertest(app.getHttpServer());
  await request(api, 0).expect(201); await request(api, 1).expect(201); await request(api, 2).expect(201);
  assert.deepEqual(calls.map(c => c.data.language), ['kk', 'en', 'ru']);
  assert.deepEqual(calls.map(c => c.data.level), [1, 2, 3]);
  assert.match(calls[0].data.material, /BLOCK_1/); assert.doesNotMatch(calls[0].data.material, /BLOCK_0|BLOCK_2/);
  assert.match(calls[1].data.material, /BLOCK_0/); assert.match(calls[2].data.material, /BLOCK_0/);
  assert.deepEqual(calls[0].data.errors, [{ kind: 'input', topic: 'greetings', skill: 'grammar' }]);
  assert.equal(calls[1].data.errors[0].topic, 'courtesy'); assert.deepEqual(calls[2].data.errors, []);
  assert.doesNotMatch(JSON.stringify(calls), /PRIVATE|example.invalid|NO_LOGIN|OTHER_LESSON/);
  const before = calls.length;
  await request(api, 0, slugs[1]).expect(404); await request(api, 1, slugs[2]).expect(403);
  await request(api, 0, 'missing').expect(404); await request(api, 0, slugs[0], { userId: users[1] }).expect(400);
  assert.equal(calls.length, before);
  await request(api, 0, slugs[2]).expect(201);
  await db.lesson.update({ where: { id: slugs[0] }, data: { revision: 3 } });
  await request(api, 0, slugs[2]).expect(403);
  await db.lesson.update({ where: { id: slugs[0] }, data: { revision: 2 } });
  await request(api, 1, slugs[3]).expect(201); assert.match(calls.at(-1).data.material, /OTHER_LESSON_0/);
  for (const mode of ['check', 'dialogue', 'practice']) await request(api, 2, slugs[0], { mode, text: '你好' }).expect(201);
  console.log('PASS: PostgreSQL isolation/settings/errors/current lesson/current block/revisions/prerequisite/4 modes; provider TEST ONLY');
  if (process.argv.includes('--serve')) {
    await app.listen(3001, '127.0.0.1');
    console.log('TEST ONLY PostgreSQL tutor harness ready on 3001');
    await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); process.stdin.once('data', resolve); });
  }
  }
} finally { await cleanup(); }
