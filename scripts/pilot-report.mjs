// Pilot results for the thesis (roadmap stage 5). READ-ONLY for the database.
// Participants are identified by codes (P01…); names and emails never reach the report.
//
// Usage (after server:build, with the DB container running):
//   node --env-file=.env scripts/pilot-report.mjs --participants output/participants.csv [--survey output/responses.csv] [--out output/pilot]
//
// participants.csv (keep outside git): `code,email` per line, e.g. `P01,anna@example.com`.
// responses.csv: docs/evaluation/responses-template.csv filled in by the author.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[i + 1]]] : pairs), []));
if (!args.participants && !args.survey) throw new Error('Pass --participants <csv> and/or --survey <csv>. See docs/evaluation/README.md.');
const outDir = args.out ?? 'output/pilot';

// Minimal RFC 4180 CSV parser: quotes, escaped quotes, commas and newlines inside quotes.
export function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
const csvCell = value => { const s = String(value ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = rows => rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const mean = values => (values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null);
const median = values => { if (!values.length) return null; const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const show = value => (value === null || value === undefined ? '—' : String(value));

// SUS: odd items (score − 1), even items (5 − score), sum × 2.5; incomplete answers are not scored.
export function susScore(answers) {
  if (answers.length !== 10 || answers.some(v => !Number.isInteger(v) || v < 1 || v > 5)) return null;
  return answers.reduce((sum, v, i) => sum + (i % 2 === 0 ? v - 1 : 5 - v), 0) * 2.5;
}

const md = [];
const p = (...lines) => md.push(...lines);
p('# Результаты пилота ZhPath', '', `Сформировано ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC скриптом \`scripts/pilot-report.mjs\`. Участники обозначены кодами.`, '');

if (args.participants) {
  const list = parseCsv(await readFile(args.participants, 'utf8'))
    .filter(r => !/^code$/i.test(r[0]?.trim()))
    .map(([code, email]) => ({ code: code.trim(), email: email?.trim().toLowerCase() }));
  if (!list.length || list.some(x => !x.code || !x.email)) throw new Error('participants.csv must contain `code,email` rows.');
  const db = new PrismaClient();
  try {
    const users = await db.user.findMany({ where: { email: { in: list.map(x => x.email) } }, select: { id: true, email: true, createdAt: true, settings: { select: { uiLanguage: true, explanationLanguage: true } } } });
    const byEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));
    const missing = list.filter(x => !byEmail.has(x.email)).map(x => x.code);
    const found = list.filter(x => byEmail.has(x.email)).map(x => ({ ...x, user: byEmail.get(x.email) }));
    const ids = found.map(x => x.user.id);
    const [lessons, progress, attempts, time, reviews] = await Promise.all([
      db.lesson.findMany({ where: { published: true }, select: { id: true, slug: true, quiz: { select: { id: true } } }, orderBy: [{ unitId: 'asc' }, { position: 'asc' }] }),
      db.lessonProgress.findMany({ where: { userId: { in: ids } }, select: { userId: true, lessonId: true, completedAt: true } }),
      db.quizAttempt.findMany({ where: { userId: { in: ids } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { userId: true, quizId: true, score: true, total: true, passed: true, result: true } }),
      db.studyTimeEntry.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _sum: { creditedMs: true } }),
      db.reviewEvent.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: { _all: true } }),
    ]);
    const published = new Set(lessons.map(l => l.id));
    const quizToLesson = new Map(lessons.filter(l => l.quiz).map(l => [l.quiz.id, l.slug]));
    const rows = found.map(({ code, user }) => {
      const own = attempts.filter(a => a.userId === user.id && quizToLesson.has(a.quizId));
      // Attempts are sorted by time, so the first one seen per quiz is the first attempt.
      const firsts = [...own.reduce((m, a) => (m.has(a.quizId) ? m : m.set(a.quizId, a)), new Map()).values()];
      const completed = progress.filter(x => x.userId === user.id && x.completedAt && published.has(x.lessonId)).length;
      const minutes = Math.round((time.find(t => t.userId === user.id)?._sum.creditedMs ?? 0) / 60000);
      return {
        code, completed, lessons: lessons.length, quizzes: new Set(own.map(a => a.quizId)).size, attempts: own.length,
        firstPass: firsts.filter(a => a.passed).length, firstCount: firsts.length,
        firstAccuracy: pct(firsts.reduce((s, a) => s + a.score, 0), firsts.reduce((s, a) => s + a.total, 0)),
        minutes, reviews: reviews.find(r => r.userId === user.id)?._count._all ?? 0,
        language: user.settings?.explanationLanguage ?? '',
      };
    });
    // Wrong answers on first attempts, by question and by topic.
    const firstAttempts = [...attempts.reduce((m, a) => (m.has(`${a.userId}:${a.quizId}`) ? m : m.set(`${a.userId}:${a.quizId}`, a)), new Map()).values()].filter(a => quizToLesson.has(a.quizId));
    const questions = new Map(); const topics = new Map();
    for (const a of firstAttempts) for (const item of a.result?.items ?? []) {
      const key = `${quizToLesson.get(a.quizId)} · ${item.question?.prompt?.ru ?? item.question?.id}`;
      const q = questions.get(key) ?? { wrong: 0, total: 0 }; q.total++; if (!item.correct) q.wrong++; questions.set(key, q);
      const topic = item.question?.topic ?? '(без темы)';
      const t = topics.get(topic) ?? { correct: 0, total: 0 }; t.total++; if (item.correct) t.correct++; topics.set(topic, t);
    }

    p('## Прохождение модуля', '', `Участников в списке: ${list.length}; найдено в базе: ${found.length}${missing.length ? `; не найдены: ${missing.join(', ')}` : ''}. Опубликованных уроков и тестов: ${lessons.length}.`, '',
      '| Участник | Пройдено уроков | Тестов начато | Попыток | Сдано с 1-й попытки | Точность 1-й попытки, % | Минут занятий | Повторений карточек | Язык объяснений |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of rows) p(`| ${r.code} | ${r.completed}/${r.lessons} | ${r.quizzes} | ${r.attempts} | ${r.firstPass}/${r.firstCount} | ${show(r.firstAccuracy)} | ${r.minutes} | ${r.reviews} | ${r.language} |`);
    p('', `Медиана пройденных уроков: ${show(median(rows.map(r => r.completed)))}; медиана минут: ${show(median(rows.map(r => r.minutes)))}; средняя точность первой попытки: ${show(mean(rows.map(r => r.firstAccuracy).filter(v => v !== null)))}%.`, '');
    p('## Точность первой попытки по темам', '', '| Тема | Верно / всего | % |', '| --- | --- | --- |');
    for (const [topic, t] of [...topics].sort((a, b) => b[1].total - a[1].total)) p(`| ${topic} | ${t.correct} / ${t.total} | ${show(pct(t.correct, t.total))} |`);
    p('', '## Задания с наибольшим числом ошибок (первая попытка)', '', '| Урок · задание | Ошибок / ответов |', '| --- | --- |');
    for (const [key, q] of [...questions].filter(([, q]) => q.wrong).sort((a, b) => b[1].wrong / b[1].total - a[1].wrong / a[1].total || b[1].wrong - a[1].wrong).slice(0, 10)) p(`| ${key.replace(/\|/g, '\\|')} | ${q.wrong} / ${q.total} |`);
    p('', 'Ответы ИИ-помощника не сохраняются в базе (только счётчики в памяти API), поэтому их оценка — по анкете (B3, B4, D3) и наблюдению.', '');
    await mkdir(outDir, { recursive: true });
    await writeFile(`${outDir}/participants-results.csv`, toCsv([
      ['participant', 'lessons_completed', 'lessons_published', 'quizzes_started', 'attempts', 'first_try_passed', 'first_try_quizzes', 'first_try_accuracy_pct', 'study_minutes', 'card_reviews', 'explanation_language'],
      ...rows.map(r => [r.code, r.completed, r.lessons, r.quizzes, r.attempts, r.firstPass, r.firstCount, r.firstAccuracy ?? '', r.minutes, r.reviews, r.language]),
    ]));
  } finally { await db.$disconnect(); }
}

