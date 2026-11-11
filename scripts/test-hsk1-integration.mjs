// Only invoked by the isolated runner. No production import or publication mode.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import supertest from 'supertest';
import { createApp } from '../dist-server/app.js';
import { Database } from '../dist-server/database.js';
import { hashPassword } from '../dist-server/passwords.js';
import { draftSchema } from '../dist-server/content.schema.js';
import { wavDuration } from '../dist-server/media.schema.js';

assert.match(new URL(process.env.DATABASE_URL).searchParams.get('schema'), /^hsk1_transfer_[a-f0-9]{32}$/);
assert.equal(process.env.ZHPATH_TUTOR_ENABLED, 'false');
assert.equal(process.env.REMINDERS_ENABLED, 'false');
const plan = JSON.parse(await readFile('docs/hsk1-audit/integration-plan.json', 'utf8'));
const source = JSON.parse(await readFile('docs/hsk1-audit/content-snapshot.json', 'utf8')).lessons;
const app = await createApp();
const db = app.get(Database);
const api = supertest(app.getHttpServer());
const title = { ru: 'Пилот — изолированная проверка', kk: 'Пилот', en: 'Isolated pilot' };
const id = `transfer-${randomUUID()}`;
const credentials = {};
const cookies = {};
const request = (role, method, path) => api[method](`/api/${path}`).set('Cookie', cookies[role] ?? '').set('Origin', process.env.APP_ORIGIN).set('X-ZhPath-Request', '1');
const check = text => console.log(`PASS ${text}`);
try {
  await db.curriculum.create({ data: { id, title, levels: { create: { id, number: 1, units: { create: { id, title, position: 0 } } } } } });
  let previous = null;
  const lessons = [];
  for (const [position, item] of source.entries()) {
    const lesson = await db.lesson.create({ data: { slug: item.slug, title: item.title, minutes: item.minutes,
      revision: item.revision, editVersion: item.editVersion, unitId: id, position, published: true, prerequisiteId: previous,
      blocks: { create: item.blocks.map((b, position) => ({ ...b, position })) },
      quiz: { create: item.quiz } } });
    lessons.push(lesson); previous = lesson.id;
  }
  for (const role of ['STUDENT', 'EDITOR']) {
    const password = randomUUID() + 'Aa1!';
    const email = `${id}-${role.toLowerCase()}@example.invalid`;
    await db.user.create({ data: { email, name: 'Isolated HSK1 test', role, emailVerifiedAt: new Date(), passwordHash: await hashPassword(password),
      settings: { create: { onboardingCompletedAt: new Date() } } } });
    credentials[role] = { email, password };
    const login = await request(role, 'post', 'auth/login').send({ email, password }).expect(200);
    cookies[role] = login.headers['set-cookie'][0].split(';')[0];
    await request(role, 'get', 'auth/me').expect(200);
  }
  check('real login for own student/editor; no mail or AI');
  await request('STUDENT', 'get', 'learning/catalog').expect(200);
  for (const [i, item] of source.entries()) {
    const path = `learning/lessons/${item.slug}`;
    if (i < 4) await request('STUDENT', 'get', `learning/lessons/${source[i + 1].slug}`).expect(403);
    const lesson = (await request('STUDENT', 'get', path).expect(200)).body;
    for (const block of lesson.blocks) await request('STUDENT', 'put', `${path}/progress`).send({ blockId: block.id, revision: lesson.revision }).expect(200);
    const quiz = (await request('STUDENT', 'get', `${path}/quiz`).expect(200)).body;
    const answers = item.quiz.questions.map(q => ({ questionId: q.id, value: q.correct ?? q.accepted[0] }));
    const body = { requestId: randomUUID(), lessonRevision: lesson.revision, quizRevision: quiz.revision, answers };
    const wrong = structuredClone(answers);
    for (let n = 0; n < answers.length - Math.ceil(answers.length * .8) + 1; n++) {
      const q = item.quiz.questions[n];
      wrong[n].value = q.kind === 'choice' ? q.options.find(o => o.id !== q.correct).id : ['match', 'order'].includes(q.kind) ? [...q.correct].reverse() : '错误';
    }
    assert.equal((await request('STUDENT', 'post', `${path}/attempts`).send({ ...body, answers: wrong }).expect(200)).body.result.passed, false);
    if (i < 4) await request('STUDENT', 'get', `learning/lessons/${source[i + 1].slug}`).expect(403);
    const result = (await request('STUDENT', 'post', `${path}/attempts`).send({ ...body, requestId: randomUUID() }).expect(200)).body;
    assert.equal(result.result.passed, true);
    assert.equal((await request('STUDENT', 'get', `${path}/quiz`).expect(200)).body.attempts[0].id, result.id);
    assert.ok((await request('STUDENT', 'get', path).expect(200)).body.progress.completedAt);
  }
  const queue = (await request('STUDENT', 'get', 'reviews').expect(200)).body;
  assert.equal(queue.cards.length, 10);
  const card = queue.cards.find(c => c.id === queue.queue[0]);
  await request('STUDENT', 'post', `reviews/${card.id}/rate`).send({ requestId: randomUUID(), version: card.version, rating: 'good' }).expect(200);
  check('catalog → four lessons → failures/retries/unlocks → final → restored result → 10 SRS cards/rating');
  const learnerState = async () => ({ attempts: await db.quizAttempt.findMany({ orderBy: { id: 'asc' } }),
    progress: await db.lessonProgress.findMany({ orderBy: [{ userId: 'asc' }, { lessonId: 'asc' }] }),
    cards: await db.reviewCard.findMany({ orderBy: { id: 'asc' } }), events: await db.reviewEvent.findMany({ orderBy: { id: 'asc' } }) });
  const beforeLearners = await learnerState();
  const live = async () => db.lesson.findMany({ orderBy: { position: 'asc' }, select: { id: true, title: true, minutes: true, revision: true, published: true,
    blocks: { orderBy: { position: 'asc' } }, quiz: true } });
  const beforeLive = await live();
  const urls = new Map();
  await request('STUDENT', 'get', 'media').expect(403);
  await request('STUDENT', 'post', 'media').expect(403);
  for (const asset of plan.uploads) {
    const bytes = await readFile(asset.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    let upload = request('EDITOR', 'post', 'media');
    for (const [key, value] of Object.entries(asset.metadata)) upload = upload.field(key, value);
    const result = (await upload.attach('file', bytes, 'source.wav').expect(201)).body;
    for (const [key, value] of Object.entries(asset.metadata)) assert.equal(result[key], value);
    assert.equal(result.size, bytes.length);
    // PostgreSQL/JSON float serialization may round the last binary digit.
    assert.ok(Math.abs(result.duration - wavDuration(bytes)) < 1e-9);
    const response = await request('EDITOR', 'get', result.audioUrl.slice(5)).buffer(true).parse((res, cb) => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    assert.match(response.headers['content-type'], /audio\/wav/);
    assert.deepEqual(response.body, bytes);
    await request('EDITOR', 'get', result.audioUrl.slice(5)).set('Range', 'bytes=0-43').expect(206).expect('Content-Length', '44');
    await request('STUDENT', 'get', result.audioUrl.slice(5)).expect(404);
    urls.set(asset.key, result.audioUrl);
  }
  assert.equal(urls.size, 10);
  check('10 real multipart WAV uploads: exact metadata/bytes, audio MIME, range responses and student denial');
  let replacements = 0;
  for (const item of plan.lessons) {
    const lesson = lessons.find(l => l.slug === item.slug);
    const path = `content/lessons/${lesson.id}`;
    await request('STUDENT', 'get', path).expect(403);
    await request('STUDENT', 'post', `${path}/draft`).send({ version: lesson.editVersion }).expect(403);
    await request('EDITOR', 'post', `${path}/draft`).send({ version: lesson.editVersion + 99 }).expect(409);
    const created = (await request('EDITOR', 'post', `${path}/draft`).send({ version: lesson.editVersion }).expect(201)).body;
    await request('EDITOR', 'post', `${path}/draft`).send({ version: created.version }).expect(409);
    const draft = structuredClone(item.draft);
    for (const replacement of item.replacements) {
      const parts = replacement.pointer.split('/').slice(1);
      let target = draft;
      for (const part of parts.slice(0, -1)) target = target[part];
      assert.equal(target[parts.at(-1)], replacement.currentUrl);
      target[parts.at(-1)] = urls.get(replacement.assetKey); replacements++;
    }
    await request('EDITOR', 'patch', path).send({ ...draft, version: lesson.editVersion }).expect(409);
    await request('STUDENT', 'patch', path).send({ ...draft, version: created.version }).expect(403);
    await request('EDITOR', 'patch', path).send({ ...draft, version: created.version }).expect(200);
    await request('EDITOR', 'patch', path).send({ ...draft, version: created.version }).expect(409);
    const detail = (await request('EDITOR', 'get', path).expect(200)).body;
    assert.equal(detail.hasDraft, true); assert.equal(detail.published, true); assert.equal(detail.revision, lesson.revision);
    assert.deepEqual(draftSchema.parse({ title: detail.title, minutes: detail.minutes, blocks: detail.blocks.map(({ kind, content }) => ({ kind, content })), quiz: detail.quiz }), draftSchema.parse(draft));
    assert.deepEqual(detail.draft, draftSchema.parse(draft));
    assert.equal((await request('STUDENT', 'get', `learning/lessons/${item.slug}/quiz`).expect(200)).body.questions.length, source.find(s => s.slug === item.slug).quiz.questions.length);
  }
  assert.equal(replacements, 13);
  assert.deepEqual(await live(), beforeLive);
  assert.deepEqual(await learnerState(), beforeLearners);
  for (const url of urls.values()) await request('STUDENT', 'get', url.slice(5)).expect(404);
  assert.equal(await db.lessonChange.count({ where: { action: 'PUBLISHED' } }), 0);
  check('13 replacements/5 independent drafts; stale and duplicate guards; current content, attempts, progress and SRS unchanged; no publication');
  if (process.env.HSK1_BROWSER === '1') {
    await app.listen(3002, '127.0.0.1');
    await writeFile('outputs/hsk1-browser-ready.json', JSON.stringify({ credentials, lessons: lessons.map(l => ({ id: l.id, slug: l.slug })) }));
    check('isolated browser API ready on 3002; stop with outputs/hsk1-browser-stop');
    const deadline = Date.now() + 30 * 60 * 1000;
    while (Date.now() < deadline) {
      if (await access('outputs/hsk1-browser-stop').then(() => true, () => false)) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
} finally { await app.close(); }
