const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { JSDOM } = require('../outputs/quiz-test-runtime/node_modules/jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const React = require('react');
const { createRoot } = require('react-dom/client');
function load(file, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const scope = { exports: {}, require: id => id in deps ? deps[id] : require(id), AbortController };
  vm.runInNewContext(code, scope); return scope.exports;
}
const messages = load('src/i18n/learningMessages.ts').learningMessages;
let lang = 'ru', complete = false, passed;
const text = { ru: 'Тест', kk: 'Сынақ', en: 'Test' };
const navigation = [];
const Lesson = load('src/pages/Lesson.tsx', {
  '../api/learning': { getLesson: async () => ({ id: 'pilot', title: text, revision: 1,
    progress: { nextBlock: 1, completedAt: complete ? '2026-10-16T00:00:00Z' : null },
    quiz: { kind: 'module' }, blocks: [{ id: 'block', kind: 'reading', content: { title: text, text, hanzi: '你好', pinyin: 'nǐ hǎo', translation: text } }] }) },
  '../api/client': { ApiError: Error },
  '../i18n/LanguageProvider': { useLanguage: () => ({ language: lang, explanationLanguage: lang, t: key => lang === 'ru' ? key : messages[key]?.[lang] || key }) },
  '../components/LessonAudio': { __esModule: true, default: () => null },
  '../components/CharacterPractice': { __esModule: true, default: () => null },
  '../components/StudyTimeTracker': { __esModule: true, default: () => null },
  '../components/QuizPanel': { __esModule: true, default: ({ onPassed }) => { passed = onPassed; return null; } },
}).default;
(async () => {
  const root = createRoot(document.getElementById('root'));
  for (lang of ['ru', 'kk', 'en']) {
    const label = lang === 'ru' ? 'Пилотный модуль завершён.' : messages['Пилотный модуль завершён.'][lang];
    complete = false;
    await React.act(async () => root.render(React.createElement(Lesson, { key: lang, slug: 'pilot', userId: 'a', onNavigate: value => navigation.push(value) })));
    assert.ok(!document.body.textContent.includes(label));
    await React.act(async () => passed('2026-10-16T00:00:00Z'));
    assert.ok(document.body.textContent.includes(label));
    const review = lang === 'ru' ? 'Повторить слова' : messages['Повторить слова'][lang];
    await React.act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === review).click());
    assert.equal(navigation.at(-1), 'reviews');
    complete = true;
    await React.act(async () => root.render(React.createElement(Lesson, { key: `${lang}-reload`, slug: 'pilot', userId: 'a', onNavigate: value => navigation.push(value) })));
    assert.ok(document.body.textContent.includes(label));
    console.log(`PASS ${lang}: completion after pass and reload, review navigation`);
  }
  await React.act(async () => root.unmount());
})().catch(error => { console.error(error); process.exitCode = 1; });

