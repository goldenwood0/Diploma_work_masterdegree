import { z } from 'zod';
const localized = z.object({ ru: z.string(), kk: z.string(), en: z.string() });
const option = z.object({ id: z.string(), text: localized });
const common = { id: z.string(), topic: z.enum(["greetings", "introductions", "courtesy"]).optional(), skill: z.enum(["vocabulary", "grammar", "reading", "listening", "writing"]).optional(), prompt: localized, explanation: localized };
export const editorQuestionSchema = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('choice'), options: z.array(option), correct: z.string() }),
  z.object({ ...common, kind: z.literal('order'), options: z.array(option), correct: z.array(z.string()) }),
  z.object({ ...common, kind: z.literal('match'), left: z.array(option), right: z.array(option), correct: z.array(z.string()) }),
  z.object({ ...common, kind: z.literal('gap'), accepted: z.array(z.string()) }),
  z.object({ ...common, kind: z.literal('input'), accepted: z.array(z.string()) }),
  z.object({ ...common, kind: z.literal('dictation'), accepted: z.array(z.string()), audioUrl: z.string(), sourceUrl: z.string(), author: z.string(), license: z.string(), licenseUrl: z.string() }),
]);
export const editorQuizSchema = z.object({ kind: z.enum(['lesson', 'module']), passPercent: z.number(), questions: z.array(editorQuestionSchema) });
export type EditorQuiz = z.infer<typeof editorQuizSchema>;
export type EditorQuestion = z.infer<typeof editorQuestionSchema>;
