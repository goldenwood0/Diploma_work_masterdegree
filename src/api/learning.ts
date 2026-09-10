import { z } from 'zod';
import { request } from './client';
const localized = z.object({ ru: z.string(), kk: z.string(), en: z.string() });
const progress = z.object({ nextBlock: z.number().int().nonnegative(), revision: z.number().int().positive(), completedAt: z.string().nullable() });
const summary = z.object({ id: z.string(), slug: z.string(), title: localized, minutes: z.number(), blockCount: z.number(), locked: z.boolean(), progress });
const catalogSchema = z.object({ curricula: z.array(z.object({ id: z.string(), title: localized, levels: z.array(z.object({ id: z.string(), number: z.number(), units: z.array(z.object({ id: z.string(), title: localized, lessons: z.array(summary) })) })) })) });
const phrase = { hanzi: z.string(), pinyin: z.string(), translation: localized };
const block = z.discriminatedUnion('kind', [
  z.object({ id: z.string(), kind: z.literal('vocabulary'), content: z.object({ title: localized, words: z.array(z.object(phrase)) }) }),
  z.object({ id: z.string(), kind: z.literal('reading'), content: z.object({ title: localized, text: localized, ...phrase }) }),
  z.object({ id: z.string(), kind: z.literal('audio'), content: z.object({ title: localized, ...phrase,
    audioUrl: z.url().refine(url => url.startsWith('https://')), sourceUrl: z.url().refine(url => url.startsWith('https://')),
    author: z.string(), license: z.string(), licenseUrl: z.url().refine(url => url.startsWith('https://')) }) }),
]);
const lessonSchema = z.object({ id: z.string(), slug: z.string(), title: localized, revision: z.number(), blocks: z.array(block).min(1), progress });
export type CatalogData = z.infer<typeof catalogSchema>;
export type LessonData = z.infer<typeof lessonSchema>;
export type AudioContent = Extract<z.infer<typeof block>, { kind: 'audio' }>['content'];
export async function getCatalog(signal: AbortSignal) { return catalogSchema.parse(await request('/learning/catalog', { signal })); }
export async function getLesson(slug: string, signal: AbortSignal) { return lessonSchema.parse(await request(`/learning/lessons/${encodeURIComponent(slug)}`, { signal })); }
export async function completeBlock(lesson: LessonData, blockId: string, signal: AbortSignal) {
  return progress.parse(await request(`/learning/lessons/${encodeURIComponent(lesson.slug)}/progress`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blockId, revision: lesson.revision }), signal,
  }));
}
