import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuizChecks } from './quiz-checks.js';
import { grade, gradeOne, questionsSchema } from './quiz.js';

const l = (text: string) => ({ ru: text, kk: text, en: text });
const questions = questionsSchema.parse([
  { id: 'q1', kind: 'choice', prompt: l('你好?'), options: [{ id: 'a', text: l('hello') }, { id: 'b', text: l('bye') }], correct: 'a', explanation: l('你好 = hello') },
  { id: 'q2', kind: 'input', prompt: l('Write 十'), accepted: ['十'], explanation: l('10 = 十') },
  { id: 'q3', kind: 'order', prompt: l('Order'), options: [{ id: 'w1', text: l('好') }, { id: 'w0', text: l('你') }], correct: ['w0', 'w1'], explanation: l('你好') },
]);

test('gradeOne matches the full grade for every question kind', () => {
  const answers = [{ questionId: 'q1', value: 'b' }, { questionId: 'q2', value: ' 十 ' }, { questionId: 'q3', value: ['w0', 'w1'] }];
  const full = grade(questions, answers, 80);
  answers.forEach((a, i) => assert.deepEqual(gradeOne(questions[i], a.value), full.items[i]));
  assert.equal(gradeOne(questions[0], 'b').correct, false);
  assert.deepEqual(gradeOne(questions[0], 'b').expected, l('hello'));
  assert.throws(() => gradeOne(questions[0], 'zzz'));
  assert.throws(() => gradeOne(questions[2], ['w0']));
});

test('first checked answer is binding until the attempt is cleared', () => {
  const checks = new QuizChecks();
  let graded = 0;
  const run = (value: string) => checks.record('alice', 'quiz', 1, 'q1', value, () => { graded++; return gradeOne(questions[0], value); });
  const first = run('b');
  assert.notEqual(first, 'changed'); assert.equal(typeof first === 'object' && first.correct, false);
  assert.deepEqual(run('b'), first); assert.equal(graded, 1);
  assert.equal(run('a'), 'changed');
  assert.equal(checks.conflicts('alice', 'quiz', 1, [{ questionId: 'q1', value: 'a' }]), true);
  assert.equal(checks.conflicts('alice', 'quiz', 1, [{ questionId: 'q1', value: 'b' }, { questionId: 'q2', value: '十' }]), false);
  // Other learners, quizzes and revisions are independent.
  assert.equal(checks.conflicts('bob', 'quiz', 1, [{ questionId: 'q1', value: 'a' }]), false);
  assert.equal(checks.conflicts('alice', 'quiz', 2, [{ questionId: 'q1', value: 'a' }]), false);
  checks.clear('alice', 'quiz');
  assert.equal(checks.get('alice', 'quiz', 1, 'q1'), undefined);
  assert.notEqual(run('a'), 'changed');
});

test('array answers are compared by value', () => {
  const checks = new QuizChecks();
  checks.record('alice', 'quiz', 1, 'q3', ['w0', 'w1'], () => gradeOne(questions[2], ['w0', 'w1']));
  assert.equal(checks.conflicts('alice', 'quiz', 1, [{ questionId: 'q3', value: ['w0', 'w1'] }]), false);
  assert.equal(checks.conflicts('alice', 'quiz', 1, [{ questionId: 'q3', value: ['w1', 'w0'] }]), true);
});

test('list returns only this learner, quiz and revision checks with their values', () => {
  const checks = new QuizChecks();
  checks.record('alice', 'quiz', 1, 'q1', 'b', () => gradeOne(questions[0], 'b'));
  checks.record('alice', 'quiz', 1, 'q3', ['w0', 'w1'], () => gradeOne(questions[2], ['w0', 'w1']));
  checks.record('alice', 'quiz', 2, 'q1', 'a', () => gradeOne(questions[0], 'a'));
  checks.record('bob', 'quiz', 1, 'q1', 'a', () => gradeOne(questions[0], 'a'));
  const list = checks.list('alice', 'quiz', 1).sort((x, y) => x.questionId.localeCompare(y.questionId));
  assert.deepEqual(list.map(c => [c.questionId, c.value, c.correct]), [['q1', 'b', false], ['q3', ['w0', 'w1'], true]]);
  assert.deepEqual(list[0].expected, l('hello'));
});
