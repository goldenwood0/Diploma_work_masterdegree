// Builds a printable review sheet for the teacher from the HSK 1 draft JSON files.
// Usage: node scripts/hsk1-review-sheet.mjs > docs/hsk1-content/REVIEW_SHEET.md
import { readFileSync } from 'node:fs';

const files = [
  ['Модуль 1 (уроки 1–4 и тест): черновики поверх опубликованных уроков', 'docs/hsk1-audit/proposed-content.json'],
  ['Модуль 2 (уроки 5–12 и тест): новые неопубликованные уроки', 'docs/hsk1-content/module2.json'],
];
const out = [];
const p = (...lines) => out.push(...lines);
const cell = text => String(text).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
const tri = v => `ru: ${v.ru}<br>kk: ${v.kk}<br>en: ${v.en}`;
const answer = q => {
  if (q.kind === 'choice') return tri(q.options.find(o => o.id === q.correct).text);
  if (q.kind === 'order') return q.correct.map(id => q.options.find(o => o.id === id).text.ru).join(' ');
  if (q.kind === 'match') return q.left.map((o, i) => `${o.text.ru} → ${q.right.find(r => r.id === q.correct[i]).text.ru}`).join('<br>');
  return q.accepted.join(' / ');
};
const kinds = { choice: 'выбор', match: 'сопоставление', order: 'порядок', gap: 'пропуск', input: 'ввод', dictation: 'диктант' };

p('# HSK 1: лист проверки для преподавателя', '',
  'Сгенерировано `scripts/hsk1-review-sheet.mjs` из черновиков. Отмечайте ошибки прямо в этом файле или на распечатке.',
  'Проверить: иероглифы, пиньинь и тоны, переводы ru/kk/en, правильность ответов и объяснений, пригодность для начинающего.', '',
  '| Знак | Что проверить особенно |', '| --- | --- |',
  '| kk | Казахские тексты писал не носитель языка |',
  '| HSK | 哈萨克斯坦 (Казахстан) добавлен как дополнительное слово, его нет в списке HSK 1 |',
  '| тоны | Изменение тонов: 不是 bú shì, 一个 yí ge, 你好 ní hǎo |',
  '| 哪儿 | В ответах принимается и 哪里 |', '');

for (const [heading, file] of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  p(`## ${heading}`, '');
  for (const { slug, draft } of data.lessons) {
    p(`### ${draft.title.ru} · ${draft.title.kk} · ${draft.title.en}`, '', `\`${slug}\`, ${draft.minutes} мин.`, '');
    for (const block of draft.blocks) {
      const c = block.content;
      if (block.kind === 'vocabulary') {
        p(`**${c.title.ru}**`, '', '| Иероглифы | Пиньинь | ru | kk | en | ✓ |', '| --- | --- | --- | --- | --- | --- |');
        for (const w of c.words) p(`| ${w.hanzi} | ${w.pinyin} | ${cell(w.translation.ru)} | ${cell(w.translation.kk)} | ${cell(w.translation.en)} | |`);
        p('');
      } else {
        p(`**${c.title.ru}**${block.kind === 'audio' ? ` (аудио: ${c.author}, ${c.license})` : ''}`, '');
        if (c.text) p(`> ${cell(c.text.ru)}`, '>', `> kk: ${cell(c.text.kk)}`, '>', `> en: ${cell(c.text.en)}`, '');
        p('| Иероглифы | Пиньинь | Перевод | ✓ |', '| --- | --- | --- | --- |', `| ${cell(c.hanzi)} | ${cell(c.pinyin)} | ${cell(tri(c.translation))} | |`, '');
      }
    }
    if (draft.quiz) {
      p(`**Тест: ${draft.quiz.questions.length} заданий, порог ${draft.quiz.passPercent}%**`, '', '| № | Тип | Задание | Правильный ответ | Объяснение | ✓ |', '| --- | --- | --- | --- | --- | --- |');
      draft.quiz.questions.forEach((q, i) => p(`| ${i + 1} | ${kinds[q.kind]} | ${cell(tri(q.prompt))} | ${cell(answer(q))} | ${cell(tri(q.explanation))} | |`));
      p('');
    }
  }
}
process.stdout.write(out.join('\n') + '\n');
