// Read-only content inventory. Never selects users, sessions or learner results.
import { PrismaClient } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PrismaClient();
try {
  const lessons = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return tx.lesson.findMany({ where: { unitId: 'hsk1-meeting' }, orderBy: { position: 'asc' },
      select: { slug: true, id: true, title: true, minutes: true, position: true, prerequisiteId: true, published: true,
        editorialState: true, revision: true, editVersion: true, draft: true,
        blocks: { orderBy: { position: 'asc' }, select: { kind: true, content: true } },
        quiz: { select: { kind: true, revision: true, passPercent: true, questions: true } } } });
  });
  if (process.argv.includes('--verify')) {
    const previous = JSON.parse(await readFile('docs/hsk1-audit/content-snapshot.json', 'utf8'));
    assert.deepEqual(lessons, previous.lessons);
    console.log('PASS: live pilot content, revisions, publication flags and drafts unchanged.');
  } else {
  await mkdir('docs/hsk1-audit', { recursive: true });
  await writeFile('docs/hsk1-audit/content-snapshot.json', JSON.stringify({ capturedAt: new Date().toISOString(), lessons }, null, 2) + '\n');
  console.log(JSON.stringify(lessons.map(l => ({ slug: l.slug, revision: l.revision, published: l.published, state: l.editorialState,
    draft: !!l.draft, blocks: l.blocks.length, audio: l.blocks.filter(b => b.kind === 'audio').length,
    questions: l.quiz?.questions.length, passPercent: l.quiz?.passPercent })), null, 2));
  }
} finally { await db.$disconnect(); }
