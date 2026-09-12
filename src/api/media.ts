import { z } from 'zod';
import { request } from './client';
export const isAudioUrl = (value: string) => /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/file$/.test(value) || /^https:\/\//.test(value);
export const audioUrlSchema = z.string().refine(isAudioUrl);
const asset = z.object({ id: z.string(), name: z.string(), audioUrl: audioUrlSchema, author: z.string(), license: z.string(), sourceUrl: z.string(), licenseUrl: z.string(), archived: z.boolean(), version: z.number(), size: z.number(), duration: z.number(), createdAt: z.string() });
export type MediaAsset = z.infer<typeof asset>;
export async function listMedia(search: string, archived: boolean, page: number, signal: AbortSignal) { return z.array(asset).parse(await request(`/media?${new URLSearchParams({ search, archived: String(archived), page: String(page) })}`, { signal })); }
export async function uploadMedia(form: FormData, signal: AbortSignal) { return asset.parse(await request('/media', { method: 'POST', body: form, signal })); }
export async function archiveMedia(value: MediaAsset, signal: AbortSignal) { return asset.parse(await request(`/media/${value.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: value.version, archived: !value.archived }), signal })); }
export async function mediaHistory(id: string, signal: AbortSignal) { return z.array(z.object({ id: z.string(), action: z.string(), actorId: z.string(), createdAt: z.string() })).parse(await request(`/media/${id}/history`, { signal })); }
