import { z } from 'zod';
import { request } from './client';

const userSchema = z.object({
  id: z.string(), email: z.string(), name: z.string(),
  role: z.enum(['STUDENT', 'EDITOR', 'ADMIN']), emailVerifiedAt: z.string().nullable(),
  settings: z.object({
    uiLanguage: z.enum(['ru', 'kk', 'en']), explanationLanguage: z.enum(['ru', 'kk', 'en']),
    timezone: z.string(), dailyGoalMinutes: z.number(), startLevel: z.number(),
    experience: z.enum(['beginner', 'some', 'experienced']),
    goal: z.enum(['communication', 'study', 'work', 'exam']),
    remindersEnabled: z.boolean(), onboardingCompletedAt: z.string().nullable(),
  }).nullable(),
});
export type Account = z.infer<typeof userSchema>;
export type Settings = NonNullable<Account['settings']>;
export type ProfileInput = Omit<Settings, 'onboardingCompletedAt'> & { name: string; completeOnboarding?: boolean };
export async function saveProfile(body: ProfileInput) {
  return z.object({ user: userSchema }).parse(await request('/profile', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })).user;
}
export async function currentAccount() {
  return z.object({ user: userSchema }).parse(await request('/auth/me')).user;
}
export async function authAction(action: string, body: Record<string, string> = {}) {
  return request(`/auth/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
