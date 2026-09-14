import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import { Database } from "./database.js"
import { Prisma } from "@prisma/client"
import { SessionGuard, type AuthRequest } from "./security.js"
import { activitySummary, exerciseSummary, localDay } from "./analytics.js"

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
    const [days, attempts] = await this.db.$transaction([
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
      this.db.$queryRaw<Array<{ result: unknown }>>`
        SELECT DISTINCT ON (a."quizId") a.result
        FROM "QuizAttempt" a
        JOIN "Quiz" q ON q.id = a."quizId"
        JOIN "Lesson" l ON l.id = q."lessonId"
        WHERE a."userId" = ${userId} AND a."createdAt" >= ${since} AND a."createdAt" <= ${now}
          AND a."quizRevision" = q.revision AND a."lessonRevision" = l.revision
          AND l.published = true
        ORDER BY a."quizId", a."createdAt" DESC, a.id DESC`,
    ])
    return {
      timezone,
      serverNow: now.toISOString(),
      since: since.toISOString(),
      ...activitySummary(
        days.map((day) => day.day),
        localDay(now, timezone),
      ),
      ...exerciseSummary(attempts.map((attempt) => attempt.result)),
    }
  }
}
