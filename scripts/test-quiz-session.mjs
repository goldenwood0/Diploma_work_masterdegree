// Runs the real controller with a minimal database double; no PostgreSQL writes.
import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LearningController } from '../dist-server/learning.controller.js';
import { digest } from '../dist-server/passwords.js';
const body = { requestId: randomUUID(), lessonRevision: 1, quizRevision: 1, answers: [{ questionId: 'q', value: '你好' }] };
const request = (sessionUser, expectedUser) => ({ session: { user: { id: sessionUser } }, headers: { 'x-zhpath-user': expectedUser } });
test('changed session rejects quiz read and submit before database access', async () => {
  const controller = new LearningController(new Proxy({}, { get() { throw new Error('Unexpected database access'); } }));
  for (const req of [request('bob', 'alice'), request('alice', 'bob')]) {
    await assert.rejects(controller.quiz('lesson', req), error => error.getStatus() === 403);
    await assert.rejects(controller.submit('lesson', req, body), error => error.getStatus() === 403);
  }
});
test('persisted request returns original attempt after relogin and version change', async () => {
  const stored = { id: 'attempt', createdAt: new Date(), quizRevision: 1, lessonRevision: 1, result: { score: 1 },
    requestHash: digest(JSON.stringify({ slug: 'lesson', lessonRevision: 1, quizRevision: 1, answers: body.answers })) };
  let reads = 0;
  const db = { $transaction: async callback => callback({ quizAttempt: { findUnique: async query => {
    assert.deepEqual(query.where.userId_requestId, { userId: 'alice', requestId: body.requestId }); reads++; return stored;
  } } }) };
  const controller = new LearningController(db);
  const a = await controller.submit('lesson', request('alice', 'alice'), body);
  const b = await controller.submit('lesson', request('alice', 'alice'), body);
  assert.equal(a.id, 'attempt'); assert.deepEqual(a, b); assert.equal(reads, 2);
  await assert.rejects(controller.submit('lesson', request('alice', 'alice'), { ...body, answers: [{ questionId: 'q', value: 'changed' }] }), error => error.getStatus() === 409);
});
