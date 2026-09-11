import "reflect-metadata"
import { beforeEach, afterEach, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import supertest from "supertest"
import type { INestApplication } from "@nestjs/common"
import { createApp } from "./app.js"
import { Database } from "./database.js"
import { digest, newToken } from "./passwords.js"
import { schedule } from './review.service.js';

let app: INestApplication
let db: Database
let api: ReturnType<typeof supertest>
let fixture: string
let first: string
let second: string
let blocks: string[]
let users: string[]
let session: string
let other: string
const title = { ru: "Тест", kk: "Сынақ", en: "Test" }
const get = (path: string, cookie = session) =>
  api.get(`/api/learning/${path}`).set("Cookie", cookie)
const put = (slug: string, body: object, cookie = session) =>
  api
    .put(`/api/learning/lessons/${slug}/progress`)
    .set("Cookie", cookie)
    .set("Origin", process.env.APP_ORIGIN!)
    .set("X-ZhPath-Request", "1")
    .send(body)
async function device(userId: string) {
  const token = newToken()
  await db.session.create({
    data: {
      userId,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 60000),
    },
  })
  return `zhpath_session=${token}`
}
beforeEach(async () => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Tests must not run in production")
  app = await createApp()
  db = app.get(Database)
  api = supertest(app.getHttpServer())
  fixture = `learning-test-${randomUUID()}`
  first = `${fixture}-first`
  second = `${fixture}-second`
  users = []
  for (let i = 0; i < 2; i++) {
    const user = await db.user.create({
      data: {
        email: `${fixture}-${i}@example.test`,
        name: "Test",
        passwordHash: "unused",
        emailVerifiedAt: new Date(),
      },
    })
    users.push(user.id)
  }
  session = await device(users[0])
  other = await device(users[1])
  await db.curriculum.create({
    data: {
      id: fixture,
      title,
      levels: {
        create: {
          id: fixture,
          number: 1,
          units: { create: { id: fixture, title, position: 0 } },
        },
      },
    },
  })
  const lesson = await db.lesson.create({
    data: {
      slug: first,
      unitId: fixture,
      position: 0,
      title,
      published: true,
      blocks: {
        create: [0, 1, 2].map((position) => ({
          position,
          kind: "reading",
          content: {
            title,
            text: title,
            hanzi: "你好",
            pinyin: "nǐ hǎo",
            translation: title,
          },
        })),
      },
    },
    include: { blocks: { orderBy: { position: "asc" } } },
  })
  blocks = lesson.blocks.map((b) => b.id)
  await db.lesson.create({
    data: {
      slug: second,
      unitId: fixture,
      position: 1,
      title,
      published: true,
      prerequisiteId: lesson.id,
      blocks: { create: { position: 0, kind: "reading", content: { title } } },
    },
  })
  await db.lesson.create({
    data: {
      slug: `${fixture}-draft`,
      unitId: fixture,
      position: 2,
      title,
      published: false,
    },
  })
})
afterEach(async () => {
  if (db) {
    await db.quizAttempt.deleteMany({ where: { userId: { in: users ?? [] } } })
    await db.user.deleteMany({ where: { id: { in: users ?? [] } } })
    await db.lesson.updateMany({
      where: { unitId: fixture },
      data: { prerequisiteId: null },
    })
    await db.curriculum.deleteMany({ where: { id: fixture } })
  }
  if (app) await app.close()
})

test("catalog and lesson enforce sessions, publication and prerequisite access", async () => {
  await api.get("/api/learning/catalog").expect(401)
  const result = await get("catalog").expect(200)
  const lessons = result.body.curricula.find(
    (c: { id: string }) => c.id === fixture,
  ).levels[0].units[0].lessons
  assert.equal(lessons.length, 2)
  assert.equal(lessons[0].locked, false)
  assert.equal(lessons[1].locked, true)
  await get(`lessons/${second}`).expect(403)
  await put(second, { blockId: blocks[0], revision: 1 }).expect(403)
  await get(`lessons/${fixture}-draft`).expect(404)
  await get("lessons/nonexistent").expect(404)
})

test("checkpoint resumes in a second session and isolates another learner", async () => {
  await put(first, { blockId: blocks[0], revision: 1 }).expect(200)
  const secondDevice = await device(users[0])
  assert.equal(
    (await get(`lessons/${first}`, secondDevice).expect(200)).body.progress
      .nextBlock,
    1,
  )
  assert.equal(
    (await get(`lessons/${first}`, other).expect(200)).body.progress.nextBlock,
    0,
  )
  await put(first, {
    blockId: blocks[1],
    revision: 1,
    userId: users[1],
  }).expect(400)
  await api
    .put(`/api/learning/lessons/${first}/progress`)
    .set("Cookie", session)
    .send({ blockId: blocks[1], revision: 1 })
    .expect(403)
})

