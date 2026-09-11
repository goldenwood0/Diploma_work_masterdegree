import { z } from 'zod';
import { request } from './client';
const role = z.enum(['STUDENT', 'EDITOR', 'ADMIN']);
const user = z.object({ id: z.string(), name: z.string(), email: z.string(), role, roleVersion: z.number(), emailVerifiedAt: z.string().nullable(), createdAt: z.string() });
const change = z.object({ id: z.string(), actorId: z.string(), before: role, after: role, reason: z.string(), createdAt: z.string(), actor: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable() });
export type ManagedUser = z.infer<typeof user>;
export type RoleChange = z.infer<typeof change>;
export async function listUsers(search: string, filter: string, page: number, signal: AbortSignal) {
  const params = new URLSearchParams({ search, page: String(page) });
  if (filter) params.set('role', filter);
  return z.array(user).parse(await request(`/admin/users?${params}`, { signal }));
}
export async function roleHistory(id: string, signal: AbortSignal) { return z.array(change).parse(await request(`/admin/users/${encodeURIComponent(id)}/roles`, { signal })); }
export async function setUserRole(target: ManagedUser, role: ManagedUser['role'], reason: string, signal: AbortSignal) {
  return user.parse(await request(`/admin/users/${encodeURIComponent(target.id)}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, signal, body: JSON.stringify({ role, reason, version: target.roleVersion }) }));
}
