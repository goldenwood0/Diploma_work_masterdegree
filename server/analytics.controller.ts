import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import { Database } from "./database.js"
import { Prisma } from "@prisma/client"
import { SessionGuard, type AuthRequest } from "./security.js"
import { activitySummary, exerciseSummary, localDay, accuracySummary } from "./analytics.js"
import { timeByDay, type Segment } from "./study-time.js"
import { shiftDay } from "./analytics.js"

@Controller("learning")
@UseGuards(SessionGuard)
export class AnalyticsController {
  constructor(private db: Database) {}

  @Get("stats")
  async stats(@Req() req: AuthRequest) {
    const userId = req.session!.user.id
    const timezone = req.session!.user.settings?.timezone ?? "UTC"
    const canonical = new Intl.DateTimeFormat("en", { timeZone: timezone }).resolvedOptions().timeZone
    // Intl accepts numeric offsets; use an interval to avoid PostgreSQL's
    // opposite POSIX sign convention for textual timezone offsets.
    const offset = /^([+-])(\d{2}):(\d{2})$/.exec(canonical)
    const zone = offset
      ? Prisma.sql`(${(Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === "-" ? -1 : 1)} * INTERVAL '1 minute')`
      : Prisma.sql`${canonical}::text`
    const now = new Date()
    const since = new Date(now.getTime() - 30 * 86400000)
    const [days, attempts, timeEntries, timeTotal] = await this.db.$transaction([
      this.db.$queryRaw<Array<{ day: string }>>`
        SELECT DISTINCT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE (${zone}), 'YYYY-MM-DD') AS day
        FROM (
          SELECT "createdAt" FROM "StudyActivity" WHERE "userId" = ${userId} AND "createdAt" <= ${now}
          UNION ALL
          SELECT "createdAt" FROM "QuizAttempt" WHERE "userId" = ${userId} AND "createdAt" <= ${now}
          UNION ALL
          SELECT "createdAt" FROM "ReviewEvent" WHERE "userId" = ${userId} AND "createdAt" <= ${now}
        ) AS activity`,
      // Only current published versions; a successful retake replaces older mistakes.
      this.db.$queryRaw<Array<{ result: unknown; lessonId: string }>>`
        SELECT DISTINCT ON (a."quizId") a.result, l.id AS "lessonId"
        FROM "QuizAttempt" a
        JOIN "Quiz" q ON q.id = a."quizId"
        JOIN "Lesson" l ON l.id = q."lessonId"
        WHERE a."userId" = ${userId} AND a."createdAt" >= ${since} AND a."createdAt" <= ${now}
          AND a."quizRevision" = q.revision AND a."lessonRevision" = l.revision
          AND l.published = true
        ORDER BY a."quizId", a."createdAt" DESC, a.id DESC`,
      this.db.studyTimeEntry.findMany({ where: { userId, endAt: { gte: new Date(now.getTime() - 8 * 86400000) } }, select: { segments: true } }),
      this.db.studyTimeEntry.aggregate({ where: { userId }, _sum: { creditedMs: true } }),
    ])
    const today = localDay(now, timezone)
    const dailyTime = timeByDay(timeEntries.flatMap(entry => entry.segments as Segment[]), timezone)
    return {
      timezone,
      serverNow: now.toISOString(),
      since: since.toISOString(),
      studyTime: {
        todayMs: dailyTime.get(today) ?? 0,
        weekMs: [...dailyTime].filter(([day]) => day >= shiftDay(today, -6) && day <= today).reduce((sum, [, ms]) => sum + ms, 0),
        totalMs: timeTotal._sum.creditedMs ?? 0,
      },
      ...activitySummary(
        days.map((day) => day.day),
        localDay(now, timezone),
      ),
      mistakeLessonIds: attempts.filter(a => exerciseSummary([a.result]).weakAreas.length > 0).map(a => a.lessonId),
      ...exerciseSummary(attempts.map((attempt) => attempt.result)),
      ...accuracySummary(attempts.map((attempt) => attempt.result)),
    }
  }
}
