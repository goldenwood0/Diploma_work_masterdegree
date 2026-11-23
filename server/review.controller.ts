import { Body, Controller, Get, Param, Patch, Post, HttpCode, Req, UseGuards, NotFoundException, ConflictException, BadRequestException, HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { makeVocabularyQuestions, type VocabularyQuestion } from './vocabulary-test.js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Database } from './database.js';
import { SessionGuard, type AuthRequest } from './security.js';
import { parse } from './validation.js';
import { digest } from './passwords.js';
import { collectWords, ratingSchema, schedule, publishedWords, isKnown, wordSchema } from './review.service.js';

@Controller('reviews')
@UseGuards(SessionGuard)
export class ReviewController {
  private tests = new Map<string, { userId: string; expires: number; questions: VocabularyQuestion[]; words: Map<string, z.infer<typeof wordSchema>>; requestHash?: string; pending?: Promise<unknown> }>();
  constructor(private db: Database) {}
  @Post('vocabulary/test')
  @HttpCode(200)
  async startVocabularyTest(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(z.object({ keys: z.array(z.string().min(1).max(500)).min(1).max(5000), language: z.enum(['ru', 'kk', 'en']) }).strict(), body);
    const now = Date.now();
    for (const [id, test] of this.tests) if (test.expires < now) this.tests.delete(id);
    if (this.tests.size >= 1000) throw new HttpException('Попробуйте позже.', 429);
    const userId = req.session!.user.id;
    // A new test supersedes old unfinished tests for this account.
    for (const [id, test] of this.tests) if (test.userId === userId && !test.pending) this.tests.delete(id);
    const words = await publishedWords(this.db);
    const { questions, tested } = makeVocabularyQuestions(words, [...new Set(input.keys)], input.language);
    if (!questions.length) throw new BadRequestException('Недостаточно данных для теста.');
    const id = randomUUID(); const expires = now + 20 * 60_000;
    this.tests.set(id, { userId, expires, questions, words: new Map(tested.map(key => [key, words.get(key)!])) });
    return { id, expiresAt: new Date(expires).toISOString(), wordCount: tested.length, questions: questions.map(({ correct, key, ...question }) => question) };
  }
  @Post('vocabulary/test/:id')
  @HttpCode(200)
  async finishVocabularyTest(@Param('id') id: string, @Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(z.object({ answers: z.array(z.object({ id: z.uuid(), choice: z.number().int().min(0).max(3) }).strict()).min(2).max(20) }).strict(), body);
    const test = this.tests.get(id);
    if (!test || test.userId !== req.session!.user.id || test.expires < Date.now()) throw new NotFoundException('Тест истёк. Начните заново.');
    const answers = new Map(input.answers.map(answer => [answer.id, answer.choice]));
    if (answers.size !== input.answers.length || answers.size !== test.questions.length || test.questions.some(q => !answers.has(q.id) || answers.get(q.id)! >= q.options.length)) throw new BadRequestException('Ответьте на все вопросы теста.');
    const hash = digest(JSON.stringify([...answers].sort(([a], [b]) => a.localeCompare(b))));
    if (test.pending) { if (hash !== test.requestHash) throw new ConflictException('Тест уже завершён.'); return test.pending; }
    test.requestHash = hash;
    test.pending = this.db.$transaction(async db => {
      const results = [];
      for (const [key, word] of test.words) {
        const questions = test.questions.filter(q => q.key === key);
        const correct = questions.filter(q => answers.get(q.id) === q.correct).length;
        const status = correct === questions.length ? 'known' : 'learning';
        const card = await db.reviewCard.findUnique({ where: { userId_wordKey: { userId: test.userId, wordKey: key } } });
        const knowledge = { status, source: 'test', testedAt: new Date().toISOString(), correct, total: questions.length };
        const content = { ...(card?.content as Record<string, Prisma.JsonValue> ?? word), knowledge };
        await db.reviewCard.upsert({ where: { userId_wordKey: { userId: test.userId, wordKey: key } }, update: { content }, create: { userId: test.userId, wordKey: key, content } });
        results.push({ key, hanzi: word.hanzi, status, correct, total: questions.length });
      }
      return { results, questions: test.questions.map(q => ({ id: q.id, correct: q.correct })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(error => { test.pending = undefined; test.requestHash = undefined; if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) throw new ConflictException('Очередь изменилась. Обновите карточки.'); throw error; });
    return test.pending;
  }
  @Get('vocabulary')
  async vocabulary(@Req() req: AuthRequest) {
    const words = await publishedWords(this.db);
    const cards = await this.db.reviewCard.findMany({ where: { userId: req.session!.user.id } });
    const byKey = new Map(cards.map(card => [card.wordKey, card]));
    for (const card of cards) {
      const parsed = wordSchema.safeParse(card.content);
      if (parsed.success && !words.has(card.wordKey)) words.set(card.wordKey, parsed.data);
    }
    return { words: [...words].map(([key, content]) => {
      const personal = byKey.get(key)?.content;
      const source = z.object({ knowledge: z.object({ source: z.string() }) }).safeParse(personal);
      return { key, content, known: isKnown(personal), inReviews: byKey.has(key), knowledgeSource: source.success ? source.data.knowledge.source : 'manual' };
    }) };
  }
  @Post('vocabulary/knowledge')
  @HttpCode(200)
  async knowledge(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(z.object({ key: z.string().min(1).max(500), known: z.boolean() }).strict(), body);
    const userId = req.session!.user.id;
    try {
      return await this.db.$transaction(async db => {
        const card = await db.reviewCard.findUnique({ where: { userId_wordKey: { userId, wordKey: input.key } } });
        const word = card ? wordSchema.parse(card.content) : (await publishedWords(db)).get(input.key);
        if (!word) throw new NotFoundException('Слово недоступно.');
        // Personal metadata in the existing JSON document; no schema migration or fabricated review event.
        const content = { ...(card?.content as Record<string, Prisma.JsonValue> ?? word), knowledge: { status: input.known ? 'known' : 'learning', source: 'manual' } };
        await db.reviewCard.upsert({ where: { userId_wordKey: { userId, wordKey: input.key } }, update: { content }, create: { userId, wordKey: input.key, content } });
        return { ok: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(err.code)) throw new ConflictException('Очередь изменилась. Обновите карточки.');
      throw err;
    }
  }
  @Post('sync')
  @HttpCode(200)
  async sync(@Req() req: AuthRequest) {
    await collectWords(this.db, req.session!.user.id);
    return { ok: true };
  }
  @Get()
  async list(@Req() req: AuthRequest) {
    const state = await this.queueState(req);
    const history = await this.db.reviewEvent.findMany({ where: { userId: req.session!.user.id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, cardId: true, rating: true, createdAt: true, result: true } });
    return { ...state, history };
  }
  @Get("summary")
  async summary(@Req() req: AuthRequest) {
    const state = await this.queueState(req);
    const dueReviews = state.cards.filter(c => c.version > 0 && c.dueAt <= state.serverNow).length;
    const dueNew = state.cards.filter(c => c.version === 0 && c.dueAt <= state.serverNow).length;
    const next = state.cards.find(c => c.version > 0 && c.dueAt > state.serverNow);
    return { ready: state.queue.length, dueReviews, availableNew: state.queue.length - dueReviews, deferredNew: Math.max(0, dueNew - state.remainingNew), remainingNew: state.remainingNew, newLimit: state.newLimit, reviewedToday: state.reviewedToday, totalCards: state.cards.length, nextReviewAt: next?.dueAt ?? null, timezone: state.timezone, serverNow: state.serverNow };
  }
  private async queueState(req: AuthRequest) {
    const userId = req.session!.user.id;
    const now = new Date();
    const timezone = req.session!.user.settings?.timezone ?? 'UTC';
    const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    const events = await this.db.reviewEvent.findMany({ where: { userId, createdAt: { gte: new Date(now.getTime() - 48 * 3600000) } }, orderBy: { createdAt: 'asc' }, select: { cardId: true, createdAt: true } });
    const allCards = await this.db.reviewCard.findMany({ where: { userId }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }] });
    const cards = allCards.filter(card => !isKnown(card.content));
    const today = events.filter(e => day(e.createdAt) === day(now));
    const firstEvents = await this.db.reviewEvent.groupBy({ by: ['cardId'], where: { userId }, _min: { createdAt: true } });
    const introduced = new Set(firstEvents.filter(e => e._min.createdAt && day(e._min.createdAt) === day(now)).map(e => e.cardId));
    const remainingNew = Math.max(0, 10 - introduced.size);
    const due = cards.filter(c => c.dueAt <= now);
    const queue = [...due.filter(c => c.version > 0), ...due.filter(c => c.version === 0).slice(0, remainingNew)].map(c => c.id);
    return { cards, queue, newLimit: 10, remainingNew, reviewedToday: today.length, timezone, serverNow: now };
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
        if (isKnown(card.content)) throw new ConflictException('Очередь изменилась. Обновите карточки.');
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
