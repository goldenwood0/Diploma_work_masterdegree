import { Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common"
import { Database } from "./database.js"
import { Mailer } from "./mailer.js"
import { getConfig } from "./config.js"
import { reminderDate } from "./reminders.js"
import { timeByDay, type Segment } from "./study-time.js"

@Injectable()
export class ReminderService implements OnApplicationShutdown {
  constructor(private db: Database, private mailer: Mailer) {}
  private timer?: ReturnType<typeof setInterval>
  private running?: Promise<void>
  private stopped = false
  private logger = new Logger(ReminderService.name)

  start() {
    if (getConfig().REMINDERS_ENABLED !== "true" || this.timer) return
    const tick = () => {
      if (this.running || this.stopped) return
      this.running = this.scan().catch(() => this.logger.error("Reminder scan failed"))
        .finally(() => { this.running = undefined })
    }
    this.timer = setInterval(tick, 60000)
    this.timer.unref()
    tick()
  }
  async onApplicationShutdown() {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    await this.running
  }
  private async scan() {
    let cursor: string | undefined
    while (!this.stopped) {
      const batch = await this.db.userSettings.findMany({
        where: { remindersEnabled: true, onboardingCompletedAt: { not: null }, user: { emailVerifiedAt: { not: null } } },
        select: { userId: true }, orderBy: { userId: "asc" }, take: 100,
        ...(cursor ? { cursor: { userId: cursor }, skip: 1 } : {}),
      })
      if (!batch.length) break
      for (const row of batch) {
        if (this.stopped) return
        try { await this.processUser(row.userId, new Date()) }
        catch { this.logger.error("Reminder processing failed") }
      }
      cursor = batch[batch.length - 1].userId
    }
  }

  async processUser(userId: string, now: Date) {
    const claim = await this.db.$transaction(async db => {
      // All workers serialize a learner's claim; SMTP is deliberately outside the lock.
      await db.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
      const user = await db.user.findUnique({ where: { id: userId }, include: { settings: true } })
      const settings = user?.settings
      if (!user?.emailVerifiedAt || !settings?.remindersEnabled || !settings.onboardingCompletedAt) return null
      const localDate = reminderDate(now, settings.timezone, settings.reminderTime)
      if (!localDate) return null
      const previous = await db.reminderDelivery.findFirst({ where: { userId, OR: [
        { localDate }, { attemptedAt: { gte: new Date(+now - 20 * 3600000) } },
      ] } })
      if (previous) return null
      const entries = await db.studyTimeEntry.findMany({ where: { userId, endAt: { gte: new Date(+now - 48 * 3600000) } }, select: { segments: true } })
      const studied = timeByDay(entries.flatMap(entry => entry.segments as Segment[]), settings.timezone).get(localDate) ?? 0
      const status = studied >= settings.dailyGoalMinutes * 60000 ? "SKIPPED_GOAL" : "SENDING"
      const delivery = await db.reminderDelivery.create({ data: { userId, localDate, timezone: settings.timezone, scheduledTime: settings.reminderTime, status, attemptedAt: now } })
      return { delivery, user }
    })
    if (!claim || claim.delivery.status !== "SENDING") return
    // Re-read opt-in immediately before handing the message to SMTP.
    const current = await this.db.user.findUnique({ where: { id: userId }, include: { settings: true } })
    if (!current?.emailVerifiedAt || !current.settings?.remindersEnabled || !current.settings.onboardingCompletedAt ||
      current.settings.timezone !== claim.delivery.timezone || current.settings.reminderTime !== claim.delivery.scheduledTime) {
      await this.db.reminderDelivery.updateMany({ where: { id: claim.delivery.id }, data: { status: "CANCELLED" } })
      return
    }
    try {
      await this.mailer.sendReminder(current.email, current.settings.uiLanguage, claim.delivery.id)
      await this.db.reminderDelivery.updateMany({ where: { id: claim.delivery.id }, data: { status: "SENT" } })
    } catch {
      // An SMTP timeout can follow acceptance. Never automatically resend an uncertain message.
      await this.db.reminderDelivery.updateMany({ where: { id: claim.delivery.id }, data: { status: "FAILED" } })
      this.logger.warn("Reminder delivery failed; automatic retry suppressed")
    }
  }
}
