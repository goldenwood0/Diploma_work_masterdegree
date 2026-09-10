import { z } from 'zod';
import { request } from './client';
const card = z.object({ id: z.string(), content: z.object({ hanzi: z.string(), pinyin: z.string(), translation: z.object({ ru: z.string(), kk: z.string(), en: z.string() }) }), favorite: z.boolean(), note: z.string(), dueAt: z.string(), interval: z.number(), repetitions: z.number(), version: z.number() });
const schema = z.object({ cards: z.array(card), queue: z.array(z.string()), newLimit: z.number(), remainingNew: z.number(), reviewedToday: z.number(), timezone: z.string(), serverNow: z.string(), history: z.array(z.object({ id: z.string(), cardId: z.string(), rating: z.string(), createdAt: z.string(), result: z.object({ dueAt: z.string(), interval: z.number(), version: z.number() }) })) });
export type ReviewData = z.infer<typeof schema>;
export type Card = z.infer<typeof card>;
export async function loadReviews(signal: AbortSignal) {
  await request('/reviews/sync', { method: 'POST', signal });
  return schema.parse(await request('/reviews', { signal }));
}
export async function editCard(id: string, data: { favorite?: boolean; note?: string }) { await request(`/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
export async function rateCard(id: string, data: { version: number; rating: string; requestId: string }, signal: AbortSignal) { return z.object({ dueAt: z.string(), interval: z.number(), version: z.number() }).parse(await request(`/reviews/${encodeURIComponent(id)}/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal })); }
