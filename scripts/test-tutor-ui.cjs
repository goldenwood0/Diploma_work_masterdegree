// Render/contract checks only; this does not simulate a browser or claim visual QA.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const scope = { exports: {}, require: id => id in deps ? deps[id] : require(id) };
  vm.runInNewContext(code, scope); return scope.exports;
}
const learning = load('src/i18n/learningMessages.ts');
const dictionary = load('src/i18n/messages.ts', { './learningMessages': learning });
const { translate } = load('src/i18n/translate.ts', { './messages': dictionary });
const client = load('src/api/client.ts');
let failStatus = 0; let called;
const api = load('src/api/tutor.ts', { './client': { ...client, request: async (path, options) => {
  called = { path, options }; if (failStatus) throw new client.ApiError(failStatus, 'private provider details');
  return { text: 'TEST ONLY', provider: 'test' };
} } });
for (const language of ['ru', 'kk', 'en']) {
  const panel = load('src/components/AiTutorPanel.tsx', { '../api/tutor': api, '../i18n/LanguageProvider': { useLanguage: () => ({ t: key => translate(key, language), explanationLanguage: language }) } }).default;
  const html = renderToStaticMarkup(React.createElement(panel, { lessonSlug: 'fixture', onClose() {} }));
  assert.match(html, /role="dialog"/); assert.match(html, /aria-modal="true"/);
  assert.ok(html.includes(translate('Проверка доступности помощника…', language)));
  for (const key of ['Объясни правило', 'Проверь мою фразу', 'Начать диалог', 'Тренировочные вопросы']) assert.ok(html.includes(translate(key, language)));
  assert.match(html, /maxLength="1500"/); assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /В сети|Отлично справляешься/);
  const outside = renderToStaticMarkup(React.createElement(panel, { onClose() {} }));
  assert.ok(outside.includes(translate('Откройте урок, чтобы обсудить его материал.', language)));
  for (const status of [0, 401, 402, 403, 404, 413, 429, 502, 503, 504]) {
    const message = api.tutorError(new client.ApiError(status, 'private provider details'));
    assert.ok(dictionary.messages[message], `${language}: ${message}`);
    assert.doesNotMatch(translate(message, language), /private provider/);
  }
}
(async () => {
  const c = new AbortController();
  const value = await api.askTutor({ lessonSlug: 'fixture', mode: 'explain', text: '', history: [] }, c.signal);
  assert.equal(value.provider, 'test'); assert.equal(called.path, '/tutor/ask'); assert.equal(called.options.signal, c.signal);
  assert.equal(JSON.parse(called.options.body).lessonSlug, 'fixture');
  failStatus = 504; await assert.rejects(api.askTutor({ lessonSlug: 'fixture', mode: 'explain', text: '', history: [] }, c.signal));
  console.log('PASS: ru/kk/en tutor initial render, 4 modes, missing lesson, 10 error translations, API payload and AbortSignal. Browser states/visual QA remain separate.');
})().catch(e => { console.error(e); process.exitCode = 1; });
