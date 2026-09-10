import { z } from 'zod';
import { request } from './client';
const localized = z.object({ ru: z.string(), kk: z.string(), en: z.string() });
const option = z.object({ id: z.string(), text: localized });
const common = { id: z.string(), prompt: localized };
const question = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('choice'), options: z.array(option) }),
  z.object({ ...common, kind: z.literal('match'), left: z.array(option), right: z.array(option) }),
  z.object({ ...common, kind: z.literal('order'), options: z.array(option) }),
  z.object({ ...common, kind: z.literal('gap') }),
  z.object({ ...common, kind: z.literal('input') }),
  z.object({ ...common, kind: z.literal('dictation'), audioUrl: z.url().startsWith('https://'), sourceUrl: z.url().startsWith('https://'), author: z.string(), license: z.string(), licenseUrl: z.url().startsWith('https://') }),
]);
const value = z.union([z.string(), z.array(z.string())]);
const result = z.object({ score: z.number(), total: z.number(), passed: z.boolean(), passPercent: z.number(), items: z.array(z.object({ question, value, correct: z.boolean(), expected: z.union([z.string(), localized, z.array(localized)]), explanation: localized })) });
const attempt = z.object({ id: z.string(), createdAt: z.string(), quizRevision: z.number(), lessonRevision: z.number(), result });
const quiz = z.object({ id: z.string(), revision: z.number(), lessonRevision: z.number(), passPercent: z.number(), kind: z.string(), questions: z.array(question), attempts: z.array(attempt) });
export type QuizData = z.infer<typeof quiz>;
export type Question = z.infer<typeof question>;
export type Attempt = z.infer<typeof attempt>;
export type Answer = z.infer<typeof value>;
export async function getQuiz(slug: string, signal: AbortSignal) { return quiz.parse(await request(`/learning/lessons/${encodeURIComponent(slug)}/quiz`, { signal })); }
export async function submitQuiz(slug: string, body: { requestId: string; lessonRevision: number; quizRevision: number; answers: Array<{ questionId: string; value: Answer }> }, signal: AbortSignal) {
  return attempt.parse(await request(`/learning/lessons/${encodeURIComponent(slug)}/attempts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }));
}