test("ordered completion is idempotent and unlocks the next lesson only for its owner", async () => {
  await put(first, { blockId: blocks[2], revision: 1 }).expect(409)
  await put(first, { blockId: "foreign-block", revision: 1 }).expect(409)
  for (const blockId of blocks)
    await put(first, { blockId, revision: 1 }).expect(200)
  const completed = (await get(`lessons/${first}`).expect(200)).body.progress
  assert.equal(completed.nextBlock, 3)
  assert.ok(completed.completedAt)
  const replay = (
    await put(first, { blockId: blocks[0], revision: 1 }).expect(200)
  ).body
  assert.equal(replay.nextBlock, 3)
  assert.equal(replay.completedAt, completed.completedAt)
  await get(`lessons/${second}`).expect(200)
  await get(`lessons/${second}`, other).expect(403)
})

test("concurrent requests cannot double advance or regress progress", async () => {
  const responses = await Promise.all([
    put(first, { blockId: blocks[0], revision: 1 }),
    put(first, { blockId: blocks[0], revision: 1 }),
  ])
  assert.ok(responses.some((r) => r.status === 200))
  assert.ok(responses.every((r) => [200, 409].includes(r.status)))
  await put(first, { blockId: blocks[0], revision: 1 }).expect(200)
  assert.equal(
    (await get(`lessons/${first}`).expect(200)).body.progress.nextBlock,
    1,
  )
})

test("content revision rejects stale writes and restarts the new block sequence", async () => {
  for (const blockId of blocks)
    await put(first, { blockId, revision: 1 }).expect(200)
  await get(`lessons/${second}`).expect(200)
  await db.lesson.update({ where: { slug: first }, data: { revision: 2 } })
  await get(`lessons/${second}`).expect(403)
  const catalog = (await get("catalog").expect(200)).body
  const catalogLessons = catalog.curricula.find(
    (c: { id: string }) => c.id === fixture,
  ).levels[0].units[0].lessons
  assert.equal(catalogLessons[0].progress.nextBlock, 0)
  assert.equal(catalogLessons[1].locked, true)
  await put(first, { blockId: blocks[1], revision: 1 }).expect(409)
  const revised = (await get(`lessons/${first}`).expect(200)).body
  assert.equal(revised.progress.nextBlock, 0)
  assert.equal(revised.progress.revision, 2)
  await put(first, { blockId: blocks[1], revision: 2 }).expect(409)
  await put(first, { blockId: blocks[0], revision: 2 }).expect(200)
  assert.equal(
    (await get(`lessons/${first}`).expect(200)).body.progress.nextBlock,
    1,
  )
})

const submitAttempt = (body: object, cookie = session) => api.post(`/api/learning/lessons/${first}/attempts`).set('Cookie', cookie).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send(body);
async function prepareQuiz() {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: first } });
  return db.quiz.create({ data: { lessonId: lesson.id, questions: [{ id: 'q1', kind: 'input', prompt: title, explanation: title, accepted: ['你好'] }] } });
}
const attemptBody = (value = '你好') => ({ requestId: randomUUID(), quizRevision: 1, lessonRevision: 1, answers: [{ questionId: 'q1', value }] });

test('quiz gates completion, keeps answer keys private and persists failed and passed attempts', async () => {
  const quiz = await prepareQuiz();
  await get(`lessons/${first}/quiz`).expect(403);
  await submitAttempt(attemptBody()).expect(403);
  for (const blockId of blocks) await put(first, { blockId, revision: 1 }).expect(200);
  assert.equal((await get(`lessons/${first}`).expect(200)).body.progress.completedAt, null);
  const view = (await get(`lessons/${first}/quiz`).expect(200)).body;
  assert.equal(view.questions[0].accepted, undefined); assert.equal(view.questions[0].explanation, undefined);
  const failed = await submitAttempt(attemptBody('谢谢')).expect(200);
  assert.equal(failed.body.result.passed, false);
  await get(`lessons/${second}`).expect(403);
  const passed = await submitAttempt(attemptBody()).expect(200);
  assert.equal(passed.body.result.passed, true);
  await get(`lessons/${second}`).expect(200);
  const anotherDevice = await device(users[0]);
  const history = (await get(`lessons/${first}/quiz`, anotherDevice).expect(200)).body.attempts;
  assert.equal(history.length, 2); assert.equal(history[0].id, passed.body.id);
  await get(`lessons/${first}/quiz`, other).expect(403);
  const stored = await db.quizAttempt.findUniqueOrThrow({ where: { id: passed.body.id } });
  assert.ok(stored.snapshot); assert.equal(stored.quizId, quiz.id);
  await submitAttempt(attemptBody('错')).expect(200);
  await get(`lessons/${second}`).expect(200);
});

