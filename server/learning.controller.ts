import { Body, Controller, Get, Param, Put, Req, UseGuards, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Database } from './database.js';
import { SessionGuard, type AuthRequest } from './security.js';
import { parse } from './validation.js';

const checkpoint = z.object({ blockId: z.string().min(1).max(100), revision: z.number().int().positive() }).strict();
const emptyProgress = (revision: number) => ({ nextBlock: 0, revision, completedAt: null });

@Controller('learning')
@UseGuards(SessionGuard)
export class LearningController {
  constructor(private db: Database) {}

  @Get('catalog')
  async catalog(@Req() req: AuthRequest) {
    const userId = req.session!.user.id;
    const [curricula, progress] = await this.db.$transaction([
      this.db.curriculum.findMany({ orderBy: { id: 'asc' }, include: { levels: { orderBy: { number: 'asc' }, include: {
        units: { orderBy: { position: 'asc' }, include: { lessons: { where: { published: true, blocks: { some: {} } }, orderBy: { position: 'asc' },
          include: { _count: { select: { blocks: true } } } } } },
      } } } }),
      this.db.lessonProgress.findMany({ where: { userId } }),
    ]);
    const byLesson = new Map(progress.map(p => [p.lessonId, p]));
    return { curricula: curricula.map(c => ({ ...c, levels: c.levels.map(level => ({ ...level, units: level.units.map(unit => ({
      ...unit, lessons: unit.lessons.map(lesson => ({
        id: lesson.id, slug: lesson.slug, title: lesson.title, minutes: lesson.minutes, blockCount: lesson._count.blocks,
        locked: !!lesson.prerequisiteId && !byLesson.get(lesson.prerequisiteId)?.completedAt,
        progress: byLesson.get(lesson.id)?.revision === lesson.revision ? byLesson.get(lesson.id) : emptyProgress(lesson.revision),
      })),
    })) })) })) };
  }

  private async accessible(db: Prisma.TransactionClient, slug: string, userId: string) {
    const lesson = await db.lesson.findUnique({ where: { slug }, include: { blocks: { orderBy: { position: 'asc' } } } });
    if (!lesson?.published || !lesson.blocks.length) throw new NotFoundException('Урок недоступен.');
    if (lesson.prerequisiteId) {
      const prior = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.prerequisiteId } } });
      if (!prior?.completedAt) throw new ForbiddenException('Сначала завершите предыдущий урок.');
    }
    return lesson;
  }

  @Get('lessons/:slug')
  async lesson(@Param('slug') slug: string, @Req() req: AuthRequest) {
    const userId = req.session!.user.id;
    const lesson = await this.accessible(this.db, slug, userId);
    const progress = await this.db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } } });
    return { ...lesson, progress: progress?.revision === lesson.revision ? progress : emptyProgress(lesson.revision) };
  }

  @Put('lessons/:slug/progress')
  async progress(@Param('slug') slug: string, @Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(checkpoint, body);
    const userId = req.session!.user.id;
    try {
      return await this.db.$transaction(async db => {
        const lesson = await this.accessible(db, slug, userId);
        if (input.revision !== lesson.revision) throw new ConflictException('Урок обновлён. Откройте его заново.');
        const where = { userId_lessonId: { userId, lessonId: lesson.id } };
        const stored = await db.lessonProgress.findUnique({ where });
        const current = stored?.revision === lesson.revision ? stored : emptyProgress(lesson.revision);
        const index = lesson.blocks.findIndex(b => b.id === input.blockId);
        if (index < 0 || index > current.nextBlock) throw new ConflictException('Пройдите блоки по порядку.');
        // Retries and older tabs cannot move the checkpoint backwards or complete twice.
        if (index < current.nextBlock) return current;
        const data = { nextBlock: index + 1, revision: lesson.revision, completedAt: index + 1 === lesson.blocks.length ? new Date() : null };
        return db.lessonProgress.upsert({ where, create: { userId, lessonId: lesson.id, ...data }, update: data });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) {
        throw new ConflictException('Прогресс изменился. Повторите сохранение.');
      }
      throw error;
    }
  }
}
