import "reflect-metadata"
import { beforeEach, afterEach, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import supertest from "supertest"
import type { INestApplication } from "@nestjs/common"
import { createApp } from "./app.js"
import { Database } from "./database.js"
import { digest, newToken } from "./passwords.js"
import { wavDuration } from './media.schema.js';
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
    await db.mediaAsset.deleteMany({ where: { uploaderId: { in: users ?? [] } } });
    await db.roleChange.deleteMany({ where: { userId: { in: users ?? [] } } });
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

test('independent drafts isolate live lessons, publish atomically and restore with version protection', async () => {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: first } });
  const post = (action: string, body: object) => api.post(`/api/content/lessons/${lesson.id}/${action}`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send(body);
  const detail = () => api.get(`/api/content/lessons/${lesson.id}`).set('Cookie', session);
  await post('draft', { version: 0 }).expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'EDITOR' } });
  await post('draft', { version: 0 }).expect(201);
  const original = (await detail().expect(200)).body;
  const originalChange = original.changes[0].id;
  assert.equal(original.hasDraft, true);
  await post('draft', { version: 1 }).expect(409);
  const content = [{ kind: 'vocabulary', content: { title, words: [{ hanzi: '秘密', pinyin: 'mìmì', translation: title }] } }];
  await api.patch(`/api/content/lessons/${lesson.id}`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version: 1, title: { ...title, ru: 'Секретный черновик' }, minutes: 15, blocks: content }).expect(200);
  const live = (await get(`lessons/${first}`, other).expect(200)).body;
  assert.equal(live.title.ru, title.ru); assert.equal(live.revision, lesson.revision);
  assert.equal('draft' in live, false); assert.ok(!JSON.stringify(live).includes('秘密'));
  assert.ok(!JSON.stringify((await get('catalog', other).expect(200)).body).includes('Секретный черновик'));
  await post('state', { version: 1, state: 'REVIEW' }).expect(409);
  await post('state', { version: 2, state: 'REVIEW' }).expect(201);
  await post('restore', { version: 3, changeId: originalChange }).expect(409);
  await post('state', { version: 3, state: 'PUBLISHED' }).expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  await post('state', { version: 3, state: 'PUBLISHED' }).expect(201);
  const published = (await get(`lessons/${first}`, other).expect(200)).body;
  assert.equal(published.title.ru, 'Секретный черновик'); assert.equal(published.revision, lesson.revision + 1);
  await post('restore', { version: 4, changeId: randomUUID() }).expect(404);
  await post('restore', { version: 4, changeId: originalChange }).expect(201);
  assert.equal((await detail()).body.title.ru, title.ru);
  assert.equal((await get(`lessons/${first}`, other)).body.title.ru, 'Секретный черновик');
  await post('restore', { version: 4, changeId: originalChange }).expect(409);
  await post('state', { version: 5, state: 'REVIEW' }).expect(201);
  await post('state', { version: 6, state: 'PUBLISHED' }).expect(201);
  assert.equal((await get(`lessons/${first}`, other)).body.title.ru, title.ru);
  const restored = (await detail()).body;
  assert.equal(restored.hasDraft, false); assert.equal(restored.revision, lesson.revision + 2);
  assert.ok(restored.changes.some((c: { action: string }) => c.action === `RESTORE:${originalChange}`));
});