test('quiz submissions are idempotent, reject altered retries and retain historical snapshots', async () => {
  const quiz = await prepareQuiz();
  for (const blockId of blocks) await put(first, { blockId, revision: 1 }).expect(200);
  const body = attemptBody();
  const responses = await Promise.all([submitAttempt(body), submitAttempt(body)]);
  assert.ok(responses.some(r => r.status === 200)); assert.ok(responses.every(r => [200, 409].includes(r.status)));
  const replay = await submitAttempt(body).expect(200);
  assert.equal(await db.quizAttempt.count({ where: { quizId: quiz.id } }), 1);
  await submitAttempt({ ...body, answers: [{ questionId: 'q1', value: 'changed' }] }).expect(409);
  await submitAttempt({ ...attemptBody(), score: 100 }).expect(400);
  await db.quiz.update({ where: { id: quiz.id }, data: { revision: 2, questions: [{ id: 'q2', kind: 'input', prompt: title, explanation: title, accepted: ['再见'] }] } });
  await submitAttempt(attemptBody()).expect(409);
  assert.equal((await submitAttempt(body).expect(200)).body.id, replay.body.id);
  const history = (await get(`lessons/${first}/quiz`).expect(200)).body;
  assert.equal(history.questions[0].id, 'q2'); assert.equal(history.attempts[0].result.items[0].expected, '你好');
});

const reviews = (cookie = session) => api.get('/api/reviews').set('Cookie', cookie);
const rating = (id: string, body: object, cookie = session) => api.post(`/api/reviews/${id}/rate`).set('Cookie', cookie).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send(body);
const newCard = (key: string) => db.reviewCard.create({ data: { userId: users[0], wordKey: key, content: { hanzi: key, pinyin: 'nǐ', translation: title } } });
test('review import is additive, isolated and only includes completed lesson vocabulary', async () => {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: first } });
  await db.lessonBlock.update({ where: { id: blocks[0] }, data: { kind: 'vocabulary', content: { words: [{ hanzi: '你好', pinyin: 'nǐ hǎo', translation: title }] } } });
  const sync = (cookie = session) => api.post('/api/reviews/sync').set('Cookie', cookie).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1');
  await sync().expect(200); assert.equal((await reviews().expect(200)).body.cards.length, 0);
  await db.lessonProgress.create({ data: { userId: users[0], lessonId: lesson.id, revision: lesson.revision, nextBlock: 3, completedAt: new Date() } });
  await sync().expect(200); await sync().expect(200); await sync(other).expect(200);
  const card = (await reviews().expect(200)).body.cards[0]; assert.equal((await reviews().expect(200)).body.cards.length, 1);
  assert.equal((await reviews(other).expect(200)).body.cards.length, 0);
  const patch = (cookie: string, body: object) => api.patch(`/api/reviews/${card.id}`).set('Cookie', cookie).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send(body);
  await patch(other, { note: 'Intrusion' }).expect(404);
  await patch(session, { note: 'Remember tones', favorite: true }).expect(200);
  await patch(session, { userId: users[1] }).expect(400);
  assert.equal((await reviews().expect(200)).body.cards[0].note, 'Remember tones');
});
test('review scheduling rejects early and stale writes and repeats idempotently', async () => {
  const card = await newCard('你好');
  const body = { requestId: randomUUID(), version: 0, rating: 'good' };
  await rating(card.id, body, other).expect(404);
  const results = await Promise.all([rating(card.id, body), rating(card.id, body)]);
  assert.ok(results.some(r => r.status === 200)); assert.ok(results.every(r => [200, 409].includes(r.status)));
  const result = (await rating(card.id, body).expect(200)).body;
  assert.equal(result.interval, 1); assert.equal(result.version, 1);
  assert.equal(await db.reviewEvent.count({ where: { cardId: card.id } }), 1);
  await rating(card.id, { ...body, rating: 'easy' }).expect(409);
  await rating(card.id, { ...body, requestId: randomUUID(), version: 1 }).expect(409);
  const queue = (await reviews().expect(200)).body;
  assert.equal(queue.queue.length, 0); assert.equal(queue.reviewedToday, 1); assert.equal(queue.remainingNew, 9);
  assert.equal(queue.history[0].result.dueAt, result.dueAt);
});
test('daily new-card limit is enforced by the server and accounts for profile timezone', async () => {
  await db.userSettings.create({ data: { userId: users[0], timezone: 'Asia/Qyzylorda' } });
  const cards = [];
  for (let i = 0; i < 11; i++) cards.push(await newCard(`word-${i}`));
  const initial = (await reviews().expect(200)).body;
  assert.equal(initial.queue.length, 10); assert.equal(initial.timezone, 'Asia/Qyzylorda');
  for (const card of cards.slice(0, 10)) await rating(card.id, { requestId: randomUUID(), version: 0, rating: 'easy' }).expect(200);
  await rating(cards[10].id, { requestId: randomUUID(), version: 0, rating: 'good' }).expect(409);
  assert.equal((await reviews().expect(200)).body.remainingNew, 0);
  // Move fixture history two days back: a new local calendar day admits new cards.
  await db.reviewEvent.updateMany({ where: { userId: users[0] }, data: { createdAt: new Date(Date.now() - 48 * 3600000) } });
  assert.equal((await reviews().expect(200)).body.remainingNew, 10);
  await rating(cards[10].id, { requestId: randomUUID(), version: 0, rating: 'good' }).expect(200);
});
test('review intervals have stable UTC durations, reset on again and remain bounded', () => {
  const now = new Date('2026-03-08T06:59:00Z');
  assert.equal(schedule(10, 3, 'again', now).dueAt.getTime() - now.getTime(), 600000);
  assert.equal(schedule(10, 3, 'again', now).repetitions, 0);
  assert.equal(schedule(10, 3, 'hard', now).interval, 12);
  assert.equal(schedule(10, 3, 'good', now).interval, 20);
  assert.equal(schedule(0, 0, 'easy', now).interval, 4);
  assert.equal(schedule(365, 100, 'easy', now).interval, 365);
  assert.equal(schedule(1, 1, 'good', now).dueAt.getTime() - now.getTime(), 2 * 86400000);
});

