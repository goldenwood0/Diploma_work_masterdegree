import { Body, Controller, Get, Patch, Param, Query, Req, UseGuards, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Database } from './database.js';
import { RequirePermission, SessionGuard, type AuthRequest } from './security.js';
import { parse } from './validation.js';
const role = z.enum(['STUDENT', 'EDITOR', 'ADMIN']);
const fields = { id: true, name: true, email: true, role: true, roleVersion: true, emailVerifiedAt: true, createdAt: true } as const;
const querySchema = z.object({ search: z.string().trim().max(100).default(''), role: role.optional(), page: z.coerce.number().int().min(0).max(10000).default(0) }).strict();

@Controller('admin')
@UseGuards(SessionGuard)
export class AdminController {
  constructor(private db: Database) {}
  @Get('users') @RequirePermission('users:read')
  users(@Query() query: unknown) {
    const input = parse(querySchema, query, 'Проверьте параметры поиска.');
    return this.db.user.findMany({ where: { role: input.role, ...(input.search ? { OR: [{ email: { contains: input.search, mode: 'insensitive' as const } }, { name: { contains: input.search, mode: 'insensitive' as const } }] } : {}) }, select: fields, take: 50, skip: input.page * 50, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
  }
  @Get('users/:id/roles') @RequirePermission('users:read')
  async history(@Param('id') id: string) {
    if (!await this.db.user.findUnique({ where: { id }, select: { id: true } })) throw new NotFoundException('Пользователь не найден.');
    const changes = await this.db.roleChange.findMany({ where: { userId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 30 });
    const actors = await this.db.user.findMany({ where: { id: { in: changes.map(c => c.actorId) } }, select: { id: true, name: true, email: true } });
    return changes.map(c => ({ ...c, actor: actors.find(a => a.id === c.actorId) ?? null }));
  }
  @Patch('users/:id/role') @RequirePermission('users:manage')
  async changeRole(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(z.object({ role, version: z.number().int().nonnegative(), reason: z.string().trim().min(3).max(500) }).strict(), body, 'Укажите роль и причину изменения.');
    const actorId = req.session!.user.id;
    if (id === actorId) throw new ForbiddenException('Свою роль изменять нельзя.');
    try {
      return await this.db.$transaction(async db => {
        // Recheck inside the transaction: another administrator may revoke the actor's role.
        const actor = await db.user.findUnique({ where: { id: actorId } });
        if (actor?.role !== 'ADMIN') throw new ForbiddenException('Недостаточно прав.');
        const user = await db.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('Пользователь не найден.');
        if (user.roleVersion !== input.version) throw new ConflictException('Роль уже изменена. Обновите список.');
        if (user.role === input.role) return db.user.findUniqueOrThrow({ where: { id }, select: fields });
        if (input.role !== 'STUDENT' && !user.emailVerifiedAt) throw new ConflictException('Сначала пользователь должен подтвердить email.');
        if (user.role === 'ADMIN' && await db.user.count({ where: { role: 'ADMIN' } }) <= 1) throw new ConflictException('Нельзя лишить доступа последнего администратора.');
        const updated = await db.user.update({ where: { id }, data: { role: input.role, roleVersion: { increment: 1 } }, select: fields });
        await db.session.deleteMany({ where: { userId: id } });
        await db.roleChange.create({ data: { userId: id, actorId, before: user.role, after: input.role, reason: input.reason } });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ConflictException('Роль уже изменена. Обновите список.');
      throw error;
    }
  }
}
