import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Post,
  HttpCode,
} from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { Database } from "./database.js"
import { SessionGuard, type AuthRequest } from "./security.js"
import { parse } from "./validation.js"
import { grade, publicQuestion, questionsSchema, submissionSchema } from './quiz.js'
import { digest } from './passwords.js'

const checkpoint = z
  .object({
    blockId: z.string().min(1).max(100),
    revision: z.number().int().positive(),
  })
  .strict()
const emptyProgress = (revision: number) => ({
  nextBlock: 0,
  revision,
  completedAt: null,
})

@Controller("learning")
@UseGuards(SessionGuard)
export class LearningController {
  constructor(private db: Database) {}

  @Get("catalog")
  async catalog(@Req() req: AuthRequest) {
    const userId = req.session!.user.id
    const [curricula, progress] = await this.db.$transaction([
      this.db.curriculum.findMany({
        orderBy: { id: "asc" },
        include: {
          levels: {
            orderBy: { number: "asc" },
            include: {
              units: {
                orderBy: { position: "asc" },
                include: {
                  lessons: {
                    where: { published: true, blocks: { some: {} } },
                    orderBy: { position: "asc" },
                    include: {
                      _count: { select: { blocks: true } },
                      prerequisite: { select: { revision: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.db.lessonProgress.findMany({ where: { userId } }),
    ])
    const byLesson = new Map(progress.map((p) => [p.lessonId, p]))
    return {
      curricula: curricula.map((c) => ({
        ...c,
        levels: c.levels.map((level) => ({
          ...level,
          units: level.units.map((unit) => ({
            ...unit,
            lessons: unit.lessons.map((lesson) => ({
              id: lesson.id,
              slug: lesson.slug,
              title: lesson.title,
              minutes: lesson.minutes,
              blockCount: lesson._count.blocks,
              locked:
                !!lesson.prerequisiteId &&
                (!byLesson.get(lesson.prerequisiteId)?.completedAt ||
                  byLesson.get(lesson.prerequisiteId)?.revision !==
                    lesson.prerequisite?.revision),
              progress:
                byLesson.get(lesson.id)?.revision === lesson.revision
                  ? byLesson.get(lesson.id)
                  : emptyProgress(lesson.revision),
            })),
          })),
        })),
      })),
    }
  }

  private async accessible(
    db: Prisma.TransactionClient,
    slug: string,
    userId: string,
  ) {
    const lesson = await db.lesson.findUnique({
      where: { slug },
      include: {
        blocks: { orderBy: { position: "asc" } },
        prerequisite: { select: { revision: true } },
        quiz: { select: { id: true, revision: true, passPercent: true, kind: true } },
      },
    })
    if (!lesson?.published || !lesson.blocks.length)
      throw new NotFoundException("Урок недоступен.")
    if (lesson.prerequisiteId) {
      const prior = await db.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId: lesson.prerequisiteId } },
      })
      if (
        !prior?.completedAt ||
        prior.revision !== lesson.prerequisite?.revision
      )
        throw new ForbiddenException("Сначала завершите предыдущий урок.")
    }
    return lesson
  }

  @Get("lessons/:slug")
  async lesson(@Param("slug") slug: string, @Req() req: AuthRequest) {
    const userId = req.session!.user.id
    const lesson = await this.accessible(this.db, slug, userId)
    const progress = await this.db.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
    })
    return {
      ...lesson,
      progress:
        progress?.revision === lesson.revision
          ? progress
          : emptyProgress(lesson.revision),
    }
  }

  @Put("lessons/:slug/progress")
  async progress(
    @Param("slug") slug: string,
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const input = parse(checkpoint, body)
    const userId = req.session!.user.id
    try {
      return await this.db.$transaction(
        async (db) => {
          const lesson = await this.accessible(db, slug, userId)
          if (input.revision !== lesson.revision)
            throw new ConflictException("Урок обновлён. Откройте его заново.")
          const where = { userId_lessonId: { userId, lessonId: lesson.id } }
          const stored = await db.lessonProgress.findUnique({ where })
          const current =
            stored?.revision === lesson.revision
              ? stored
              : emptyProgress(lesson.revision)
          const index = lesson.blocks.findIndex((b) => b.id === input.blockId)
          if (index < 0 || index > current.nextBlock)
            throw new ConflictException("Пройдите блоки по порядку.")
          // Retries and older tabs cannot move the checkpoint backwards or complete twice.
          if (index < current.nextBlock) return current
          const data = {
            nextBlock: index + 1,
            revision: lesson.revision,
            completedAt: index + 1 === lesson.blocks.length && !lesson.quiz ? new Date() : null,
          }
          return db.lessonProgress.upsert({
            where,
            create: { userId, lessonId: lesson.id, ...data },
            update: data,
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code)
      ) {
        throw new ConflictException("Прогресс изменился. Повторите сохранение.")
      }
      throw error
    }
  }

  @Get('lessons/:slug/quiz')
  async quiz(@Param('slug') slug: string, @Req() req: AuthRequest) {
    const userId = req.session!.user.id;
    const lesson = await this.accessible(this.db, slug, userId);
    const progress = await this.db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } } });
    if (progress?.revision !== lesson.revision || progress.nextBlock !== lesson.blocks.length) throw new ForbiddenException('Сначала прочитайте все блоки урока.');
    const quiz = await this.db.quiz.findUnique({ where: { lessonId: lesson.id } });
    if (!quiz) throw new NotFoundException('Тест недоступен.');
    const attempts = await this.db.quizAttempt.findMany({ where: { userId, quizId: quiz.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10,
      select: { id: true, createdAt: true, quizRevision: true, lessonRevision: true, result: true } });
    return { id: quiz.id, revision: quiz.revision, lessonRevision: lesson.revision, passPercent: quiz.passPercent, kind: quiz.kind,
      questions: questionsSchema.parse(quiz.questions).map(publicQuestion), attempts };
  }

  @Post('lessons/:slug/attempts')
  @HttpCode(200)
  async submit(@Param('slug') slug: string, @Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(submissionSchema, body);
    const userId = req.session!.user.id;
    const requestHash = digest(JSON.stringify({ slug, lessonRevision: input.lessonRevision, quizRevision: input.quizRevision,
      answers: [...input.answers].sort((a, b) => a.questionId.localeCompare(b.questionId)) }));
    try {
      return await this.db.$transaction(async db => {
        const previous = await db.quizAttempt.findUnique({ where: { userId_requestId: { userId, requestId: input.requestId } } });
        if (previous) {
          if (previous.requestHash !== requestHash) throw new ConflictException('Этот запрос уже содержит другой ответ.');
          return { id: previous.id, createdAt: previous.createdAt, quizRevision: previous.quizRevision, lessonRevision: previous.lessonRevision, result: previous.result };
        }
        const lesson = await this.accessible(db, slug, userId);
        const quiz = await db.quiz.findUnique({ where: { lessonId: lesson.id } });
        if (!quiz) throw new NotFoundException('Тест недоступен.');
        if (quiz.revision !== input.quizRevision || lesson.revision !== input.lessonRevision) throw new ConflictException('Урок обновлён. Откройте его заново.');
        const where = { userId_lessonId: { userId, lessonId: lesson.id } };
        const progress = await db.lessonProgress.findUnique({ where });
        if (progress?.revision !== lesson.revision || progress.nextBlock !== lesson.blocks.length) throw new ForbiddenException('Сначала прочитайте все блоки урока.');
        const questions = questionsSchema.parse(quiz.questions);
        const result = grade(questions, input.answers, quiz.passPercent);
        const attempt = await db.quizAttempt.create({ data: { userId, quizId: quiz.id, requestId: input.requestId, requestHash,
          quizRevision: quiz.revision, lessonRevision: lesson.revision, snapshot: { questions, passPercent: quiz.passPercent, kind: quiz.kind },
          answers: input.answers, result, score: result.score, total: result.total, passed: result.passed } });
        if (result.passed && !progress.completedAt) await db.lessonProgress.update({ where, data: { completedAt: new Date() } });
        return { id: attempt.id, createdAt: attempt.createdAt, quizRevision: attempt.quizRevision, lessonRevision: attempt.lessonRevision, result: attempt.result };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) throw new ConflictException('Прогресс изменился. Повторите сохранение.');
      throw error;
    }
  }
}
