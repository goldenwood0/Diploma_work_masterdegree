import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { wordSchema } from './review.service.js';
type Word = z.infer<typeof wordSchema>;
export type VocabularyQuestion = { id: string; key: string; hanzi: string; skill: 'meaning' | 'reading'; options: string[]; correct: number };
export function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function makeVocabularyQuestions(words: Map<string, Word>, keys: string[], language: 'ru' | 'kk' | 'en') {
  const questions: VocabularyQuestion[] = [];
  const tested: string[] = [];
  for (const key of shuffle(keys)) {
    if (tested.length >= 10) break;
    const word = words.get(key);
    if (!word) continue;
    const pair: VocabularyQuestion[] = [];
    for (const skill of ['meaning', 'reading'] as const) {
      const value = (w: Word) => (skill === 'meaning' ? w.translation[language] : w.pinyin).trim();
      const correct = value(word);
      const alternatives = shuffle([...new Set([...words.values()].filter(w => w.hanzi !== word.hanzi).map(value))].filter(v => v && v !== correct)).slice(0, 3);
      if (!correct || !alternatives.length) break;
      const options = shuffle([correct, ...alternatives]);
      pair.push({ id: randomUUID(), key, hanzi: word.hanzi, skill, options, correct: options.indexOf(correct) });
    }
    if (pair.length === 2) { tested.push(key); questions.push(...pair); }
  }
  return { questions: shuffle(questions), tested };
}
