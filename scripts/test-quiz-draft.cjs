// React DOM integration checks in jsdom; API failures and session changes are simulated.
// Install test-only runtime: npm install --prefix outputs/quiz-test-runtime --no-audit --no-fund jsdom
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { JSDOM } = require('../outputs/quiz-test-runtime/node_modules/jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(global, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
function load(file, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const scope = { exports: {}, require: id => id in deps ? deps[id] : require(id), localStorage, crypto: require('node:crypto').webcrypto, AbortController };
  vm.runInNewContext(code, scope); return scope.exports;
}
const learning = load('src/i18n/learningMessages.ts');
const dictionary = load('src/i18n/messages.ts', { './learningMessages': learning });
const { translate } = load('src/i18n/translate.ts', { './messages': dictionary });
let language = 'ru';
const lang = { useLanguage: () => ({ language, explanationLanguage: language, t: key => translate(key, language) }) };
const client = load('src/api/client.ts');
const drafts = load('src/api/quizDraft.ts');
const Question = load('src/components/QuizQuestion.tsx', { '../i18n/LanguageProvider': lang }).default;
const text = { ru: 'Вопрос', kk: 'Сұрақ', en: 'Question' };
const q = { id: 'q', kind: 'input', prompt: text };
let quiz = { id: 'quiz', revision: 1, lessonRevision: 1, kind: 'lesson', passPercent: 80, questions: [q], attempts: [] };
let owner = 'alice', mode = 'ok', sent = [], records = new Map();
const api = {
  getQuiz: async (slug, signal, user) => {
    if (user !== owner) throw new client.ApiError(403, 'Аккаунт изменился. Перезагрузите страницу.');
    return JSON.parse(JSON.stringify(quiz));
  },
  submitQuiz: async (slug, body, signal, user) => {
    sent.push(JSON.parse(JSON.stringify(body)));
    if (user !== owner) throw new client.ApiError(403, 'Аккаунт изменился. Перезагрузите страницу.');
    if (mode === 'offline') throw new client.ApiError(0, 'Нет связи с сервером. Попробуйте ещё раз.');
    if (!records.has(body.requestId)) records.set(body.requestId, { id: body.requestId, createdAt: new Date().toISOString(), quizRevision: 1, lessonRevision: 1, result: { score: 1, total: 1, passPercent: 80, passed: true, items: [{ question: q, value: '你好', correct: true, expected: '你好', explanation: text }] } });
    if (mode === 'lost-response') throw new client.ApiError(0, 'Нет связи с сервером. Попробуйте ещё раз.');
    return records.get(body.requestId);
  },
};
const Panel = load('src/components/QuizPanel.tsx', { '../api/quiz': api, '../api/client': client, '../api/quizDraft': drafts, '../i18n/LanguageProvider': lang, './QuizQuestion': { default: Question, __esModule: true } }).default;
let root;
const container = document.getElementById('root');
async function mount(user = owner) { if (root) await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(React.createElement(Panel, { userId: user, slug: 'lesson', onPassed() {} }))); }
async function type(value) { await act(async () => { const input = container.querySelector('input'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })); }); }
async function click(key) { const b = [...container.querySelectorAll('button')].find(b => b.textContent === translate(key, language)); assert.ok(b, key); await act(async () => b.click()); }
async function submit() { await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))); }
(async () => {
  for (language of ['ru', 'kk', 'en']) {
    localStorage.clear(); quiz.attempts = []; records.clear(); sent = []; owner = 'alice'; mode = 'offline';
    await mount(); await type('你好');
    assert.match(container.textContent, new RegExp(translate('Черновик сохранён в этом браузере.', language)));
    await mount(); assert.equal(container.querySelector('input').value, '你好');
    assert.ok(container.textContent.includes(translate('Черновик восстановлен.', language)));
    // Logout and a different account: no answers or pending request leak.
    owner = 'bob'; await mount(); assert.equal(container.querySelector('input').value, ''); await type('Bob');
    owner = 'alice'; await mount(); assert.equal(container.querySelector('input').value, '你好');
    await submit(); assert.equal(sent.length, 1); const id = sent[0].requestId;
    await click('Обновить тест'); assert.equal(container.querySelector('input').value, '你好');
    await mount(); await submit(); assert.equal(sent[1].requestId, id); assert.deepEqual(sent[0], sent[1]);
    mode = 'lost-response'; await submit(); assert.equal(records.size, 1);
    await mount(); mode = 'ok'; await submit(); assert.equal(records.size, 1); assert.equal(sent.at(-1).requestId, id);
    assert.equal(localStorage.getItem(drafts.draftKey('alice', quiz.id)), null);
    assert.ok(container.textContent.includes(translate('Результат сохранён. Черновик удалён.', language)));
    await click('Пройти заново'); await type('New');
    quiz.attempts = [...records.values()]; await mount(); assert.equal(container.querySelector('input').value, 'New');
    quiz.revision++; await mount(); assert.equal(container.querySelector('input').value, '');
    assert.ok(container.textContent.includes(translate('Версия урока или теста изменилась. Старый черновик нельзя восстановить: задания могли измениться.', language)));
    await type('Version 2'); quiz.lessonRevision++; await mount(); assert.equal(container.querySelector('input').value, '');
    await type('Private'); owner = 'bob'; const count = records.size; await submit(); assert.equal(records.size, count);
    assert.ok(container.textContent.includes(translate('Аккаунт изменился. Перезагрузите страницу.', language)), container.textContent + JSON.stringify(sent.at(-1)));
    assert.equal(container.querySelector('fieldset').disabled, true);
    quiz = { ...quiz, revision: 1, lessonRevision: 1, attempts: [] };
    console.log(`PASS ${language}: reload, relogin, account isolation, refresh, offline retry, lost response deduplication, cleanup, retake over history, both revisions, changed session`);
  }
  owner = 'alice'; localStorage.clear(); await mount();
  const original = window.Storage.prototype.setItem;
  window.Storage.prototype.setItem = () => { throw new Error('quota'); };
  await type('Keep me'); assert.ok(container.textContent.includes(translate('Не удалось сохранить черновик. Не закрывайте страницу.', language)));
  const sentBefore = sent.length; await submit(); assert.equal(sent.length, sentBefore, 'Do not submit without a durable retry token');
  window.Storage.prototype.setItem = original;
  await act(async () => root.unmount()); root = null;
  const kinds = [
    { id: 'choice', kind: 'choice', options: [{ id: 'a' }] },
    { id: 'match', kind: 'match', left: [{ id: 'a' }, { id: 'b' }], right: [{ id: 'x' }, { id: 'y' }] },
    { id: 'order', kind: 'order', options: [{ id: 'a' }, { id: 'b' }] },
    ...['gap', 'input', 'dictation'].map(kind => ({ id: kind, kind })),
  ];
  const all = { ...quiz, questions: kinds };
  const answers = { choice: 'a', match: ['x', ''], order: ['b'], gap: '你', input: '好', dictation: '你好' };
  drafts.writeDraft(drafts.makeDraft('alice', all, answers));
  assert.equal(JSON.stringify(drafts.readDraft('alice', all).draft.answers), JSON.stringify(answers));
  assert.equal(drafts.readDraft('bob', all).status, 'empty');
  localStorage.setItem(drafts.draftKey('bob', all.id), localStorage.getItem(drafts.draftKey('alice', all.id)));
  assert.equal(drafts.readDraft('bob', all).status, 'invalid');
  localStorage.setItem(drafts.draftKey('alice', all.id), '{broken');
  assert.equal(drafts.readDraft('alice', all).status, 'invalid');
  let call;
  const realApi = load('src/api/quiz.ts', {
    './media': { audioUrlSchema: require('zod').z.string() },
    './client': { request: async (path, options) => { call = { path, options }; return options.method === 'POST' ? [...records.values()][0] : quiz; } },
  });
  const controller = new AbortController();
  await realApi.getQuiz('lesson', controller.signal, 'alice');
  assert.equal(call.options.headers['X-ZhPath-User'], 'alice');
  assert.equal(call.options.signal, controller.signal);
  await realApi.submitQuiz('lesson', sent[0], controller.signal, 'alice');
  assert.equal(call.options.headers['X-ZhPath-User'], 'alice');
  assert.deepEqual(JSON.parse(call.options.body), sent[0]);
  console.log('PASS: storage failure, six answer types including partial order/match, forged owner, corrupt JSON, real API owner headers and retry payload');
})().catch(e => { console.error(e); process.exitCode = 1; });
