import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const localized = z.object({ ru: z.string().min(1), kk: z.string().min(1), en: z.string().min(1) });
const option = z.object({ id: z.string().min(1), text: localized });
const common = { id: z.string().min(1), prompt: localized, explanation: localized };
const textAnswer = { accepted: z.array(z.string().min(1)).min(1) };
const question = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('choice'), options: z.array(option).min(2), correct: z.string() }),
  z.object({ ...common, kind: z.literal('match'), left: z.array(option).min(2), right: z.array(option).min(2), correct: z.array(z.string()) }),
  z.object({ ...common, kind: z.literal('order'), options: z.array(option).min(2), correct: z.array(z.string()) }),
  z.object({ ...common, kind: z.literal('gap'), ...textAnswer }),
  z.object({ ...common, kind: z.literal('input'), ...textAnswer }),
  z.object({ ...common, kind: z.literal('dictation'), ...textAnswer, audioUrl: z.url().startsWith('https://'), sourceUrl: z.url().startsWith('https://'), author: z.string(), license: z.string(), licenseUrl: z.url().startsWith('https://') }),
]);
export const questionsSchema = z.array(question).min(1).max(30).superRefine((questions, ctx) => {
  const reject = () => ctx.addIssue({ code: 'custom', message: 'Invalid question keys or answer configuration' });
  if (new Set(questions.map(q => q.id)).size !== questions.length) reject();
  for (const q of questions) {
    if ('options' in q) {
      const ids = q.options.map(o => o.id);
      if (new Set(ids).size !== ids.length) reject();
      if (q.kind === 'choice' && !ids.includes(q.correct)) reject();
      if (q.kind === 'order' && (q.correct.length !== ids.length || new Set(q.correct).size !== ids.length || q.correct.some(id => !ids.includes(id)))) reject();
    }
    if (q.kind === 'match') {
      const ids = q.right.map(o => o.id);
      if (new Set(ids).size !== ids.length || new Set(q.left.map(o => o.id)).size !== q.left.length || q.left.length !== ids.length || q.correct.length !== ids.length || new Set(q.correct).size !== ids.length || q.correct.some(id => !ids.includes(id))) reject();
    }
  }
});
export type Question = z.infer<typeof question>;
export const answerSchema = z.union([z.string().max(500), z.array(z.string().max(100)).max(30)]);
export const submissionSchema = z.object({
  requestId: z.uuid(), lessonRevision: z.number().int().positive(), quizRevision: z.number().int().positive(),
  answers: z.array(z.object({ questionId: z.string().max(100), value: answerSchema }).strict()).max(30),
}).strict();
export type Answers = z.infer<typeof submissionSchema>['answers'];

export function publicQuestion(q: Question) {
  const { explanation, ...rest } = q;
  if ('correct' in rest) { const { correct, ...visible } = rest; return visible; }
  const { accepted, ...visible } = rest;
  return visible;
}
// Ignore spacing, case, Unicode width and punctuation. Do not erase tone marks,
// reorder characters or accept synonyms that the editor has not explicitly listed.
export const normalizeAnswer = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu, '');
export function grade(questions: Question[], answers: Answers, passPercent: number) {
  if (answers.length !== questions.length || new Set(answers.map(a => a.questionId)).size !== questions.length || answers.some(a => !questions.some(q => q.id === a.questionId))) throw new BadRequestException('Ответьте на все задания.');
  const result = questions.map(q => {
    const value = answers.find(a => a.questionId === q.id)!.value;
    let correct = false;
    if (q.kind === 'match' || q.kind === 'order') {
      const allowed = (q.kind === 'match' ? q.right : q.options).map(o => o.id);
      if (!Array.isArray(value) || value.length !== q.correct.length || new Set(value).size !== value.length || value.some(id => !allowed.includes(id))) throw new BadRequestException('Проверьте формат ответа.');
      correct = value.every((id, index) => id === q.correct[index]);
    } else {
      if (typeof value !== 'string' || !value.trim()) throw new BadRequestException('Ответьте на все задания.');
      if (q.kind === 'choice') {
        if (!q.options.some(o => o.id === value)) throw new BadRequestException('Проверьте формат ответа.');
        correct = value === q.correct;
      } else correct = q.accepted.some(expected => normalizeAnswer(expected) === normalizeAnswer(value));
    }
    const expected = q.kind === 'choice' ? q.options.find(o => o.id === q.correct)!.text : q.kind === 'order' || q.kind === 'match' ? q.correct.map(id => (q.kind === 'match' ? q.right : q.options).find(o => o.id === id)!.text) : q.accepted[0];
    return { question: publicQuestion(q), value, correct, expected, explanation: q.explanation };
  });
  const score = result.filter(r => r.correct).length;
  return { score, total: questions.length, passed: score * 100 >= passPercent * questions.length, passPercent, items: result };
}