test('draft quiz changes preserve attempts, no-op publication preserves progress and failed restore is atomic', async () => {
  const quiz = await prepareQuiz();
  for (const blockId of blocks) await put(first, { blockId, revision: 1 }).expect(200);
  const attempt = (await submitAttempt(attemptBody()).expect(200)).body;
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: first } });
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  const post = (action: string, body: object) => api.post(`/api/content/lessons/${lesson.id}/${action}`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send(body);
  await post('draft', { version: 0 }).expect(201);
  const snapshot = await db.lessonChange.findFirstOrThrow({ where: { lessonId: lesson.id, action: 'DRAFT_CREATE' } });
  await post('state', { version: 1, state: 'REVIEW' }).expect(201);
  await post('state', { version: 2, state: 'PUBLISHED' }).expect(201);
  assert.equal((await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).revision, 1);
  assert.deepEqual((await db.lessonBlock.findMany({ where: { lessonId: lesson.id }, orderBy: { position: 'asc' } })).map(b => b.id), blocks);
  assert.ok((await get(`lessons/${first}`)).body.progress.completedAt);
  await post('draft', { version: 3 }).expect(201);
  const input = { version: 4, title, minutes: 10, quiz: { kind: quiz.kind, passPercent: 50, questions: quiz.questions } };
  await api.patch(`/api/content/lessons/${lesson.id}`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send(input).expect(200);
  assert.equal((await db.quiz.findUniqueOrThrow({ where: { id: quiz.id } })).revision, 1);
  await post('state', { version: 5, state: 'REVIEW' }).expect(201);
  await post('state', { version: 6, state: 'PUBLISHED' }).expect(201);
  assert.equal((await db.quiz.findUniqueOrThrow({ where: { id: quiz.id } })).revision, 2);
  await post('restore', { version: 7, changeId: snapshot.id }).expect(201);
  await post('state', { version: 8, state: 'REVIEW' }).expect(201);
  await post('state', { version: 9, state: 'PUBLISHED' }).expect(201);
  const restored = await db.quiz.findUniqueOrThrow({ where: { id: quiz.id } });
  assert.equal(restored.revision, 3); assert.equal(restored.passPercent, quiz.passPercent);
  assert.deepEqual((await db.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).result, attempt.result);
  const old = await db.lessonChange.create({ data: { lessonId: lesson.id, actorId: users[0], action: 'CREATE', snapshot: { after: { title, minutes: 10, blocks: [], quiz: null } } } });
  await post('restore', { version: 10, changeId: old.id }).expect(409);
  const unchanged = await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
  assert.equal(unchanged.editVersion, 10); assert.equal(unchanged.draft, null);
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

test('editor quiz changes preserve attempt history, hide answer keys and version learning atomically', async () => {
  const original = await prepareQuiz();
  for (const blockId of blocks) await put(first, { blockId, revision: 1 }).expect(200);
  const oldBody = attemptBody();
  const attempt = (await submitAttempt(oldBody).expect(200)).body;
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: first } });
  const quiz = { kind: 'module', passPercent: 100, questions: [{ id: 'q2', kind: 'choice', prompt: title, explanation: title, options: [{ id: 'a', text: title }, { id: 'b', text: title }], correct: 'b' }] };
  const edit = (version: number, value: unknown = quiz) => api.patch(`/api/content/lessons/${lesson.id}`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version, title, minutes: 10, quiz: value });
  const state = (version: number, state: string) => api.post(`/api/content/lessons/${lesson.id}/state`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version, state });
  await edit(0).expect(403);
  await api.get(`/api/content/lessons/${lesson.id}`).set('Cookie', session).expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  await edit(0).expect(409); await state(0, 'ARCHIVED').expect(201); await state(1, 'DRAFT').expect(201);
  await db.user.update({ where: { id: users[0] }, data: { role: 'EDITOR' } });
  await edit(2, { ...quiz, passPercent: 0 }).expect(400);
  await edit(2, { ...quiz, questions: [{ ...quiz.questions[0], correct: 'forged' }] }).expect(400);
  await edit(2, { ...quiz, revision: 999 }).expect(400);
  await edit(2, null).expect(400);
  await edit(2).expect(200); await edit(2).expect(409);
  let saved = await db.quiz.findUniqueOrThrow({ where: { lessonId: lesson.id } });
  assert.equal(saved.id, original.id); assert.equal(saved.revision, 2); assert.equal(saved.passPercent, 100);
  assert.equal((await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).revision, 2);
  const detail = (await api.get(`/api/content/lessons/${lesson.id}`).set('Cookie', session).expect(200)).body;
  assert.equal(detail.quiz.questions[0].correct, 'b');
  assert.equal(detail.changes[0].snapshot.before.quiz.questions[0].accepted[0], '你好');
  assert.equal(detail.changes[0].snapshot.after.quiz.questions[0].correct, 'b');
  await edit(3).expect(200);
  saved = await db.quiz.findUniqueOrThrow({ where: { lessonId: lesson.id } });
  assert.equal(saved.revision, 2);
  assert.equal((await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).revision, 2);
  await edit(4, { ...quiz, passPercent: 90 }).expect(200);
  assert.equal((await db.quiz.findUniqueOrThrow({ where: { lessonId: lesson.id } })).revision, 3);
  await state(5, 'REVIEW').expect(201); await edit(6).expect(409); await state(6, 'PUBLISHED').expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  await state(6, 'PUBLISHED').expect(201);
  await submitAttempt(attemptBody()).expect(409);
  assert.equal((await submitAttempt(oldBody).expect(200)).body.id, attempt.id);
  for (const blockId of blocks) await put(first, { blockId, revision: 3 }).expect(200);
  const visible = (await get(`lessons/${first}/quiz`).expect(200)).body;
  assert.equal(visible.questions[0].correct, undefined); assert.equal(visible.questions[0].explanation, undefined);
  assert.equal(visible.attempts[0].result.items[0].expected, '你好');
  const passed = (await submitAttempt({ requestId: randomUUID(), lessonRevision: 3, quizRevision: 3, answers: [{ questionId: 'q2', value: 'b' }] }).expect(200)).body;
  assert.equal(passed.result.passed, true);
});

