// Existing local database only. No migrations, seed, mail or tutor requests.
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { getConfig } from '../dist-server/config.js';
import { digest, hashPassword } from '../dist-server/passwords.js';

let stage = 'configuration';
let db;
let fixture;
let created = false;
const check = (condition) => { if (!condition) throw new Error('Check failed'); };
const marker = /^local-start-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const emailFor = id => `${id}@example.invalid`;

async function cleanup(id) {
  check(marker.test(id));
  await db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id }, select: { email: true, name: true, role: true } });
    if (!user) return;
    check(user.email === emailFor(id) && user.name === `TEST ONLY ${id}` && user.role === 'STUDENT');
    await tx.user.delete({ where: { id } }); // Only this fixture; FK cascades remove its settings/sessions.
  });
  check(await db.user.count({ where: { id } }) === 0);
  check(await db.session.count({ where: { userId: id } }) === 0);
  check(await db.userSettings.count({ where: { userId: id } }) === 0);
  console.log('PASS fixture cleanup');
}

try {
  const config = getConfig();
  const url = new URL(config.DATABASE_URL);
  check(config.NODE_ENV !== 'production' && config.REMINDERS_ENABLED === 'false');
  check(url.hostname === '127.0.0.1' && url.port === '5433' && url.pathname === '/zhpath');
  check((url.searchParams.get('schema') ?? 'public') === 'public');
  check(config.APP_ORIGIN === 'http://127.0.0.1:8443' && config.API_PORT === 3001);
  const args = process.argv.slice(2);
  check(args.length <= 1);
  const cleanupId = args[0]?.startsWith('--cleanup=') ? args[0].slice(10) : undefined;
  check(!args.length || args[0] === '--session' || (cleanupId && marker.test(cleanupId)));
  db = new PrismaClient({ log: [] });
  stage = 'database';
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const rows = await tx.$queryRaw`SELECT current_database() AS database, current_schema() AS schema`;
    check(rows[0].database === 'zhpath' && rows[0].schema === 'public');
    // Select only metadata; never retrieve existing users.
    const tables = await tx.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    check(['User', 'Session', 'UserSettings', '_prisma_migrations'].every(name => tables.some(t => t.table_name === name)));
  });
  console.log('PASS configuration and database connection (5433/zhpath/public)');
  if (cleanupId) {
    stage = 'explicit cleanup';
    await cleanup(cleanupId);
  } else {
    for (const base of ['http://127.0.0.1:3001', config.APP_ORIGIN]) {
      stage = base.endsWith('3001') ? 'API health' : 'Vite proxy health';
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(8000) });
      check(response.status === 200 && (await response.json()).status === 'ok');
      console.log(`PASS ${stage}`);
    }
    if (args[0] === '--session') {
      fixture = `local-start-${randomUUID()}`;
      console.log(`Fixture: ${fixture}`); // Recovery marker, never credentials.
      const password = randomBytes(32).toString('hex');
      stage = 'fixture creation';
      await db.user.create({ data: {
        id: fixture, email: emailFor(fixture), name: `TEST ONLY ${fixture}`,
        passwordHash: await hashPassword(password), role: 'STUDENT', emailVerifiedAt: new Date(),
        settings: { create: { uiLanguage: 'ru', explanationLanguage: 'ru', remindersEnabled: false } },
      } });
      created = true;
      const request = (path, options = {}) => fetch(`${config.APP_ORIGIN}/api/auth/${path}`, {
        ...options, signal: AbortSignal.timeout(8000),
        headers: { origin: config.APP_ORIGIN, 'x-zhpath-request': '1', 'content-type': 'application/json', ...options.headers },
      });
      stage = 'anonymous session rejection';
      check((await request('me')).status === 401);
      stage = 'login through Vite';
      const login = await request('login', { method: 'POST', body: JSON.stringify({ email: emailFor(fixture), password }) });
      check(login.status === 200 && (await login.json()).user.id === fixture);
      const setCookie = login.headers.get('set-cookie') ?? '';
      check(/HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie));
      const cookie = setCookie.split(';')[0];
      check(cookie.startsWith('zhpath_session='));
      const tokenHash = digest(cookie.slice('zhpath_session='.length));
      check(await db.session.count({ where: { userId: fixture, tokenHash } }) === 1);
      console.log('PASS login, cookie flags and session in selected database');
      stage = 'authenticated session';
      const me = await request('me', { headers: { cookie } });
      check(me.status === 200 && (await me.json()).user.id === fixture);
      stage = 'logout and revoked cookie';
      check((await request('logout', { method: 'POST', headers: { cookie } })).status === 200);
      check((await request('me', { headers: { cookie } })).status === 401);
      check(await db.session.count({ where: { userId: fixture } }) === 0);
      check(await db.accountToken.count({ where: { userId: fixture } }) === 0);
      console.log('PASS me, logout, revoked cookie and no account mail tokens');
    }
  }
} catch {
  // Do not print Prisma errors, HTTP bodies, connection strings or credentials.
  console.error(`FAIL ${stage}; sensitive details suppressed`);
  process.exitCode = 1;
} finally {
  if (created) {
    try { await cleanup(fixture); }
    catch { console.error(`FAIL cleanup; retry --cleanup=${fixture}`); process.exitCode = 1; }
  }
  await db?.$disconnect();
}
