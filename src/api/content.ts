import { z } from 'zod';
import { request } from './client';
import { editorQuizSchema } from './contentQuiz';
const title = z.object({ ru: z.string(), kk: z.string(), en: z.string() });
const lesson = z.object({ id: z.string(), slug: z.string(), title, minutes: z.number(), published: z.boolean(), editorialState: z.string(), editVersion: z.number(), revision: z.number() });
const detail = lesson.extend({ hasDraft: z.boolean(), quiz: editorQuizSchema.nullable(), changes: z.array(z.object({ id: z.string(), action: z.string(), actorId: z.string(), createdAt: z.string() })), blocks: z.array(z.object({ id: z.string(), kind: z.enum(['reading', 'vocabulary', 'audio']), content: z.object({ title, text: title.optional(), hanzi: z.string().optional(), pinyin: z.string().optional(), translation: title.optional(), audioUrl: z.string().optional(), sourceUrl: z.string().optional(), author: z.string().optional(), license: z.string().optional(), licenseUrl: z.string().optional(), words: z.array(z.object({ hanzi: z.string(), pinyin: z.string(), translation: title })).optional() }) })) });
const unit = z.object({ id: z.string(), title, level: z.object({ number: z.number(), curriculum: z.object({ title }) }) });
export type ContentUnit = z.infer<typeof unit>;
export type ContentBlock = z.infer<typeof detail>['blocks'][number];
export async function listUnits(signal: AbortSignal) { return z.object({ units: z.array(unit) }).parse(await request('/content/units', { signal })); }
export async function createContent(body: unknown, signal: AbortSignal) { return z.object({ id: z.string() }).parse(await request('/content/lessons', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })); }
export type ContentLesson = z.infer<typeof lesson>;
export type ContentDetail = z.infer<typeof detail>;
export async function listContent(signal: AbortSignal) { return z.object({ lessons: z.array(lesson) }).parse(await request('/content/lessons', { signal })); }
export async function getContent(id: string, signal: AbortSignal) { return detail.parse(await request(`/content/lessons/${id}`, { signal })); }
export async function updateContent(id: string, body: unknown, state: boolean, signal: AbortSignal) { await request(`/content/lessons/${id}${state ? '/state' : ''}`, { method: state ? 'POST' : 'PATCH', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }

export async function draftAction(id: string, action: 'draft' | 'restore', body: unknown, signal: AbortSignal) {
  await request(`/content/lessons/${id}/${action}`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