test('editor workflow protects published lessons, rejects stale edits and audits transitions', async () => {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: first } });
  const detail = () => api.get(`/api/content/lessons/${lesson.id}`).set('Cookie', session);
  const state = (version: number, value: string) => api.post(`/api/content/lessons/${lesson.id}/state`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version, state: value });
  const edit = (version: number, minutes = 12) => api.patch(`/api/content/lessons/${lesson.id}`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version, title, minutes });
  await detail().expect(403); await edit(0).expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'EDITOR' } });
  await detail().expect(200); await edit(0).expect(409); await state(0, 'ARCHIVED').expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  await state(0, 'ARCHIVED').expect(201);
  await get(`lessons/${first}`, other).expect(404);
  await state(1, 'DRAFT').expect(201);
  await db.user.update({ where: { id: users[0] }, data: { role: 'EDITOR' } });
  await edit(2, 0).expect(400); await edit(2).expect(200); await edit(2).expect(409);
  await state(3, 'REVIEW').expect(201); await edit(4).expect(409); await state(4, 'PUBLISHED').expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  await state(4, 'PUBLISHED').expect(201);
  await get(`lessons/${first}`, other).expect(200);
  const updated = (await detail().expect(200)).body;
  assert.equal(updated.minutes, 12); assert.equal(updated.editVersion, 5); assert.equal(updated.changes.length, 5);
  assert.equal(updated.changes[0].snapshot.after.state, 'PUBLISHED');
});

test('lesson creation appends drafts, protects roles and rejects duplicate slugs', async () => {
  const create = (body: object) => api.post('/api/content/lessons').set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send(body);
  const body = { unitId: fixture, slug: `${fixture}-new`, title, minutes: 10 };
  await create(body).expect(403);
  await api.get('/api/content/units').set('Cookie', session).expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'EDITOR' } });
  await api.get('/api/content/units').set('Cookie', session).expect(200);
  await create({ ...body, published: true }).expect(400);
  await create({ ...body, slug: '../invalid' }).expect(400);
  await create({ ...body, unitId: 'missing' }).expect(404);
  const result = (await create(body).expect(201)).body;
  await create(body).expect(409);
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: result.id }, include: { changes: true, prerequisite: true } });
  assert.equal(lesson.position, 3); assert.equal(lesson.published, false);
  assert.equal(lesson.prerequisite?.slug, `${fixture}-draft`);
  assert.equal(lesson.changes[0].actorId, users[0]); assert.equal(lesson.changes[0].action, 'CREATE');
  await get(`lessons/${body.slug}`, other).expect(404);
});

