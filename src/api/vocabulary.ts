import { z } from 'zod';
import { request } from './client';
const schema = z.object({ words: z.array(z.object({ key: z.string(), known: z.boolean(), inReviews: z.boolean(), knowledgeSource: z.string().optional(), content: z.object({ hanzi: z.string(), pinyin: z.string(), translation: z.object({ ru: z.string(), kk: z.string(), en: z.string() }) }) })) });
export type VocabularyWord = z.infer<typeof schema>['words'][number];
export async function loadVocabulary(signal: AbortSignal) {
  return schema.parse(await request('/reviews/vocabulary', { signal })).words;
}
export async function markKnowledge(key: string, known: boolean) {
  await request('/reviews/vocabulary/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, known }) });
}
export function normalizeSearch(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/u\u0308/g, 'v').replace(/[\u0300-\u036f]/g, '').replace(/u:/g, 'v').replace(/[1-5\s'’]/g, '');
}
const testSchema = z.object({ id: z.string(), expiresAt: z.string(), wordCount: z.number(), questions: z.array(z.object({ id: z.string(), hanzi: z.string(), skill: z.enum(['meaning', 'reading']), options: z.array(z.string()) })) });
const resultSchema = z.object({ results: z.array(z.object({ key: z.string(), hanzi: z.string(), status: z.enum(['known', 'learning']), correct: z.number(), total: z.number() })), questions: z.array(z.object({ id: z.string(), correct: z.number() })) });
export type VocabularyTest = z.infer<typeof testSchema>;
export type VocabularyResult = z.infer<typeof resultSchema>;
export async function startVocabularyTest(keys: string[], language: string) {
  return testSchema.parse(await request('/reviews/vocabulary/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys, language }) }));
}
export async function finishVocabularyTest(id: string, answers: { id: string; choice: number }[]) {
  return resultSchema.parse(await request(`/reviews/vocabulary/test/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) }));
}
