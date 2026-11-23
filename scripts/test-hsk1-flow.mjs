import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { createApp } from '../dist-server/app.js';
import { Database } from '../dist-server/database.js';
import { digest, newToken } from '../dist-server/passwords.js';
import { draftSchema } from '../dist-server/content.schema.js';

for (const variant of ['snapshot', 'audio-drafts']) test(`HSK1 ${variant}: full route, fail/retry, reload, unlock, isolation and ten SRS words`, async () => {
  assert.match(new URL(process.env.DATABASE_URL).searchParams.get('schema'), /^hsk1_audit_[a-f0-9]{32}$/);
  const source = variant === 'snapshot'
    ? JSON.parse(await readFile('docs/hsk1-audit/content-snapshot.json', 'utf8')).lessons
    : JSON.parse(await readFile('docs/hsk1-audit/audio/proposed-content-with-audio.json', 'utf8')).lessons.map(l => draftSchema.parse(l.draft));
  const app = await createApp();
  const db = app.get(Database);
  const api = supertest(app.getHttpServer());
  const id = `pilot-${randomUUID()}`;
  const title = { ru: 'Пилот', kk: 'Пилот', en: 'Pilot' };
  const users = [];
  try {
    await db.curriculum.create({ data: { id, title, levels: { create: { id, number: 1, units: { create: { id, title, position: 0 } } } } } });
    let previous = null;
    for (const [position, l] of source.entries()) {
      const lesson = await db.lesson.create({ data: { slug: `${id}-${position}`, title: l.title, unitId: id, position, published: true, prerequisiteId: previous,
        blocks: { create: l.blocks.map((b, position) => ({ ...b, position })) },
        quiz: { create: { kind: l.quiz.kind, passPercent: l.quiz.passPercent, questions: l.quiz.questions } } } });
      previous = lesson.id;
    }
    for (let i = 0; i < 2; i++) users.push(await db.user.create({ data: { email: `${id}-${i}@example.test`, name: 'Pilot test', passwordHash: 'unused', emailVerifiedAt: new Date() } }));
    const token = newToken();
    await db.session.create({ data: { userId: users[0].id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 600000) } });
    const cookie = `zhpath_session=${token}`;
    const get = path => api.get(`/api/learning/${path}`).set('Cookie', cookie);
    const send = (method, path, body) => api[method](`/api/learning/${path}`).set('Cookie', cookie).set('Origin', process.env.APP_ORIGIN || 'http://127.0.0.1:8443').set('X-ZhPath-Request', '1').send(body);
    for (const [i, l] of source.entries()) {
      const path = `lessons/${id}-${i}`;
      if (i < 4) await get(`lessons/${id}-${i + 1}`).expect(403);
      const lesson = (await get(path).expect(200)).body;
      await get(`${path}/quiz`).expect(403);
      for (const block of lesson.blocks) await send('put', `${path}/progress`, { blockId: block.id, revision: lesson.revision }).expect(200);
      assert.equal((await get(path)).body.progress.completedAt, null);
      const quiz = (await get(`${path}/quiz`).expect(200)).body;
      const answers = l.quiz.questions.map(q => ({ questionId: q.id, value: q.correct ?? q.accepted[0] }));
      const body = { requestId: randomUUID(), lessonRevision: lesson.revision, quizRevision: quiz.revision, answers };
      // One answer below the passing boundary, for both current and proposed quizzes.
      const wrongAnswers = structuredClone(answers);
      const required = Math.ceil(answers.length * l.quiz.passPercent / 100);
      for (let j = 0; j < answers.length - required + 1; j++) {
        const q = l.quiz.questions[j];
        wrongAnswers[j].value = q.kind === 'choice' ? q.options.find(o => o.id !== q.correct).id : q.kind === 'order' || q.kind === 'match' ? [...q.correct].reverse() : '错误';
      }
      const failed = (await send('post', `${path}/attempts`, { ...body, requestId: randomUUID(), answers: wrongAnswers }).expect(200)).body;
      assert.equal(failed.result.passed, false);
      assert.equal((await get(path)).body.progress.completedAt, null);
      if (i < 4) await get(`lessons/${id}-${i + 1}`).expect(403);
      const passed = (await send('post', `${path}/attempts`, body).expect(200)).body;
      assert.equal(passed.result.passed, true);
      assert.equal((await send('post', `${path}/attempts`, body)).body.id, passed.id);
      assert.ok((await get(path)).body.progress.completedAt);
      assert.equal((await get(`${path}/quiz`)).body.attempts[0].id, passed.id);
      if (i === 4) {
        const boundary = structuredClone(answers);
        for (let j = 0; j < answers.length - required; j++) boundary[j] = wrongAnswers[j];
        assert.equal((await send('post', `${path}/attempts`, { ...body, requestId: randomUUID(), answers: boundary })).body.result.passed, true);
      }
    }
    assert.equal(await db.reviewCard.count({ where: { userId: users[0].id } }), 10);
    assert.equal(await db.reviewCard.count({ where: { userId: users[1].id } }), 0);
    assert.equal(await db.lessonProgress.count({ where: { userId: users[1].id } }), 0);
  } finally {
    await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    await db.lesson.updateMany({ where: { unitId: id }, data: { prerequisiteId: null } });
    await db.curriculum.deleteMany({ where: { id } });
    await app.close();
  }
});

test('offline draft pack: schema, full marks and 8/10 threshold', async () => {
  const { grade } = await import('../dist-server/quiz.js');
  const pack = JSON.parse(await readFile('docs/hsk1-audit/proposed-content.json', 'utf8'));
  assert.equal(pack.publish, false);
  for (const [i, item] of pack.lessons.entries()) {
    const { quiz } = draftSchema.parse(item.draft);
    assert.equal(quiz.questions.length, i === 4 ? 10 : 6);
    const answers = quiz.questions.map(q => ({ questionId: q.id, value: q.correct ?? q.accepted[0] }));
    assert.equal(grade(quiz.questions, answers, 80).score, answers.length);
    if (i === 4) {
      for (const q of quiz.questions.filter(q => ['input','gap','dictation'].includes(q.kind)).slice(0, 2)) answers.find(a => a.questionId === q.id).value = '错误';
      assert.equal(grade(quiz.questions, answers, 80).score, 8);
      assert.equal(grade(quiz.questions, answers, 80).passed, true);
      const q = quiz.questions.find(q => q.kind === 'choice');
      answers.find(a => a.questionId === q.id).value = q.options.find(o => o.id !== q.correct).id;
      assert.equal(grade(quiz.questions, answers, 80).passed, false);
    }
  }
});
