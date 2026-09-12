import { localAudio } from './media.schema.js';
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Database } from './database.js';
import { SessionGuard, RequirePermission, type AuthRequest } from './security.js';
import { parse } from './validation.js';
import { draftSchema, titleSchema, updateSchema, createSchema, blocksSchema, editorQuizSchema } from './content.schema.js';

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
    const draft = lesson.draft ? parse(draftSchema, lesson.draft) : null;
    return { ...lesson, ...(draft ? { ...draft, blocks: draft.blocks.map((b, i) => ({ ...b, id: `draft-${i}` })) } : {}), hasDraft: !!draft };
  }
  @Patch('lessons/:id') @RequirePermission('content:edit')
  async edit(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(updateSchema, body, 'Проверьте поля урока, переводы и HTTPS-ссылки.');
    return this.change(id, input.version, req.session!.user.id, 'EDIT', async (db, lesson) => {
      if (lesson.draft) {
        if (lesson.editorialState !== 'DRAFT') throw new ConflictException('Изменять можно только черновик.');
        const previous = parse(draftSchema, lesson.draft);
        const draft = parse(draftSchema, { ...previous, title: input.title, minutes: input.minutes, ...(input.blocks ? { blocks: input.blocks } : {}), ...(input.quiz ? { quiz: input.quiz } : {}) });
        await this.validateDraftMedia(db, draft);
        return db.lesson.update({ where: { id }, data: { draft, editVersion: { increment: 1 } } });
      }
      if (lesson.published || lesson.editorialState !== 'DRAFT') throw new ConflictException('Изменять можно только черновик.');
      return this.applyContent(db, id, input);
    });
  }
  @Post('lessons/:id/draft') @RequirePermission('content:edit')
  async startDraft(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(z.object({ version: z.number().int().nonnegative() }).strict(), body);
    return this.change(id, input.version, req.session!.user.id, 'DRAFT_CREATE', async (db, lesson) => {
      if (!lesson.published || lesson.draft) throw new ConflictException('Черновик уже существует или урок не опубликован.');
      const blocks = await db.lessonBlock.findMany({ where: { lessonId: id }, orderBy: { position: 'asc' } });
      const quiz = await db.quiz.findUnique({ where: { lessonId: id } });
      const draft = this.snapshotContent({ ...lesson, blocks, quiz });
      return db.lesson.update({ where: { id }, data: { draft, editorialState: 'DRAFT', editVersion: { increment: 1 } } });
    });
  }
  @Post('lessons/:id/restore') @RequirePermission('content:edit')
  async restore(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(z.object({ version: z.number().int().nonnegative(), changeId: z.string().uuid() }).strict(), body);
    return this.change(id, input.version, req.session!.user.id, `RESTORE:${input.changeId}`, async (db, lesson) => {
      if (lesson.draft ? lesson.editorialState !== 'DRAFT' : !lesson.published && lesson.editorialState !== 'DRAFT') throw new ConflictException('Изменять можно только черновик.');
      const entry = await db.lessonChange.findFirst({ where: { id: input.changeId, lessonId: id } });
      if (!entry) throw new NotFoundException('Версия недоступна.');
      const snapshot = parse(z.object({ after: z.record(z.string(), z.unknown()) }), entry.snapshot).after;
      const draft = snapshot.draft ? parse(draftSchema, snapshot.draft) : this.snapshotContent(snapshot);
      if (!draft.quiz && await db.quiz.findUnique({ where: { lessonId: id } })) throw new ConflictException('Версия без теста не может заменить существующий тест.');
      await this.validateDraftMedia(db, draft);
      return db.lesson.update({ where: { id }, data: { draft, editorialState: 'DRAFT', editVersion: { increment: 1 } } });
    });
  }
  private snapshotContent(value: Record<string, unknown>) {
    const blocks = parse(z.array(z.object({ kind: z.string(), content: z.unknown() })), value.blocks);
    const quiz = value.quiz ? parse(z.object({ kind: z.string(), passPercent: z.number(), questions: z.unknown() }), value.quiz) : null;
    return parse(draftSchema, { title: value.title, minutes: value.minutes, blocks, quiz });
  }
  private async applyContent(db: Prisma.TransactionClient, id: string, input: z.infer<typeof updateSchema>) {
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
      await this.validateMedia(db, id);
      return db.lesson.update({ where: { id }, data: { title: input.title, minutes: input.minutes, editVersion: { increment: 1 }, ...(contentChanged ? { revision: { increment: 1 } } : {}) } });
  }
  private async validateDraftMedia(db: Prisma.TransactionClient, draft: z.infer<typeof draftSchema>) {
    for (const value of [...draft.blocks.map(b => b.content), ...(draft.quiz?.questions ?? [])]) {
      if (!('audioUrl' in value) || !localAudio.test(value.audioUrl)) continue;
      if (!await db.mediaAsset.findUnique({ where: { id: value.audioUrl.split('/')[3] } })) throw new ConflictException('Указанный файл отсутствует в медиатеке.');
    }
  }
  @Post('lessons/:id/state') @RequirePermission('content:edit')
  async state(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(z.object({ version: z.number().int().nonnegative(), state: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']) }).strict(), body);
    return this.change(id, input.version, req.session!.user.id, input.state, async (db, lesson) => {
      if (lesson.draft) {
        const allowed: Record<string, string[]> = { DRAFT: ['REVIEW'], REVIEW: ['DRAFT', 'PUBLISHED'] };
        if (!allowed[lesson.editorialState]?.includes(input.state)) throw new ConflictException('Недопустимый переход состояния.');
        if (input.state !== 'PUBLISHED') return db.lesson.update({ where: { id }, data: { editorialState: input.state, editVersion: { increment: 1 } } });
        if (req.session!.user.role !== 'ADMIN') throw new ForbiddenException('Публикация и архив доступны администратору.');
        const draft = parse(draftSchema, lesson.draft);
        if (!draft.blocks.length) throw new ConflictException('Нельзя опубликовать урок без блоков.');
        await this.validateDraftMedia(db, draft);
        await this.applyContent(db, id, { version: input.version, ...draft, quiz: draft.quiz ?? undefined });
        return db.lesson.update({ where: { id }, data: { published: true, editorialState: 'PUBLISHED', draft: Prisma.DbNull } });
      }
      if ((input.state === 'PUBLISHED' || lesson.published || input.state === 'ARCHIVED') && req.session!.user.role !== 'ADMIN') throw new ForbiddenException('Публикация и архив доступны администратору.');
      const current = lesson.published ? 'PUBLISHED' : lesson.editorialState;
      const allowed: Record<string, string[]> = { DRAFT: ['REVIEW'], REVIEW: ['DRAFT', 'PUBLISHED'], PUBLISHED: ['ARCHIVED'], ARCHIVED: ['DRAFT'] };
      if (!allowed[current]?.includes(input.state)) throw new ConflictException('Недопустимый переход состояния.');
      if (input.state === 'PUBLISHED') {
        await this.validateMedia(db, id);
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
  private async validateMedia(db: Prisma.TransactionClient, lessonId: string) {
    const blocks = await db.lessonBlock.findMany({ where: { lessonId }, select: { content: true } });
    const quiz = await db.quiz.findUnique({ where: { lessonId }, select: { questions: true } });
    const objects = [...blocks.map(b => b.content), ...(Array.isArray(quiz?.questions) ? quiz.questions : [])];
    for (const value of objects) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.audioUrl !== 'string' || !localAudio.test(value.audioUrl)) continue;
      const asset = await db.mediaAsset.findUnique({ where: { id: value.audioUrl.split('/')[3] }, select: { id: true } });
      if (!asset) throw new ConflictException('Указанный файл отсутствует в медиатеке.');
    }
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
        await db.lessonChange.create({ data: { lessonId: id, actorId, action, snapshot: { before: { draft: lesson.draft, title: lesson.title, minutes: lesson.minutes, state: lesson.published ? 'PUBLISHED' : lesson.editorialState, version, revision: lesson.revision, blocks: beforeBlocks, quiz: beforeQuiz }, after: { draft: updated.draft, title: updated.title, minutes: updated.minutes, state: updated.editorialState, version: updated.editVersion, revision: updated.revision, blocks: afterBlocks, quiz: afterQuiz } } } });
        return { ok: true, version: updated.editVersion };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') throw new ConflictException('Урок изменён другим редактором. Обновите страницу.');
      throw err;
    }
  }
}
