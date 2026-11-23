import { z } from 'zod';
import type { Answer, QuizData } from './quiz';

const draftSchema = z.object({
  schema: z.literal(1), userId: z.string(), quizId: z.string(),
  quizRevision: z.number().int(), lessonRevision: z.number().int(),
  answers: z.record(z.string(), z.union([z.string().max(500), z.array(z.string().max(100)).max(30)])),
  requestId: z.uuid().nullable(),
});
export type QuizDraft = z.infer<typeof draftSchema>;
export const draftKey = (userId: string, quizId: string) => `zhpath:quiz-draft:1:${encodeURIComponent(userId)}:${encodeURIComponent(quizId)}`;
export function makeDraft(userId: string, quiz: QuizData, answers: Record<string, Answer>, requestId: string | null = null): QuizDraft {
  return { schema: 1, userId, quizId: quiz.id, quizRevision: quiz.revision, lessonRevision: quiz.lessonRevision, answers, requestId };
}
export function readDraft(userId: string, quiz: QuizData, memory?: QuizDraft | null) {
  let raw: unknown = memory;
  if (!raw) {
    const stored = localStorage.getItem(draftKey(userId, quiz.id));
    try { raw = JSON.parse(stored ?? 'null'); }
    catch { return { status: 'invalid' as const, draft: null }; }
  }
  if (!raw) return { status: 'empty' as const, draft: null };
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success || parsed.data.userId !== userId || parsed.data.quizId !== quiz.id) return { status: 'invalid' as const, draft: null };
  const draft = parsed.data;
  if (draft.quizRevision !== quiz.revision || draft.lessonRevision !== quiz.lessonRevision) return { status: 'outdated' as const, draft: null };
  for (const [id, value] of Object.entries(draft.answers)) {
    const q = quiz.questions.find(q => q.id === id);
    if (!q) return { status: 'invalid' as const, draft: null };
    const valid = q.kind === 'match' || q.kind === 'order'
      ? Array.isArray(value) && value.length <= (q.kind === 'match' ? q.left.length : q.options.length) && value.every(v => v === '' || (q.kind === 'match' ? q.right : q.options).some(o => o.id === v))
      : typeof value === 'string' && (q.kind !== 'choice' || q.options.some(o => o.id === value));
    if (!valid) return { status: 'invalid' as const, draft: null };
  }
  return { status: 'restored' as const, draft };
}
export function writeDraft(draft: QuizDraft) {
  localStorage.setItem(draftKey(draft.userId, draft.quizId), JSON.stringify(draft));
}
export function clearDraft(userId: string, quizId: string) {
  // A tombstone also prevents resurrection if removeItem fails after a successful write.
  localStorage.setItem(draftKey(userId, quizId), 'null');
  localStorage.removeItem(draftKey(userId, quizId));
}
