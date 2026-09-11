import { z } from 'zod';

const localized = (max: number) => z.object({ ru: z.string().trim().min(1).max(max), kk: z.string().trim().min(1).max(max), en: z.string().trim().min(1).max(max) }).strict();
export const titleSchema = localized(200);
const phrase = { hanzi: z.string().trim().min(1).max(4000), pinyin: z.string().trim().min(1).max(8000), translation: localized(8000) };
const https = z.url().max(2000).refine(value => new URL(value).protocol === 'https:' && !new URL(value).username && !new URL(value).password);
export const blocksSchema = z.array(z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('vocabulary'), content: z.object({ title: titleSchema, words: z.array(z.object(phrase).strict()).min(1).max(100) }).strict() }).strict(),
  z.object({ kind: z.literal('reading'), content: z.object({ title: titleSchema, text: localized(16000), ...phrase }).strict() }).strict(),
  z.object({ kind: z.literal('audio'), content: z.object({ title: titleSchema, ...phrase, audioUrl: https, sourceUrl: https, author: z.string().trim().min(1).max(200), license: z.string().trim().min(1).max(200), licenseUrl: https }).strict() }).strict(),
])).max(40);
export const updateSchema = z.object({ version: z.number().int().nonnegative(), title: titleSchema, minutes: z.number().int().min(1).max(120), blocks: blocksSchema.optional() }).strict();
export const createSchema = z.object({ unitId: z.string().min(1).max(200), slug: z.string().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: titleSchema, minutes: z.number().int().min(1).max(120) }).strict();
