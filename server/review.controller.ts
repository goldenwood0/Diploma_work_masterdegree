import { Body, Controller, Get, Param, Patch, Post, HttpCode, Req, UseGuards, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Database } from './database.js';
import { SessionGuard, type AuthRequest } from './security.js';
import { parse } from './validation.js';
import { digest } from './passwords.js';
import { collectWords, ratingSchema, schedule } from './review.service.js';

@Controller('reviews')
@UseGuards(SessionGuard)
export class ReviewController {
  constructor(private db: Database) {}
  @Post('sync')
  @HttpCode(200)
  async sync(@Req() req: AuthRequest) {
    await collectWords(this.db, req.session!.user.id);
    return { ok: true };
  }
  @Get()
  async list(@Req() req: AuthRequest) {
    const userId = req.session!.user.id;
    const now = new Date();
    const timezone = req.session!.user.settings?.timezone ?? 'UTC';
    const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    const events = await this.db.reviewEvent.findMany({ where: { userId, createdAt: { gte: new Date(now.getTime() - 48 * 3600000) } }, orderBy: { createdAt: 'asc' }, select: { cardId: true, createdAt: true } });
    const cards = await this.db.reviewCard.findMany({ where: { userId }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }] });
    const today = events.filter(e => day(e.createdAt) === day(now));
    const firstEvents = await this.db.reviewEvent.groupBy({ by: ['cardId'], where: { userId }, _min: { createdAt: true } });
    const introduced = new Set(firstEvents.filter(e => e._min.createdAt && day(e._min.createdAt) === day(now)).map(e => e.cardId));
    const remainingNew = Math.max(0, 10 - introduced.size);
    const due = cards.filter(c => c.dueAt <= now);
    const queue = [...due.filter(c => c.version > 0), ...due.filter(c => c.version === 0).slice(0, remainingNew)].map(c => c.id);
    const history = await this.db.reviewEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, cardId: true, rating: true, createdAt: true, result: true } });
    return { cards, queue, newLimit: 10, remainingNew, reviewedToday: today.length, timezone, serverNow: now, history };
  }
  @Patch(':id')
  async edit(@Param('id') id: string, @Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(z.object({ favorite: z.boolean().optional(), note: z.string().max(2000).optional() }).strict(), body);
    const result = await this.db.reviewCard.updateMany({ where: { id, userId: req.session!.user.id }, data: input });
    if (!result.count) throw new NotFoundException('Карточка недоступна.');
    return { ok: true };
  }
  @Post(':id/rate')
  @HttpCode(200)
  async rate(@Param('id') id: string, @Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(z.object({ requestId: z.uuid(), version: z.number().int().nonnegative(), rating: ratingSchema }).strict(), body);
    const userId = req.session!.user.id;
    const hash = digest(JSON.stringify({ id, version: input.version, rating: input.rating }));
    try {
      return await this.db.$transaction(async db => {
        const previous = await db.reviewEvent.findUnique({ where: { userId_requestId: { userId, requestId: input.requestId } } });
        if (previous) { if (previous.requestHash !== hash) throw new ConflictException('Этот запрос уже содержит другой ответ.'); return previous.result; }
        const card = await db.reviewCard.findFirst({ where: { id, userId } });
        if (!card) throw new NotFoundException('Карточка недоступна.');
        const now = new Date();
        if (card.version !== input.version || card.dueAt > now) throw new ConflictException('Очередь изменилась. Обновите карточки.');
        if (!card.version) {
          const timezone = req.session!.user.settings?.timezone ?? 'UTC';
          const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
          const firstEvents = await db.reviewEvent.groupBy({ by: ['cardId'], where: { userId }, _min: { createdAt: true } });
          if (firstEvents.filter(e => e._min.createdAt && day(e._min.createdAt) === day(now)).length >= 10) throw new ConflictException('Лимит новых карточек на сегодня достигнут.');
        }
        const next = schedule(card.interval, card.repetitions, input.rating, now);
        const updated = await db.reviewCard.update({ where: { id }, data: { ...next, version: { increment: 1 } } });
        const result = { dueAt: updated.dueAt.toISOString(), interval: updated.interval, version: updated.version };
        await db.reviewEvent.create({ data: { userId, cardId: id, requestId: input.requestId, requestHash: hash, rating: input.rating, result } });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(err.code)) throw new ConflictException('Очередь изменилась. Обновите карточки.');
      throw err;
    }
  }
}
