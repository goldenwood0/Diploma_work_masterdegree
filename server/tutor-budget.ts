import { appendFile, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';

export class TutorBudgetError extends Error {}
const ledgerSchema = z.object({ version: z.literal(1), reservedCents: z.number().int().min(0).max(500) }).strict();
// Approved ceiling: $5 total. Each outgoing attempt reserves 2 cents permanently,
// including failures/cancellation. This is a conservative budget, NOT an invoice.
// Standard gpt-6-luna: $0.10/M input, $0.125/M cache writes, $0.50/M output,
// verified 2026-09-29. At <=70KB input and <=1200 output tokens, 2 cents has headroom.
// Stop/review this bound if model, tariffs, endpoint or request limits change.
export class TutorBudget {
  constructor(private path: string) {}
  async record(usage: { inputTokens: number; outputTokens: number }) {
    // Provider-reported tokens, not an estimated dollar charge. No user/prompt data.
    await appendFile(`${this.path}.usage.jsonl`, JSON.stringify({ at: new Date().toISOString(), model: 'gpt-6-luna', ...usage }) + '\n', { mode: 0o600 });
  }
  async reserve() {
    await mkdir(dirname(this.path), { recursive: true });
    // Cross-process exclusive lock; stale locks fail closed and need manual review.
    let lock;
    try { lock = await open(`${this.path}.lock`, 'wx', 0o600); }
    catch { throw new TutorBudgetError('Budget unavailable'); }
    try {
      let reservedCents = 0;
      try { reservedCents = ledgerSchema.parse(JSON.parse(await readFile(this.path, 'utf8'))).reservedCents; }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new TutorBudgetError('Invalid budget ledger'); }
      if (reservedCents + 2 > 500) throw new TutorBudgetError('Budget exhausted');
      const file = await open(`${this.path}.next`, 'w', 0o600);
      try { await file.writeFile(JSON.stringify({ version: 1, reservedCents: reservedCents + 2 })); await file.sync(); }
      finally { await file.close(); }
      await rename(`${this.path}.next`, this.path);
    } finally { await lock.close(); await unlink(`${this.path}.lock`); }
  }
}
