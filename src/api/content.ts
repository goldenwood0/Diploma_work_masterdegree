import { z } from 'zod';
import { request } from './client';
const title = z.object({ ru: z.string(), kk: z.string(), en: z.string() });
const lesson = z.object({ id: z.string(), slug: z.string(), title, minutes: z.number(), published: z.boolean(), editorialState: z.string(), editVersion: z.number(), revision: z.number() });
const detail = lesson.extend({ changes: z.array(z.object({ id: z.string(), action: z.string(), actorId: z.string(), createdAt: z.string() })), blocks: z.array(z.object({ id: z.string(), kind: z.string(), content: z.object({ title, text: title.optional(), hanzi: z.string().optional(), pinyin: z.string().optional(), translation: title.optional(), words: z.array(z.object({ hanzi: z.string(), pinyin: z.string(), translation: title })).optional() }) })) });
export type ContentLesson = z.infer<typeof lesson>;
export type ContentDetail = z.infer<typeof detail>;
export async function listContent(signal: AbortSignal) { return z.object({ lessons: z.array(lesson) }).parse(await request('/content/lessons', { signal })); }
export async function getContent(id: string, signal: AbortSignal) { return detail.parse(await request(`/content/lessons/${id}`, { signal })); }
export async function updateContent(id: string, body: unknown, state: boolean, signal: AbortSignal) { await request(`/content/lessons/${id}${state ? '/state' : ''}`, { method: state ? 'POST' : 'PATCH', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