test('editor can add a quiz to a draft and publication rejects invalid stored questions', async () => {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: `${fixture}-draft` } });
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  const quiz = { kind: 'lesson', passPercent: 80, questions: [{ id: 'q1', kind: 'input', prompt: title, explanation: title, accepted: ['你好'] }] };
  await api.patch(`/api/content/lessons/${lesson.id}`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version: 0, title, minutes: 10, quiz }).expect(200);
  const saved = await db.quiz.findUniqueOrThrow({ where: { lessonId: lesson.id } });
  assert.equal(saved.revision, 1);
  await db.quiz.update({ where: { id: saved.id }, data: { questions: [{ ...quiz.questions[0], accepted: [] }] } });
  const state = (version: number, state: string) => api.post(`/api/content/lessons/${lesson.id}/state`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version, state });
  await state(1, 'REVIEW').expect(201); await state(2, 'PUBLISHED').expect(400);
  assert.equal((await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).published, false);
});

test('admin role management validates permissions, versions, sessions and immutable audit', async () => {
  const change = (target: string, role: string, version = 0, cookie = session, extra = {}) => api.patch(`/api/admin/users/${target}/role`).set('Cookie', cookie).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ role, version, reason: 'Test access change', ...extra });
  const list = () => api.get('/api/admin/users').query({ search: fixture, role: 'STUDENT', page: 0 }).set('Cookie', session);
  const history = () => api.get(`/api/admin/users/${users[1]}/roles`).set('Cookie', session);
  await list().expect(403); await history().expect(403); await change(users[1], 'ADMIN').expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'EDITOR' } });
  await change(users[1], 'ADMIN').expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  await change(users[0], 'STUDENT').expect(403);
  await change('missing', 'EDITOR').expect(404);
  await change(users[1], 'EDITOR', 0, session, { roleVersion: 10 }).expect(400);
  await change(users[1], 'EDITOR', 0, session, { reason: ' ' }).expect(400);
  await api.patch(`/api/admin/users/${users[1]}/role`).set('Cookie', session).send({ role: 'EDITOR', version: 0, reason: 'Test' }).expect(403);
  const result = (await list().expect(200)).body;
  assert.equal(result.length, 1); assert.equal(result[0].id, users[1]); assert.equal(result[0].passwordHash, undefined); assert.equal(result[0].sessions, undefined);
  const secondDevice = await device(users[1]);
  await change(users[1], 'EDITOR').expect(200);
  await api.get('/api/auth/me').set('Cookie', other).expect(401);
  await api.get('/api/auth/me').set('Cookie', secondDevice).expect(401);
  await api.get('/api/auth/me').set('Cookie', session).expect(200);
  await change(users[1], 'ADMIN').expect(409);
  const newSession = await device(users[1]);
  await api.get('/api/content/lessons').set('Cookie', newSession).expect(200);
  await change(users[1], 'EDITOR', 1).expect(200);
  assert.equal(await db.roleChange.count({ where: { userId: users[1] } }), 1);
  await api.get('/api/auth/me').set('Cookie', newSession).expect(200);
  const journal = (await history().expect(200)).body;
  assert.equal(journal[0].before, 'STUDENT'); assert.equal(journal[0].after, 'EDITOR'); assert.equal(journal[0].actorId, users[0]); assert.equal(journal[0].reason, 'Test access change');
  await change(users[1], 'STUDENT', 1).expect(200);
  await api.get('/api/content/lessons').set('Cookie', newSession).expect(401);
  assert.equal((await history().expect(200)).body.length, 2);
});

