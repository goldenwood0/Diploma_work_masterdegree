import { z } from 'zod';
import type { Prisma } from '@prisma/client';
export const wordSchema = z.object({ hanzi: z.string(), pinyin: z.string(), translation: z.object({ ru: z.string(), kk: z.string(), en: z.string() }) });
export const ratingSchema = z.enum(['again', 'hard', 'good', 'easy']);
export function schedule(interval: number, repetitions: number, rating: z.infer<typeof ratingSchema>, now: Date) {
  const days = Math.min(365, rating === 'again' ? 0 : rating === 'hard' ? Math.max(1, Math.ceil(interval * 1.2)) : rating === 'good' ? Math.max(1, interval * 2) : Math.max(4, interval * 3));
  return { interval: days, repetitions: rating === 'again' ? 0 : repetitions + 1, dueAt: new Date(now.getTime() + (days ? days * 86400000 : 600000)) };
}
export async function collectWords(db: Prisma.TransactionClient, userId: string) {
  const lessons = await db.lesson.findMany({ where: { published: true, progress: { some: { userId, completedAt: { not: null } } } }, include: { blocks: { where: { kind: 'vocabulary' } } } });
  for (const lesson of lessons) for (const block of lesson.blocks) {
    const content = z.object({ words: z.array(wordSchema) }).safeParse(block.content);
    if (!content.success) continue;
    for (const word of content.data.words) await db.reviewCard.upsert({ where: { userId_wordKey: { userId, wordKey: `${word.hanzi}|${word.pinyin}` } }, update: {}, create: { userId, wordKey: `${word.hanzi}|${word.pinyin}`, content: word } });
  }
}
