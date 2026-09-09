import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(12).max(128);
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();
export const registerSchema = credentialsSchema.extend({ name: z.string().trim().min(1).max(80), uiLanguage: z.enum(['ru', 'kk', 'en']).default('ru') });
export function parse<T>(schema: z.ZodType<T>, value: unknown, message = 'Проверьте поля формы. Пароль должен содержать от 12 до 128 символов.'): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException(message);
  return parsed.data;
}
