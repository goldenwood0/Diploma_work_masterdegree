import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from './app.js';
import { Database } from './database.js';
import { Mailer } from './mailer.js';
import { digest } from './passwords.js';

let app: INestApplication;
let db: Database;
let api: ReturnType<typeof supertest>;
const messages: Array<{ email: string; purpose: string; token: string }> = [];
const emails: string[] = [];
const origin = process.env.APP_ORIGIN!;
const password = 'Test-only-password-2026!';
const newEmail = () => { const email = `test-${randomUUID()}@example.test`; emails.push(email); return email; };
const post = (path: string, body = {}) => api.post(`/api/auth/${path}`).set('Origin', origin).set('X-ZhPath-Request', '1').send(body);
const cookie = (response: { headers: Record<string, unknown> }) => (response.headers['set-cookie'] as string[])[0].split(';')[0];

before(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Tests must not run in production');
  app = await createApp(); db = app.get(Database); api = supertest(app.getHttpServer());
  app.get(Mailer).send = async (email, purpose, token) => { messages.push({ email, purpose, token }); };
});
after(async () => {
  if (db) await db.user.deleteMany({ where: { email: { in: emails } } });
  if (app) await app.close();
});

async function registered() {
  const email = newEmail();
  await post('register', { email, password, name: 'Тестовый ученик' }).expect(201);
  const token = messages.find(m => m.email === email && m.purpose === 'VERIFY_EMAIL')!.token;
  return { email, token };
}
async function signedIn() {
  const { email, token } = await registered();
  await post('verify-email', { token }).expect(200);
  return { email, session: cookie(await post('login', { email, password }).expect(200)) };
}

test('registration validates input, never accepts a privileged role, and requires email confirmation', async () => {
  await post('register', { email: newEmail(), password: 'short', name: 'Test' }).expect(400);
  await post('register', { email: newEmail(), password, name: 'Test', role: 'ADMIN' }).expect(400);
  const { email, token } = await registered();
  const stored = await db.user.findUniqueOrThrow({ where: { email } });
  assert.equal(stored.role, 'STUDENT'); assert.notEqual(stored.passwordHash, password);
  const storedToken = await db.accountToken.findFirstOrThrow({ where: { userId: stored.id } });
  assert.equal(storedToken.tokenHash, digest(token)); assert.notEqual(storedToken.tokenHash, token);
  await post('login', { email, password }).expect(401);
  await post('verify-email', { token }).expect(200);
  await post('verify-email', { token }).expect(400);
  await post('login', { email, password: 'Incorrect-password!' }).expect(401);
  const loggedIn = await post('login', { email, password }).expect(200);
  assert.match(String(loggedIn.headers['set-cookie']), /HttpOnly/);
  assert.match(String(loggedIn.headers['set-cookie']), /SameSite=Strict/);
  assert.equal(loggedIn.body.user.passwordHash, undefined);
  await post('register', { email, password, name: 'Duplicate' }).expect(201);
  assert.equal(await db.user.count({ where: { email } }), 1);
});

test('sessions isolate users, enforce permissions, expire and support logout from every device', async () => {
  const first = await signedIn(); const second = await signedIn();
  const extraSession = cookie(await post('login', { email: first.email, password }).expect(200));
  await api.get('/api/auth/me').expect(401);
  const me = await api.get('/api/auth/me').set('Cookie', first.session).expect(200);
  assert.equal(me.body.user.email, first.email);
  assert.notEqual(me.body.user.email, second.email);
  await api.get('/api/admin/users').set('Cookie', first.session).expect(403);
  await db.user.update({ where: { email: first.email }, data: { role: 'EDITOR' } });
  await api.get('/api/admin/users').set('Cookie', first.session).expect(403);
  await db.user.update({ where: { email: first.email }, data: { role: 'ADMIN' } });
  const users = await api.get('/api/admin/users').set('Cookie', first.session).expect(200);
  assert.ok(users.body.every((u: Record<string, unknown>) => !('passwordHash' in u)));
  await post('logout-all').set('Cookie', first.session).expect(200);
  await api.get('/api/auth/me').set('Cookie', first.session).expect(401);
  await api.get('/api/auth/me').set('Cookie', extraSession).expect(401);
  await api.get('/api/auth/me').set('Cookie', second.session).expect(200);
  await db.session.updateMany({ where: { user: { email: second.email } }, data: { expiresAt: new Date(0) } });
  await api.get('/api/auth/me').set('Cookie', second.session).expect(401);
});

test('password reset tokens are purpose-bound, expire, are single-use, and revoke sessions', async () => {
  const { email, session } = await signedIn();
  const unknown = await post('forgot-password', { email: newEmail() }).expect(200);
  const known = await post('forgot-password', { email }).expect(200);
  assert.deepEqual(known.body, unknown.body);
  const token = messages.find(m => m.email === email && m.purpose === 'RESET_PASSWORD')!.token;
  await post('verify-email', { token }).expect(400);
  const nextPassword = 'New-test-password-2026!';
  await post('reset-password', { token, password: nextPassword }).expect(200);
  await post('reset-password', { token, password: nextPassword }).expect(400);
  await api.get('/api/auth/me').set('Cookie', session).expect(401);
  await post('login', { email, password }).expect(401);
  await post('login', { email, password: nextPassword }).expect(200);
  const unverified = await registered();
  await db.accountToken.updateMany({ where: { tokenHash: digest(unverified.token) }, data: { expiresAt: new Date(0) } });
  await post('verify-email', { token: unverified.token }).expect(400);
});

test('resend works and logout invalidates only the current session', async () => {
  const { email } = await registered();
  await post('resend-verification', { email }).expect(200);
  const token = messages.filter(m => m.email === email).at(-1)!.token;
  await post('verify-email', { token }).expect(200);
  const a = cookie(await post('login', { email, password }).expect(200));
  const b = cookie(await post('login', { email, password }).expect(200));
  await post('logout').set('Cookie', a).expect(200);
  await api.get('/api/auth/me').set('Cookie', a).expect(401);
  await api.get('/api/auth/me').set('Cookie', b).expect(200);
});

test('state-changing requests reject foreign origins and missing CSRF header', async () => {
  await api.post('/api/auth/login').send({}).expect(403);
  await api.post('/api/auth/login').set('Origin', 'https://untrusted.example').set('X-ZhPath-Request', '1').send({}).expect(403);
  await api.post('/api/auth/login').set('Origin', origin).send({}).expect(403);
});

test('concurrent confirmation requests cannot consume the same token twice', async () => {
  const { token } = await registered();
  const responses = await Promise.all([post('verify-email', { token }), post('verify-email', { token })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
});

test('repeated attempts are rate limited', async () => {
  const email = newEmail();
  let limited = false;
  for (let i = 0; i < 12; i++) {
    const response = await post('login', { email, password });
    if (response.status === 429) { limited = true; break; }
    assert.equal(response.status, 401);
  }
  assert.ok(limited);
});
