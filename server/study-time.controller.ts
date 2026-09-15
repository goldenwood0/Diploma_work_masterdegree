import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import { z } from "zod"
import { Database } from "./database.js"
import { SessionGuard, type AuthRequest } from "./security.js"
import { parse } from "./validation.js"
import { uncovered } from "./study-time.js"

const inputSchema = z
  .object({
    accountId: z.string(),
    requestId: z.uuid(),
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime(),
    source: z.enum(["lesson", "reviews"]),
    lessonSlug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(200)
      .nullable(),
  })
  .strict()
  .refine((value) =>
    value.source === "lesson" ? !!value.lessonSlug : value.lessonSlug === null,
  )

@Controller("learning/time")
@UseGuards(SessionGuard)
export class StudyTimeController {
  constructor(private db: Database) {}
  @Get()
  clock(@Req() req: AuthRequest) {
    return {
      serverNow: new Date().toISOString(),
      accountId: req.session!.user.id,
    }
  }

  @Post()
  @HttpCode(200)
  async record(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(inputSchema, body)
    const userId = req.session!.user.id
    if (input.accountId !== userId)
      throw new ConflictException("Account changed")
    const startAt = new Date(input.startAt),
      endAt = new Date(input.endAt)
    return this.db.$transaction(async (db) => {
      // Serialize this learner's windows across tabs/devices, without locking other learners.
      await db.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
      const prior = await db.studyTimeEntry.findUnique({
        where: { userId_requestId: { userId, requestId: input.requestId } },
      })
      if (prior) {
        if (
          +prior.startAt !== +startAt ||
          +prior.endAt !== +endAt ||
          prior.source !== input.source ||
          prior.lessonSlug !== input.lessonSlug
        )
          throw new ConflictException("Time request changed")
        return { creditedMs: prior.creditedMs }
      }
      const now = Date.now()
      if (
        +endAt <= +startAt ||
        +endAt - +startAt > 30000 ||
        +startAt < now - 120000 ||
        +endAt > now
      )
        throw new ConflictException("Time window expired")
      if (input.source === "lesson") {
        const lesson = await db.lesson.findUnique({
          where: { slug: input.lessonSlug! },
          include: { prerequisite: true, _count: { select: { blocks: true } } },
        })
        if (!lesson?.published || !lesson._count.blocks)
          throw new NotFoundException()
        if (lesson.prerequisiteId) {
          const progress = await db.lessonProgress.findUnique({
            where: {
              userId_lessonId: { userId, lessonId: lesson.prerequisiteId },
            },
          })
          if (
            !progress?.completedAt ||
            progress.revision !== lesson.prerequisite?.revision
          )
            throw new NotFoundException()
        }
      }
      const overlaps = await db.studyTimeEntry.findMany({
        where: { userId, startAt: { lt: endAt }, endAt: { gt: startAt } },
        select: { startAt: true, endAt: true },
      })
      const segments = uncovered(
        +startAt,
        +endAt,
        overlaps.map((row) => [+row.startAt, +row.endAt]),
      )
      const creditedMs = segments.reduce((sum, [a, b]) => sum + b - a, 0)
      const { accountId: _accountId, ...entry } = input
      await db.studyTimeEntry.create({
        data: { ...entry, startAt, endAt, userId, segments, creditedMs },
      })
      return { creditedMs }
    })
  }
}
