import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grade, normalizeAnswer, publicQuestion, questionsSchema, type Question } from './quiz.js';
const text = { ru: 'Текст', kk: 'Мәтін', en: 'Text' };
const base = { prompt: text, explanation: text };
const options = [{ id: 'a', text }, { id: 'b', text }];
const questions: Question[] = [
  { ...base, id: 'choice', kind: 'choice', options, correct: 'b' },
  { ...base, id: 'match', kind: 'match', left: options, right: options, correct: ['b', 'a'] },
  { ...base, id: 'order', kind: 'order', options, correct: ['b', 'a'] },
  { ...base, id: 'gap', kind: 'gap', accepted: ['叫'] },
  { ...base, id: 'input', kind: 'input', accepted: ['名字'] },
  { ...base, id: 'dictation', kind: 'dictation', accepted: ['你好'], audioUrl: 'https://example.test/audio.ogg', sourceUrl: 'https://example.test/source', author: 'Test', license: 'Test', licenseUrl: 'https://example.test/license' },
];
const answers = ['b', ['b', 'a'], ['b', 'a'], '叫', '名字', ' 你 好！'].map((value, i) => ({ questionId: questions[i].id, value }));
test('all six exercise types grade correctly and percentage threshold uses exact arithmetic', () => {
  assert.equal(questionsSchema.parse(questions).length, 6);
  const result = grade(questions, answers, 80);
  assert.equal(result.score, 6); assert.equal(result.passed, true);
  const oneWrong = answers.map((a, i) => i === 0 ? { ...a, value: 'a' } : a);
  assert.equal(grade(questions, oneWrong, 80).passed, true);
  assert.equal(grade(questions, oneWrong, 84).passed, false);
  const wrong = ['a', ['a', 'b'], ['a', 'b'], '是', '我', '谢谢'].map((value, i) => ({ questionId: questions[i].id, value }));
  assert.equal(grade(questions, wrong, 80).score, 0);
});
test('grading rejects missing, duplicate, unknown and malformed answers', () => {
  assert.throws(() => grade(questions, answers.slice(1), 80));
  assert.throws(() => grade(questions, [answers[0], ...answers.slice(0, 5)], 80));
  for (const value of ['unknown', ['b'], '']) assert.throws(() => grade(questions, [{ questionId: 'choice', value }, ...answers.slice(1)], 80));
  assert.throws(() => grade(questions, answers.map(a => a.questionId === 'match' ? { ...a, value: ['b', 'b'] } : a), 80));
  assert.throws(() => grade(questions, [{ questionId: 'forged', value: 'b' }, ...answers.slice(1)], 80));
});
test('normalization tolerates presentation differences but preserves tone and word order', () => {
  assert.equal(normalizeAnswer(' 你 好！'), '你好');
  assert.equal(normalizeAnswer('ＡＢＣ。'), 'abc');
  assert.notEqual(normalizeAnswer('nǐ'), normalizeAnswer('ní'));
  assert.notEqual(normalizeAnswer('好你'), normalizeAnswer('你好'));
});
test('public questions exclude answers and explanations; invalid editor keys are rejected', () => {
  for (const q of questions) {
    const visible = publicQuestion(q);
    assert.equal('correct' in visible, false); assert.equal('accepted' in visible, false); assert.equal('explanation' in visible, false);
  }
  assert.equal(questionsSchema.safeParse([questions[0], questions[0]]).success, false);
  assert.equal(questionsSchema.safeParse([{ ...questions[0], correct: 'unknown' }]).success, false);
});

test('editor validation bounds answers to learner limits and rejects incomplete content', () => {
  for (const invalid of [
    { ...questions[0], prompt: { ...text, kk: '   ' } },
    { ...questions[0], options: Array.from({ length: 31 }, (_, i) => ({ id: String(i), text })) },
    { ...questions[0], id: 'x'.repeat(101) },
    { ...questions[0], score: 100 },
    { ...questions[4], accepted: ['x'.repeat(501)] },
    { ...questions[4], accepted: [' ... '] },
    { ...questions[5], author: '' },
    { ...questions[5], audioUrl: 'https://user:password@example.test/a' },
    { ...questions[1], correct: ['a', 'a'] },
    { ...questions[2], correct: ['a'] },
  ]) assert.equal(questionsSchema.safeParse([invalid]).success, false);
});

test('assessment metadata is validated and retained in public questions and grading snapshots', () => {
  const tagged = questionsSchema.parse(questions.map(q => ({ ...q, topic: 'greetings', skill: 'vocabulary' })));
  assert.equal(publicQuestion(tagged[0]).topic, 'greetings');
  assert.equal(grade(tagged, answers, 80).items[0].question.skill, 'vocabulary');
  assert.equal(questionsSchema.safeParse([{ ...questions[0], topic: 'unknown' }]).success, false);
  assert.equal(questionsSchema.safeParse([{ ...questions[0], skill: 'choice' }]).success, false);
  assert.equal(questionsSchema.safeParse(questions).success, true);
});
