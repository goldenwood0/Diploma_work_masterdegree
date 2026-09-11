import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Database } from './database.js';
import { SessionGuard, RequirePermission, type AuthRequest } from './security.js';
import { parse } from './validation.js';
import { titleSchema, updateSchema, createSchema, blocksSchema, editorQuizSchema } from './content.schema.js';

@Controller('content')
@UseGuards(SessionGuard)
export class ContentController {
  constructor(private db: Database) {}
  @Get('units') @RequirePermission('content:edit')
  async units() {
    return { units: await this.db.courseUnit.findMany({ orderBy: [{ levelId: 'asc' }, { position: 'asc' }], select: { id: true, title: true, level: { select: { number: true, curriculum: { select: { title: true } } } } } }) };
  }
  @Post('lessons') @RequirePermission('content:edit')
  async create(@Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(createSchema, body, 'Проверьте поля урока, переводы и HTTPS-ссылки.');
    try {
      return await this.db.$transaction(async db => {
        if (!await db.courseUnit.findUnique({ where: { id: input.unitId } })) throw new NotFoundException('Раздел недоступен.');
        const last = await db.lesson.findFirst({ where: { unitId: input.unitId }, orderBy: { position: 'desc' } });
        const lesson = await db.lesson.create({ data: { ...input, position: (last?.position ?? -1) + 1, prerequisiteId: last?.id ?? null } });
        await db.lessonChange.create({ data: { lessonId: lesson.id, actorId: req.session!.user.id, action: 'CREATE', snapshot: { after: { title: lesson.title, minutes: lesson.minutes, state: 'DRAFT', version: 0, blocks: [] } } } });
        return { id: lesson.id };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(err.code)) throw new ConflictException('Адрес урока занят или раздел изменён. Обновите страницу.');
      throw err;
    }
  }
  @Get('lessons') @RequirePermission('content:edit')
  async list() {
    return { lessons: await this.db.lesson.findMany({ orderBy: [{ unitId: 'asc' }, { position: 'asc' }], select: { id: true, slug: true, title: true, minutes: true, published: true, editorialState: true, editVersion: true, revision: true, unitId: true } }) };
  }
  @Get('lessons/:id') @RequirePermission('content:edit')
  async detail(@Param('id') id: string) {
    const lesson = await this.db.lesson.findUnique({ where: { id }, include: { quiz: true, blocks: { orderBy: { position: 'asc' } }, changes: { orderBy: { createdAt: 'desc' }, take: 30 } } });
    if (!lesson) throw new NotFoundException('Урок недоступен.');
    return lesson;
  }
  @Patch('lessons/:id') @RequirePermission('content:edit')
  async edit(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(updateSchema, body, 'Проверьте поля урока, переводы и HTTPS-ссылки.');
    return this.change(id, input.version, req.session!.user.id, 'EDIT', async (db, lesson) => {
      if (lesson.published || lesson.editorialState !== 'DRAFT') throw new ConflictException('Изменять можно только черновик.');
      let contentChanged = false;
      if (input.blocks) {
        const previous = await db.lessonBlock.findMany({ where: { lessonId: id }, orderBy: { position: 'asc' } });
        const normalized = blocksSchema.safeParse(previous.map(({ kind, content }) => ({ kind, content })));
        contentChanged = !normalized.success || JSON.stringify(normalized.data) !== JSON.stringify(input.blocks);
        if (contentChanged) {
          await db.lessonBlock.deleteMany({ where: { lessonId: id } });
          await db.lessonBlock.createMany({ data: input.blocks.map((block, position) => ({ ...block, lessonId: id, position })) });
        }
      }
      if (input.quiz) {
        const previous = await db.quiz.findUnique({ where: { lessonId: id } });
        const normalized = previous ? editorQuizSchema.safeParse({ kind: previous.kind, passPercent: previous.passPercent, questions: previous.questions }) : null;
        if (!normalized?.success || JSON.stringify(normalized.data) !== JSON.stringify(input.quiz)) {
          await db.quiz.upsert({ where: { lessonId: id }, create: { lessonId: id, ...input.quiz }, update: { ...input.quiz, revision: { increment: 1 } } });
          contentChanged = true;
        }
      }
      return db.lesson.update({ where: { id }, data: { title: input.title, minutes: input.minutes, editVersion: { increment: 1 }, ...(contentChanged ? { revision: { increment: 1 } } : {}) } });
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
        const quiz = await db.quiz.findUnique({ where: { lessonId: id } });
        if (quiz) parse(editorQuizSchema, { kind: quiz.kind, passPercent: quiz.passPercent, questions: quiz.questions }, 'Проверьте задания, правильные ответы и порог прохождения.');
        parse(titleSchema, lesson.title, 'Проверьте поля урока, переводы и HTTPS-ссылки.');
        const blocks = await db.lessonBlock.findMany({ where: { lessonId: id }, orderBy: { position: 'asc' } });
        if (!blocks.length) throw new ConflictException('Нельзя опубликовать урок без блоков.');
        parse(blocksSchema, blocks.map(({ kind, content }) => ({ kind, content })), 'Проверьте поля урока, переводы и HTTPS-ссылки.');
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
        const beforeBlocks = await db.lessonBlock.findMany({ where: { lessonId: id }, orderBy: { position: 'asc' } });
        const beforeQuiz = await db.quiz.findUnique({ where: { lessonId: id } });
        const updated = await update(db, lesson);
        const afterQuiz = await db.quiz.findUnique({ where: { lessonId: id } });
        const afterBlocks = await db.lessonBlock.findMany({ where: { lessonId: id }, orderBy: { position: 'asc' } });
        await db.lessonChange.create({ data: { lessonId: id, actorId, action, snapshot: { before: { title: lesson.title, minutes: lesson.minutes, state: lesson.published ? 'PUBLISHED' : lesson.editorialState, version, revision: lesson.revision, blocks: beforeBlocks, quiz: beforeQuiz }, after: { title: updated.title, minutes: updated.minutes, state: updated.editorialState, version: updated.editVersion, revision: updated.revision, blocks: afterBlocks, quiz: afterQuiz } } } });
        return { ok: true, version: updated.editVersion };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') throw new ConflictException('Урок изменён другим редактором. Обновите страницу.');
      throw err;
    }
  }
}
