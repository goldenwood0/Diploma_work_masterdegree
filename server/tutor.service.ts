import { Inject, Injectable, HttpException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { Database } from './database.js';
import { searchableContent } from './content-search.js';
import { TutorBudgetError } from './tutor-budget.js';
import { TUTOR_PROVIDER, tutorInstructions, tutorOutput, type TutorInput, type TutorProvider } from './tutor-provider.js';

const errorSummary = z.object({ items: z.array(z.object({ correct: z.boolean(), question: z.object({
  kind: z.enum(['choice', 'match', 'order', 'gap', 'input', 'dictation']),
  topic: z.enum(['greetings', 'introductions', 'courtesy']).optional(),
  skill: z.enum(['vocabulary', 'grammar', 'reading', 'listening', 'writing']).optional(),
}) })).max(30) });
// The graded snapshot the learner already sees after submitting a quiz.
const localizedText = z.object({ ru: z.string(), kk: z.string(), en: z.string() });
const answerOption = z.object({ id: z.string(), text: localizedText });
const gradedAttempt = z.object({ items: z.array(z.object({
  correct: z.boolean(), value: z.union([z.string(), z.array(z.string())]),
  expected: z.union([z.string(), localizedText, z.array(localizedText)]), explanation: localizedText,
  question: z.object({ kind: z.string(), prompt: localizedText, options: z.array(answerOption).optional(), right: z.array(answerOption).optional() }),
})).max(30) });
type Language = 'ru' | 'kk' | 'en';
export function describeMistakes(result: unknown, language: Language) {
  const parsed = gradedAttempt.safeParse(result);
  if (!parsed.success) return [];
  const short = (value: string) => redact(value).slice(0, 300);
  return parsed.data.items.filter(item => !item.correct).slice(0, 5).map(item => {
    const choices = item.question.options ?? item.question.right ?? [];
    const show = (id: string) => choices.find(option => option.id === id)?.text[language] ?? id;
    const expected = typeof item.expected === 'string' ? item.expected : Array.isArray(item.expected) ? item.expected.map(text => text[language]).join(' · ') : item.expected[language];
    return { kind: item.question.kind, prompt: short(item.question.prompt[language]), given: short(Array.isArray(item.value) ? item.value.map(show).join(' · ') : show(item.value)),
      expected: short(expected), explanation: short(item.explanation[language]) };
  });
}
const fail = (code: string, status: number): never => { throw new HttpException({ message: code }, status); };
export function redact(value: string) {
  return value.replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[redacted]')
    .replace(/\b(?:Bearer\s+\S+|sk-[\w-]+|[a-f0-9]{64}|eyJ[\w-]+\.[\w-]+\.[\w-]+)\b/gi, '[redacted]')
    .replace(/(?:password|пароль|құпиясөз|token|api[_ -]?key)\s*[:=]\s*\S+/gi, '[redacted]');
}
@Injectable()
export class TutorService {
  private buckets = new Map<string, { count: number; until: number }>();
  private active = new Set<string>();
  // Bounded process-local ledger: no prompts or personal data.
  readonly usage: Array<{ status: string; provider: string; inputTokens?: number; outputTokens?: number; cost?: { amount: number; currency: string } }> = [];
  constructor(private db: Database, @Inject(TUTOR_PROVIDER) private provider: TutorProvider) {}
  status() { return { provider: this.provider.kind }; }
  async context(userId: string, input: TutorInput) {
    const lesson = await this.db.lesson.findFirst({
      where: { slug: input.lessonSlug, published: true, blocks: { some: {} } },
      select: { id: true, revision: true, prerequisiteId: true, prerequisite: { select: { revision: true } },
        blocks: { orderBy: { position: 'asc' }, select: { kind: true, content: true } },
        quiz: { select: { id: true, revision: true } } },
    });
    if (!lesson) throw new NotFoundException('TUTOR_LESSON_UNAVAILABLE');
    if (lesson.prerequisiteId) {
      const prior = await this.db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.prerequisiteId } } });
      if (!prior?.completedAt || prior.revision !== lesson.prerequisite?.revision) throw new ForbiddenException('TUTOR_LESSON_LOCKED');
    }
    const settings = await this.db.userSettings.findUnique({ where: { userId }, select: { startLevel: true, explanationLanguage: true } });
    const progress = await this.db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } } });
    const index = progress?.revision === lesson.revision ? Math.min(progress.nextBlock, lesson.blocks.length - 1) : 0;
    // Retrieval is scoped to this published accessible lesson and reached blocks.
    const reached = lesson.blocks.slice(0, index + 1);
    const query = input.text.toLocaleLowerCase();
    const related = query ? reached.filter((b, i) => i !== index && searchableContent([b]).toLocaleLowerCase().includes(query)).slice(-2) : [];
    // A mistake review needs the whole reached lesson, not only the current block.
    const material = redact(searchableContent(input.mode === 'mistakes' ? reached : [reached[index], ...related])).slice(0, 8000);
    const attempts = lesson.quiz ? await this.db.quizAttempt.findMany({
      where: { userId, quizId: lesson.quiz.id, lessonRevision: lesson.revision, quizRevision: lesson.quiz.revision },
      orderBy: { createdAt: 'desc' }, take: 3, select: { result: true },
    }) : [];
    const errors = attempts.flatMap(a => {
      const parsed = errorSummary.safeParse(a.result);
      return parsed.success ? parsed.data.items.filter(i => !i.correct).map(i => i.question) : [];
    }).slice(0, 10);
    const language = (['ru', 'kk', 'en'].includes(settings?.explanationLanguage ?? '') ? settings!.explanationLanguage : 'ru') as Language;
    // Latest attempt of the current revisions only; nothing to review is an explicit state.
    const mistakes = input.mode === 'mistakes' ? describeMistakes(attempts[0]?.result, language) : undefined;
    if (mistakes && !mistakes.length) fail('TUTOR_NO_MISTAKES', 409);
    return { level: settings?.startLevel ?? 1, language, ...(mistakes ? { mistakes } : {}),
      mode: input.mode, material, errors, text: redact(input.text), history: input.history.map(m => ({ role: m.role, text: redact(m.text) })) };
  }
  async ask(userId: string, input: TutorInput, signal: AbortSignal, timeoutMs = 20000) {
    const now = Date.now();
    for (const [id, b] of this.buckets) if (b.until <= now) this.buckets.delete(id);
    const bucket = this.buckets.get(userId) ?? { count: 0, until: now + 60000 };
    if (bucket.count >= 10 || this.active.has(userId) || this.active.size >= 20 || this.buckets.size >= 10000) fail('TUTOR_LIMIT', 429);
    this.buckets.set(userId, { ...bucket, count: bucket.count + 1 });
    this.active.add(userId);
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
    let status = 'failed';
    let result: z.infer<typeof tutorOutput> | undefined;
    let onAbort: () => void = () => {};
    try {
      if (controller.signal.aborted) fail(timedOut ? 'TUTOR_TIMEOUT' : 'TUTOR_CANCELLED', timedOut ? 504 : 408);
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error('aborted'));
        controller.signal.addEventListener('abort', onAbort, { once: true });
      });
      const data = await Promise.race([this.context(userId, input), aborted]);
      if (this.provider.kind === 'unconfigured') fail('TUTOR_NOT_CONFIGURED', 503);
      if (JSON.stringify(data).length > 16000) fail('TUTOR_CONTEXT_LIMIT', 413);
      const raw = await Promise.race([this.provider.generate({ system: tutorInstructions, data, maxOutputTokens: 1200 }, controller.signal), aborted]);
      result = tutorOutput.parse(raw);
      result.text = redact(result.text);
      status = 'ok';
      return { ...result, provider: this.provider.kind };
    } catch (error) {
      if (error instanceof TutorBudgetError) { status = 'budget_blocked'; fail('TUTOR_BUDGET', 402); }
      if (error instanceof HttpException) { status = `http_${error.getStatus()}`; throw error; }
      status = controller.signal.aborted ? (timedOut ? 'timeout' : 'cancelled') : 'provider_error';
      fail(timedOut ? 'TUTOR_TIMEOUT' : controller.signal.aborted ? 'TUTOR_CANCELLED' : 'TUTOR_PROVIDER_ERROR', timedOut ? 504 : controller.signal.aborted ? 408 : 502);
    } finally {
      clearTimeout(timer); signal.removeEventListener('abort', abort); controller.signal.removeEventListener('abort', onAbort); this.active.delete(userId);
      this.usage.push({ status, provider: this.provider.kind, ...result?.usage, ...(result?.cost ? { cost: result.cost } : {}) });
      if (this.usage.length > 1000) this.usage.shift();
    }
  }
}
