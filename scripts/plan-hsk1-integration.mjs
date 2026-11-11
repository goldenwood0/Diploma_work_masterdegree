// Produces a reviewable plan only. No media uploads, content writes or publication.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { draftSchema } from '../dist-server/content.schema.js';
import { mediaMetadata, wavDuration } from '../dist-server/media.schema.js';

const root = 'docs/hsk1-audit';
const pack = JSON.parse(await readFile(`${root}/audio/proposed-content-with-audio.json`, 'utf8'));
const manifest = JSON.parse(await readFile(`${root}/audio/manifest.json`, 'utf8'));
assert.equal(pack.publish, false);
assert.equal(manifest.publish, false);
assert.equal(pack.lessons.length, 5);
assert.equal(new Set(pack.lessons.map(l => l.slug)).size, 5);
const uploads = [];
for (const asset of manifest.assets) {
  const bytes = await readFile(`${root}/audio/${asset.wavPath}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.wavSha256);
  assert.equal(wavDuration(bytes), asset.duration);
  uploads.push({ key: asset.key, file: `${root}/audio/${asset.wavPath}`, sha256: asset.wavSha256,
    metadata: mediaMetadata.parse(asset.metadata), responseAudioUrl: null });
}
const lessons = pack.lessons.map(item => {
  const draft = draftSchema.parse(item.draft);
  const replacements = [];
  const collect = (value, pointer) => {
    if (!value.audioUrl) return;
    const asset = manifest.assets.find(a => a.sourceAudioUrl === value.audioUrl);
    assert.ok(asset, `Unmapped audio at ${item.slug}:${pointer}`);
    replacements.push({ pointer: `${pointer}/audioUrl`, assetKey: asset.key,
      currentUrl: value.audioUrl, replacement: 'Use responseAudioUrl returned by POST /api/media; retain attribution' });
  };
  draft.blocks.forEach((block, i) => collect(block.content, `/blocks/${i}/content`));
  draft.quiz?.questions.forEach((q, i) => collect(q, `/quiz/questions/${i}`));
  return { slug: item.slug, baseRevision: item.baseRevision, baseEditVersion: item.baseEditVersion,
    questions: draft.quiz?.questions.length, replacements, draft };
});
const report = { checkedAt: new Date().toISOString(), mode: 'PLAN_ONLY', publish: false,
  databaseWrites: false, livePreflight: { status: 'NOT_REQUESTED' }, uploads, lessons };
if (process.argv.includes('--live')) {
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'Only local database is allowed');
  assert.equal(url.port, '5433', 'Expected project database on 5433');
  assert.equal(url.pathname, '/zhpath');
  assert.ok(!url.searchParams.get('schema') || url.searchParams.get('schema') === 'public');
  const db = new PrismaClient();
  try {
    report.livePreflight = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const current = await tx.lesson.findMany({ where: { unitId: 'hsk1-meeting' },
        select: { id: true, slug: true, revision: true, editVersion: true, published: true, draft: true } });
      assert.equal(current.length, 5);
      const checks = lessons.map(item => {
        const live = current.find(l => l.slug === item.slug);
        assert.ok(live, `Missing lesson: ${item.slug}`);
        const ready = live.revision === item.baseRevision && live.editVersion === item.baseEditVersion && live.published && live.draft === null;
        return { slug: item.slug, id: live.id, revision: live.revision, editVersion: live.editVersion,
          hasDraft: live.draft !== null, ready,
          createDraft: ready ? { method: 'POST', path: `/api/content/lessons/${live.id}/draft`, body: { version: live.editVersion } } : null };
      });
      return { status: checks.every(c => c.ready) ? 'MATCH' : 'CONFLICT', checks };
    });
  } catch {
    report.livePreflight = { status: 'FAILED', reason: 'Live versions not verified; do not write. Connection details suppressed.' };
  } finally { await db.$disconnect(); }
}
await writeFile(`${root}/integration-plan.json`, JSON.stringify(report, null, 2) + '\n');
console.log(`Plan: ${uploads.length} WAV uploads, ${lessons.length} drafts, ${lessons.reduce((n,l) => n+l.replacements.length,0)} audio references; live=${report.livePreflight.status}; no writes.`);
if (['FAILED', 'CONFLICT'].includes(report.livePreflight.status)) process.exitCode = 1;
