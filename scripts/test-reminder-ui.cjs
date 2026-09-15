const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, dependencies = {}) {
  const scope = { exports: {}, require: name => dependencies[name] ?? require(name) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, scope);
  return scope.exports;
}
const dictionary = load('src/i18n/learningMessages.ts').learningMessages;
let language = 'ru';
const translations = { useLanguage: () => ({ language, setLanguage() {}, t: key => language === 'ru' ? key : dictionary[key]?.[language] ?? key }) };
const Form = load('src/components/ProfileForm.tsx', {
  '../api/auth': { saveProfile() {} }, '../i18n/LanguageProvider': translations,
  '../i18n/translate': { isLanguage: () => true }, './ReminderStatus': { default: () => null },
}).default;
const account = { name: 'Learner', settings: { onboardingCompletedAt: '2026-09-15', timezone: 'Asia/Qyzylorda', remindersEnabled: true, reminderTime: '08:45' } };
for (language of ['ru', 'kk', 'en']) {
  const html = renderToStaticMarkup(React.createElement(Form, { account, onSaved() {} }));
  assert.ok(html.includes('type="time"') && html.includes('value="08:45"'));
  assert.ok(html.includes(language === 'ru' ? 'Время напоминания' : dictionary['Время напоминания'][language]));
}
for (const available of [true, false]) for (const status of ['SENDING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED_GOAL']) {
  let index = 0;
  const states = [{ available, latest: { status, attemptedAt: '2026-09-15T12:00:00Z' } }, false, 0];
  const Status = load('src/components/ReminderStatus.tsx', {
    react: { ...React, useEffect() {}, useState: () => [states[index++], () => {}] },
    '../api/client': { request() { throw Error('unexpected request'); } },
    '../i18n/LanguageProvider': translations,
  }).default;
  const html = renderToStaticMarkup(React.createElement(Status));
  assert.ok(html.includes('role="status"'));
  assert.ok(!html.includes('undefined'));
  assert.ok(html.includes(available ? dictionary['Сервис напоминаний включён. Вы можете отключить письма настройкой выше.'].en : dictionary['Напоминания временно недоступны. Ваши настройки будут сохранены.'].en));
}
console.log('Reminder UI: saved local time in 3 languages and 10 service/delivery states passed.');