test('role changes reject unverified privileged accounts and concurrent stale writes', async () => {
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  await db.user.update({ where: { id: users[1] }, data: { emailVerifiedAt: null } });
  const change = (role: string) => api.patch(`/api/admin/users/${users[1]}/role`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ role, version: 0, reason: 'Concurrent test' });
  await change('EDITOR').expect(409); await change('ADMIN').expect(409);
  await db.user.update({ where: { id: users[1] }, data: { emailVerifiedAt: new Date() } });
  const responses = await Promise.all([change('EDITOR'), change('ADMIN')]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal(await db.roleChange.count({ where: { userId: users[1] } }), 1);
  await api.get('/api/admin/users').query({ page: -1 }).set('Cookie', session).expect(400);
  await api.get('/api/admin/users').query({ role: 'ROOT' }).set('Cookie', session).expect(400);
  assert.equal((await api.get('/api/admin/users').query({ search: fixture, page: 1 }).set('Cookie', session).expect(200)).body.length, 0);
});

test('administrators cannot concurrently demote each other and remove all admin access', async () => {
  await db.user.updateMany({ where: { id: { in: users } }, data: { role: 'ADMIN' } });
  const change = (id: string, cookie: string) => api.patch(`/api/admin/users/${id}/role`).set('Cookie', cookie).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ role: 'STUDENT', version: 0, reason: 'Concurrent demotion' });
  const responses = await Promise.all([change(users[1], session), change(users[0], other)]);
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.ok(responses.every(r => [200, 401, 403, 409].includes(r.status)));
  assert.equal(await db.user.count({ where: { id: { in: users }, role: 'ADMIN' } }), 1);
});