if (args.survey) {
  const [header, ...data] = parseCsv(await readFile(args.survey, 'utf8'));
  const col = name => header.indexOf(name);
  const num = (row, name) => { const v = row[col(name)]?.trim(); return v ? Number(v) : null; };
  const filled = data.filter(r => r[0]?.trim());
  const sus = filled.map(r => ({ code: r[0], score: susScore(Array.from({ length: 10 }, (_, i) => num(r, `A${i + 1}`))) }));
  const scored = sus.filter(s => s.score !== null).map(s => s.score);
  p('## Анкета: удобство (SUS)', '', `Анкет: ${filled.length}; полных по SUS: ${scored.length}. Средний SUS: ${show(mean(scored))}, медиана: ${show(median(scored))}, мин–макс: ${scored.length ? `${Math.min(...scored)}–${Math.max(...scored)}` : '—'}. Ориентир: около 68 — средний уровень, выше 80 — хороший.`, '',
    '| Участник | SUS |', '| --- | --- |', ...sus.map(s => `| ${s.code} | ${show(s.score)} |`), '');
  const labels = { B1: 'Объяснения понятны', B2: 'Мгновенная проверка помогала', B3: 'Объяснение ошибки от ИИ помогло', B4: 'Доверие ответам ИИ', B5: 'Длина урока подходила', B6: 'Могу поздороваться и представиться' };
  p('## Анкета: обучение и ИИ (1–5)', '', '| Пункт | Ответов | Среднее | 1 | 2 | 3 | 4 | 5 |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const [key, label] of Object.entries(labels)) {
    const values = filled.map(r => num(r, key)).filter(v => Number.isInteger(v) && v >= 1 && v <= 5);
    p(`| ${key}. ${label} | ${values.length} | ${show(mean(values))} | ${[1, 2, 3, 4, 5].map(n => values.filter(v => v === n).length).join(' | ')} |`);
  }
  const counts = name => Object.entries(filled.reduce((m, r) => { const v = r[col(name)]?.trim() || '—'; m[v] = (m[v] ?? 0) + 1; return m; }, {})).map(([k, v]) => `${k}: ${v}`).join(', ');
  p('', `Опыт китайского (C1): ${counts('C1_prior')}. Устройство (C2): ${counts('C2_device')}. Язык (C3): ${counts('C3_language')}.`, '');
  p('## Открытые ответы', '');
  for (const [name, title] of [['D1_liked', 'Что понравилось'], ['D2_problems', 'Что мешало'], ['D3_ai_issues', 'Неверные или странные ответы ИИ']]) {
    const answers = filled.map(r => [r[0], r[col(name)]?.trim()]).filter(([, v]) => v);
    p(`**${title}**`, '', ...(answers.length ? answers.map(([code, v]) => `- ${code}: ${v.replace(/\s+/g, ' ')}`) : ['- —']), '');
  }
}

await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/REPORT.md`, md.join('\n') + '\n');
console.log(`Written ${outDir}/REPORT.md${args.participants ? ` and ${outDir}/participants-results.csv` : ''}`);
