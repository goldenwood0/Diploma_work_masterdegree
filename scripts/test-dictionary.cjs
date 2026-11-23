const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { JSDOM } = require('../outputs/quiz-test-runtime/node_modules/jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const React = require('react');
const { createRoot } = require('react-dom/client');
function load(file, deps) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const scope = { exports: {}, require: id => deps[id] ?? require(id), AbortController };
  vm.runInNewContext(code, scope); return scope.exports;
}
const language = { useLanguage: () => ({ t: x => x, explanationLanguage: 'ru' }) };
const hsk = load('src/components/HskBadge.tsx', { '../api/hsk2015.json': require('../src/api/hsk2015.json'), '../i18n/LanguageProvider': language });
assert.equal(hsk.hskLevel('你'), 1);
assert.equal(hsk.hskLevel('你好世界'), undefined);
const { normalizeSearch } = load('src/api/vocabulary.ts', { './client': {} });
assert.equal(normalizeSearch('nǐ hǎo'), normalizeSearch('ni3hao3'));
assert.equal(normalizeSearch('lǜ'), normalizeSearch('lu:4'));
assert.notEqual(normalizeSearch('lǜ'), normalizeSearch('lù'));
const word = { key: '你|nǐ', known: false, inReviews: false, content: { hanzi: '你', pinyin: 'nǐ', translation: { ru: 'ты', kk: 'сен', en: 'you' } } };
let writes = 0;
const page = load('src/pages/Dictionary.tsx', {
  '../i18n/LanguageProvider': language,
  '../api/vocabulary': { normalizeSearch, loadVocabulary: async () => [{ ...word }], markKnowledge: async (_, known) => { writes++; word.known = known; word.inReviews = true; } },
  '../components/HskBadge': hsk,
  '../components/CharacterPractice': { __esModule: true, default: () => React.createElement('div', { 'data-writing': true }) },
}).default;
(async () => {
  let root = createRoot(document.getElementById('root'));
  const mount = async () => React.act(async () => root.render(React.createElement(page)));
  await mount(); assert.equal(writes, 0); assert.match(document.body.textContent, /HSK 1 · 2015/);
  assert.equal(document.querySelector('[data-writing]'), null);
  const click = async text => React.act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === text).click());
  await click('Уже знаю'); assert.equal(writes, 1); assert.equal(document.querySelector('[aria-pressed="true"]').textContent, 'Вернуть в изучение');
  await React.act(async () => root.unmount()); root = createRoot(document.getElementById('root')); await mount();
  assert.ok(document.querySelector('[aria-pressed="true"]'));
  const select = document.querySelectorAll('select')[1];
  await React.act(async () => { select.value = 'known'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.equal(document.querySelectorAll('article').length, 1);
  await click('Вернуть в изучение'); assert.equal(document.querySelectorAll('article').length, 0);
  await React.act(async () => root.unmount());
  console.log('PASS dictionary: HSK exact matches, pinyin search, no auto-import, known state, remount, filtering, undo, lazy writing');
})().catch(error => { console.error(error); process.exitCode = 1; });