function wavFixture() {
  const data = Buffer.alloc(16044); data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(8000, 24); data.writeUInt32LE(16000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(16000, 40); return data;
}
test('media upload validates bytes, protects drafts, streams ranges and audits archive transitions', async () => {
  const upload = (data: Buffer, cookie = session) => api.post('/api/media').set('Cookie', cookie).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').field('name', fixture).field('author', 'Test author').field('license', 'CC0').field('sourceUrl', 'https://example.test/source').field('licenseUrl', 'https://example.test/license').attach('file', data, 'recording.wav');
  await upload(wavFixture()).expect(403);
  await api.get('/api/media').set('Cookie', session).expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'EDITOR' } });
  await upload(Buffer.from('<html>not audio</html>')).expect(400);
  await upload(Buffer.alloc(5 * 1024 * 1024 + 1)).expect(413);
  const uploaded = await upload(wavFixture()); assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
  const media = uploaded.body;
  assert.equal(media.data, undefined); assert.equal(media.duration, 1); assert.equal(media.size, 16044);
  const list = (await api.get('/api/media').query({ search: fixture }).set('Cookie', session).expect(200)).body;
  assert.equal(list.length, 1); assert.equal(list[0].data, undefined);
  await api.get(media.audioUrl).expect(401);
  await api.get(media.audioUrl).set('Cookie', other).expect(404);
  const full = await api.get(media.audioUrl).set('Cookie', session).expect(200);
  assert.match(full.headers['content-type'], /audio\/wav/); assert.equal(full.headers['x-content-type-options'], 'nosniff');
  const range = await api.get(media.audioUrl).set('Cookie', session).set('Range', 'bytes=0-15').expect(206);
  assert.equal(range.headers['content-range'], 'bytes 0-15/16044'); assert.equal(range.headers['content-length'], '16');
  await api.get(media.audioUrl).set('Cookie', session).set('Range', 'bytes=99999-').expect(416);
  await api.get(media.audioUrl).set('Cookie', session).set('Range', 'bytes=-0').expect(416);
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: first } });
  const audioContent = { title, hanzi: '你好', pinyin: 'nǐ hǎo', translation: title, audioUrl: media.audioUrl, sourceUrl: media.sourceUrl, author: media.author, license: media.license, licenseUrl: media.licenseUrl };
  await db.lessonBlock.update({ where: { id: blocks[0] }, data: { kind: 'audio', content: audioContent } });
  await api.get(media.audioUrl).set('Cookie', other).expect(200);
  const archive = (version: number, archived: boolean) => api.patch(`/api/media/${media.id}`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version, archived });
  await archive(0, true).expect(403);
  await db.user.update({ where: { id: users[0] }, data: { role: 'ADMIN' } });
  await archive(0, true).expect(200); await archive(0, false).expect(409);
  assert.equal((await api.get('/api/media').query({ search: fixture }).set('Cookie', session).expect(200)).body.length, 0);
  await api.get(media.audioUrl).set('Cookie', other).expect(200);
  await db.lesson.update({ where: { id: lesson.id }, data: { published: false } });
  await api.get(media.audioUrl).set('Cookie', other).expect(404);
  await archive(1, false).expect(200);
  const history = (await api.get(`/api/media/${media.id}/history`).set('Cookie', session).expect(200)).body;
  assert.deepEqual(history.map((c: { action: string }) => c.action), ['RESTORE', 'ARCHIVE', 'UPLOAD']);
  await api.get(`/api/media/${media.id}/history`).set('Cookie', other).expect(403);
  await db.lessonBlock.delete({ where: { id: blocks[0] } });
  await db.quiz.create({ data: { lessonId: lesson.id, questions: [{ id: 'audio-q', kind: 'dictation', prompt: title, explanation: title, accepted: ['你好'], audioUrl: media.audioUrl, sourceUrl: media.sourceUrl, author: media.author, license: media.license, licenseUrl: media.licenseUrl }] } });
  await db.lesson.update({ where: { id: lesson.id }, data: { published: true } });
  await api.get(media.audioUrl).set('Cookie', other).expect(200);
});

test('media references must exist and WAV parsing rejects malformed chunks and unsupported formats', async () => {
  assert.equal(wavDuration(wavFixture()), 1);
  for (const offset of [4, 16, 20, 22, 28, 32, 34, 40]) {
    const malformed = wavFixture(); malformed.writeUInt32LE(0xffffffff, offset); assert.throws(() => wavDuration(malformed));
  }
  assert.throws(() => wavDuration(wavFixture().subarray(0, 43)));
  const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: `${fixture}-draft` } });
  await db.user.update({ where: { id: users[0] }, data: { role: 'EDITOR' } });
  await api.patch(`/api/content/lessons/${lesson.id}`).set('Cookie', session).set('Origin', process.env.APP_ORIGIN!).set('X-ZhPath-Request', '1').send({ version: 0, title, minutes: 10, blocks: [{ kind: 'audio', content: { title, hanzi: '你', pinyin: 'nǐ', translation: title, audioUrl: `/api/media/${randomUUID()}/file`, sourceUrl: 'https://example.test/source', author: 'Test', license: 'CC0', licenseUrl: 'https://example.test/license' } }] }).expect(409);
  assert.equal(await db.lessonBlock.count({ where: { lessonId: lesson.id } }), 0);
  assert.equal((await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).editVersion, 0);
});