test('block editing validates content, versions progress and keeps audited snapshots atomically', async () => {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: first } });
  const edit = (version: number, content: unknown) => api.patch(`/api/content/lessons/${lesson.id}`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version, title, minutes: 10, blocks: content });
  const state = (version: number, state: string) => api.post(`/api/content/lessons/${lesson.id}/state`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version, state });
  const phrase = { hanzi: '你好', pinyin: 'nǐ hǎo', translation: title };
  const reading = { kind: 'reading', content: { title, text: title, ...phrase } };
  const vocabulary = { kind: 'vocabulary', content: { title, words: [phrase] } };
  const audio = { kind: 'audio', content: { title, ...phrase, audioUrl: 'https://example.test/audio.ogg', sourceUrl: 'https://example.test/source', author: 'Test', license: 'CC0', licenseUrl: 'https://example.test/license' } };
  await edit(0, [reading]).expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  await edit(0, [reading]).expect(409);
  await db.lessonProgress.create({ data: { userId: users[1], lessonId: lesson.id, nextBlock: 3, revision: 1, completedAt: new Date() } });
  await state(0, 'ARCHIVED').expect(201); await state(1, 'DRAFT').expect(201);
  await edit(2, [{ ...reading, content: { ...reading.content, text: { ru: 'Only Russian' } } }]).expect(400);
  await edit(2, [{ ...audio, content: { ...audio.content, audioUrl: 'javascript:alert(1)' } }]).expect(400);
  await edit(2, [{ ...vocabulary, content: { ...vocabulary.content, words: [] } }]).expect(400);
  await edit(2, [vocabulary, reading, audio]).expect(200);
  await edit(2, [reading]).expect(409);
  let updated = await db.lesson.findUniqueOrThrow({ where: { id: lesson.id }, include: { blocks: { orderBy: { position: 'asc' } }, changes: { orderBy: { createdAt: 'desc' } } } });
  assert.equal(updated.revision, 2); assert.deepEqual(updated.blocks.map(b => b.kind), ['vocabulary', 'reading', 'audio']);
  const snapshot = updated.changes[0].snapshot as { before: { blocks: unknown[] }; after: { blocks: unknown[] } };
  assert.equal(snapshot.before.blocks.length, 3); assert.deepEqual(snapshot.after.blocks, updated.blocks);
  const stableIds = updated.blocks.map(b => b.id);
  await edit(3, [vocabulary, reading, audio]).expect(200);
  updated = await db.lesson.findUniqueOrThrow({ where: { id: lesson.id }, include: { blocks: { orderBy: { position: 'asc' } }, changes: { orderBy: { createdAt: 'desc' } } } });
  assert.equal(updated.revision, 2); assert.deepEqual(updated.blocks.map(b => b.id), stableIds);
  await edit(4, [audio, vocabulary]).expect(200);
  await state(5, 'REVIEW').expect(201); await edit(6, []).expect(409); await state(6, 'PUBLISHED').expect(201);
  const publicLesson = (await get(`lessons/${first}`, other).expect(200)).body;
  assert.equal(publicLesson.revision, 3); assert.equal(publicLesson.progress.nextBlock, 0); assert.equal(publicLesson.progress.completedAt, null);
  assert.deepEqual(publicLesson.blocks.map((b: { kind: string }) => b.kind), ['audio', 'vocabulary']);
  await put(first, { blockId: blocks[0], revision: 1 }, other).expect(409);
});

test('publication rejects empty drafts and invalid stored block translations', async () => {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: `${fixture}-draft` } });
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  const state = (version: number, state: string) => api.post(`/api/content/lessons/${lesson.id}/state`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version, state });
  await state(0, 'REVIEW').expect(201); await state(1, 'PUBLISHED').expect(409);
  await db.lessonBlock.create({ data: { lessonId: lesson.id, position: 0, kind: 'reading', content: { title } } });
  await state(1, 'PUBLISHED').expect(400);
  const unchanged = await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
  assert.equal(unchanged.editVersion, 1); assert.equal(unchanged.published, false);
});
