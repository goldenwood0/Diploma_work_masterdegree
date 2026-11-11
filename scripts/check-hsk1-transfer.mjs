// Creates/drops only its own schema; public is read-only and compared by hashes.
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFile, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const url = new URL(process.env.DATABASE_URL);
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
assert.equal(url.port, '5433'); assert.equal(url.pathname, '/zhpath');
assert.ok(!url.searchParams.get('schema') || url.searchParams.get('schema') === 'public');
const publicDb = new PrismaClient();
const fingerprint = () => publicDb.$transaction(async tx => {
  await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const tables = await tx.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const result = [];
  for (const { tablename } of tables) {
    const quoted = tablename.replaceAll('"', '""');
    const rows = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(h, '' ORDER BY h), '')) AS hash FROM (SELECT md5(row_to_json(t)::text) AS h FROM public."${quoted}" t) q`);
    result.push({ table: tablename, ...rows[0] });
  }
  return result;
}, { timeout: 30000 });
const schema = `hsk1_transfer_${randomUUID().replaceAll('-', '')}`;
url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
const env = { ...process.env, DATABASE_URL: url.href, APP_ORIGIN: process.env.HSK1_BROWSER === '1' ? 'http://127.0.0.1:8446' : 'http://127.0.0.1:8443', NODE_ENV: 'test', REMINDERS_ENABLED: 'false', ZHPATH_TUTOR_ENABLED: 'false' };
const report = { schema, startedAt: new Date().toISOString(), passed: false, cleaned: false, publicUnchanged: false };
let before;
try {
  before = await fingerprint();
  await writeFile('outputs/hsk1-public-before.json', JSON.stringify(before, null, 2));
  console.log(`Own schema: ${schema}; public fingerprint captured (${before.length} tables; no row contents exported)`);
  for (const args of [[require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], ['scripts/test-hsk1-integration.mjs']]) {
    const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
    assert.equal(result.status, 0, 'Isolated check failed');
  }
  report.passed = true;
} finally {
  assert.match(schema, /^hsk1_transfer_[a-f0-9]{32}$/);
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  report.cleaned = (await db.$queryRaw`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schema}`).length === 0;
  await db.$disconnect();
  const after = await fingerprint();
  report.publicUnchanged = JSON.stringify(before) === JSON.stringify(after);
  await publicDb.$disconnect();
  await rm('outputs/hsk1-browser-ready.json', { force: true });
  await rm('outputs/hsk1-browser-stop', { force: true });
  report.finishedAt = new Date().toISOString();
  await writeFile('docs/hsk1-audit/transfer-check.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`Cleanup=${report.cleaned}; public unchanged=${report.publicUnchanged}`);
  assert.ok(report.cleaned && report.publicUnchanged);
}
