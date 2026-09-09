import { z } from 'zod';
import { request } from './client';

const userSchema = z.object({
  id: z.string(), email: z.string(), name: z.string(),
  role: z.enum(['STUDENT', 'EDITOR', 'ADMIN']), emailVerifiedAt: z.string().nullable(),
});
export type Account = z.infer<typeof userSchema>;
export async function currentAccount() {
  return z.object({ user: userSchema }).parse(await request('/auth/me')).user;
}
export async function authAction(action: string, body: Record<string, string> = {}) {
  return request(`/auth/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
