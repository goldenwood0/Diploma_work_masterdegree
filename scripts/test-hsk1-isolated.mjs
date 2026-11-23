// Run against a new schema; never run integration tests against public.
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const schema = `hsk1_audit_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', schema);
const env = { ...process.env, DATABASE_URL: url.href, APP_ORIGIN: process.env.APP_ORIGIN || 'http://127.0.0.1:8443', NODE_ENV: 'test', REMINDERS_ENABLED: 'false', ZHPATH_TUTOR_ENABLED: 'false' };
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
let log = '';
function run(args) {
  const result = spawnSync(process.execPath, args, { env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  log += output;
  console.log(output);
  if (result.status !== 0) throw new Error(`Verification failed: ${args[0]}`);
}
try {
  run([require.resolve('prisma/build/index.js'), 'migrate', 'deploy']);
  run(['--test', '--test-concurrency=1', 'dist-server/learning.test.js', 'dist-server/quiz.test.js', 'scripts/test-hsk1-flow.mjs']);
} finally {
  // Identifier is generated here and constrained, never taken from configuration.
  if (!/^hsk1_audit_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid test schema');
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
  await writeFile('docs/hsk1-audit/technical-tests.txt', log);
}
