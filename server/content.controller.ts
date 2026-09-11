import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Database } from './database.js';
import { SessionGuard, RequirePermission, type AuthRequest } from './security.js';
import { parse } from './validation.js';
const titleSchema = z.object({ ru: z.string().trim().min(1).max(200), kk: z.string().trim().min(1).max(200), en: z.string().trim().min(1).max(200) }).strict();
const updateSchema = z.object({ version: z.number().int().nonnegative(), title: titleSchema, minutes: z.number().int().min(1).max(120) }).strict();

@Controller('content')
@UseGuards(SessionGuard)
export class ContentController {
  constructor(private db: Database) {}
  @Get('lessons') @RequirePermission('content:edit')
  async list() {
    return { lessons: await this.db.lesson.findMany({ orderBy: [{ unitId: 'asc' }, { position: 'asc' }], select: { id: true, slug: true, title: true, minutes: true, published: true, editorialState: true, editVersion: true, revision: true, unitId: true } }) };
  }
  @Get('lessons/:id') @RequirePermission('content:edit')
  async detail(@Param('id') id: string) {
    const lesson = await this.db.lesson.findUnique({ where: { id }, include: { blocks: { orderBy: { position: 'asc' } }, changes: { orderBy: { createdAt: 'desc' }, take: 30 } } });
    if (!lesson) throw new NotFoundException('Урок недоступен.');
    return lesson;
  }
  @Patch('lessons/:id') @RequirePermission('content:edit')
  async edit(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(updateSchema, body);
    return this.change(id, input.version, req.session!.user.id, 'EDIT', async (db, lesson) => {
      if (lesson.published || lesson.editorialState !== 'DRAFT') throw new ConflictException('Изменять можно только черновик.');
      return db.lesson.update({ where: { id }, data: { title: input.title, minutes: input.minutes, editVersion: { increment: 1 } } });
    });
  }
  @Post('lessons/:id/state') @RequirePermission('content:edit')
  async state(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(z.object({ version: z.number().int().nonnegative(), state: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']) }).strict(), body);
    return this.change(id, input.version, req.session!.user.id, input.state, async (db, lesson) => {
      if ((input.state === 'PUBLISHED' || lesson.published || input.state === 'ARCHIVED') && req.session!.user.role !== 'ADMIN') throw new ForbiddenException('Публикация и архив доступны администратору.');
      const current = lesson.published ? 'PUBLISHED' : lesson.editorialState;
      const allowed: Record<string, string[]> = { DRAFT: ['REVIEW'], REVIEW: ['DRAFT', 'PUBLISHED'], PUBLISHED: ['ARCHIVED'], ARCHIVED: ['DRAFT'] };
      if (!allowed[current]?.includes(input.state)) throw new ConflictException('Недопустимый переход состояния.');
      if (input.state === 'PUBLISHED') {
        titleSchema.parse(lesson.title);
        if (!await db.lessonBlock.count({ where: { lessonId: id } })) throw new ConflictException('Нельзя опубликовать урок без блоков.');
      }
      return db.lesson.update({ where: { id }, data: { editorialState: input.state, published: input.state === 'PUBLISHED', editVersion: { increment: 1 } } });
    });
  }
  private async change(id: string, version: number, actorId: string, action: string,
    update: (db: Prisma.TransactionClient, lesson: Prisma.LessonGetPayload<object>) => Promise<Prisma.LessonGetPayload<object>>) {
    try {
      return await this.db.$transaction(async db => {
        const lesson = await db.lesson.findUnique({ where: { id } });
        if (!lesson) throw new NotFoundException('Урок недоступен.');
        if (lesson.editVersion !== version) throw new ConflictException('Урок изменён другим редактором. Обновите страницу.');
        const updated = await update(db, lesson);
        await db.lessonChange.create({ data: { lessonId: id, actorId, action, snapshot: { before: { title: lesson.title, minutes: lesson.minutes, state: lesson.published ? 'PUBLISHED' : lesson.editorialState, version }, after: { title: updated.title, minutes: updated.minutes, state: updated.editorialState, version: updated.editVersion } } } });
        return { ok: true, version: updated.editVersion };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') throw new ConflictException('Урок изменён другим редактором. Обновите страницу.');
      throw err;
    }
  }
}
