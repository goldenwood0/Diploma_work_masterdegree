import { z } from 'zod';
import { request, ApiError } from './client';
export type TutorMode = 'explain' | 'check' | 'dialogue' | 'practice';
export type TutorTurn = { role: 'user' | 'assistant'; text: string };
const provider = z.enum(['unconfigured', 'test', 'live']);
const response = z.object({ text: z.string().min(1).max(6000), provider });
export async function tutorStatus(signal: AbortSignal) {
  return z.object({ provider }).parse(await request('/tutor/status', { signal }));
}
export async function askTutor(input: { lessonSlug: string; mode: TutorMode; text: string; history: TutorTurn[] }, signal: AbortSignal) {
  return response.parse(await request('/tutor/ask', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }));
}
export function tutorError(error: unknown) {
  if (!(error instanceof ApiError)) return 'Помощник вернул некорректный ответ.';
  if (error.status === 503) return 'ИИ-провайдер пока не настроен. Ответы ИИ недоступны.';
  if (error.status === 429) return 'Лимит запросов. Подождите минуту и повторите.';
  if (error.status === 402) return 'Бюджет ИИ исчерпан или его учёт недоступен. Обратитесь к администратору.';
  if (error.status === 504) return 'Помощник не успел ответить. Попробуйте ещё раз.';
  if (error.status === 401) return 'Сессия завершена. Войдите ещё раз.';
  if (error.status === 403 || error.status === 404) return 'Этот урок недоступен для помощника.';
  if (error.status === 413) return 'Слишком много текста. Сократите сообщение или начните заново.';
  return 'Не удалось получить ответ помощника. Повторите запрос.';
}
