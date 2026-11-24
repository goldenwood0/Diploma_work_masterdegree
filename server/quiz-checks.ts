import { Injectable } from '@nestjs/common';
import type { gradeOne } from './quiz.js';

type Graded = ReturnType<typeof gradeOne>;
type Entry = { value: string; result: Graded; at: number };

// Instant per-question feedback. The first checked answer to a question is binding until the
// attempt is submitted, so a learner cannot probe options and then submit a perfect attempt.
// Process-local and bounded (like the tutor limits): a restart only forgets unsubmitted checks.
@Injectable()
export class QuizChecks {
  private entries = new Map<string, Entry>();
  private static readonly ttl = 6 * 60 * 60 * 1000;
  private static readonly max = 20000;
  private key = (userId: string, quizId: string, revision: number, questionId: string) => `${userId}\u0000${quizId}\u0000${revision}\u0000${questionId}`;
  private prune(now: number) {
    for (const [key, entry] of this.entries) if (now - entry.at > QuizChecks.ttl) this.entries.delete(key);
  }
  get(userId: string, quizId: string, revision: number, questionId: string) {
    const entry = this.entries.get(this.key(userId, quizId, revision, questionId));
    return entry && Date.now() - entry.at <= QuizChecks.ttl ? entry : undefined;
  }
  // Returns the stored result for the same value, 'changed' if a different value was checked first.
  record(userId: string, quizId: string, revision: number, questionId: string, value: unknown, grade: () => Graded): Graded | 'changed' | 'full' {
    const now = Date.now();
    const serialized = JSON.stringify(value);
    const existing = this.get(userId, quizId, revision, questionId);
    if (existing) return existing.value === serialized ? existing.result : 'changed';
    if (this.entries.size >= QuizChecks.max) { this.prune(now); if (this.entries.size >= QuizChecks.max) return 'full'; }
    const result = grade();
    this.entries.set(this.key(userId, quizId, revision, questionId), { value: serialized, result, at: now });
    return result;
  }
  // Every checked answer must be submitted unchanged.
  conflicts(userId: string, quizId: string, revision: number, answers: Array<{ questionId: string; value: unknown }>) {
    return answers.some(a => { const entry = this.get(userId, quizId, revision, a.questionId); return entry && entry.value !== JSON.stringify(a.value); });
  }
  // Checked answers of one attempt in progress, so a reload restores locked answers and feedback.
  list(userId: string, quizId: string, revision: number) {
    const prefix = `${userId}\u0000${quizId}\u0000${revision}\u0000`;
    const now = Date.now();
    return [...this.entries].filter(([key, entry]) => key.startsWith(prefix) && now - entry.at <= QuizChecks.ttl)
      .map(([key, entry]) => ({ questionId: key.slice(prefix.length), value: JSON.parse(entry.value) as unknown, correct: entry.result.correct, expected: entry.result.expected, explanation: entry.result.explanation }));
  }
  clear(userId: string, quizId: string) {
    const prefix = `${userId}\u0000${quizId}\u0000`;
    for (const key of this.entries.keys()) if (key.startsWith(prefix)) this.entries.delete(key);
  }
}
