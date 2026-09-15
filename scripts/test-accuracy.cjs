const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, dependencies = {}) {
  const scope = { exports: {}, require: name => dependencies[name] ?? require(name) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, scope);
  return scope.exports;
}
const labels = load('src/app/assessmentLabels.ts');
const dictionary = load('src/i18n/learningMessages.ts').learningMessages;
let language = 'ru';
const Accuracy = load('src/components/AccuracyStats.tsx', {
  '../app/assessmentLabels': labels,
  '../i18n/LanguageProvider': { useLanguage: () => ({ t: key => language === 'ru' ? key : dictionary[key]?.[language] ?? key }) },
}).default;
const data = {
  topicAccuracy: Object.keys(labels.topicLabels).map((key, i) => ({ key, total: i === 2 ? 0 : 3, correct: i === 0 ? 2 : 0 })),
  skillAccuracy: Object.keys(labels.skillLabels).map(key => ({ key, total: 0, correct: 0 })),
  unclassifiedTopics: 4, unclassifiedSkills: 5,
};
for (language of ['ru', 'kk', 'en']) {
  const html = renderToStaticMarkup(React.createElement(Accuracy, { data }));
  assert.ok(html.includes('67%')); assert.ok(html.includes('0%'));
  assert.ok(!html.includes('NaN') && !html.includes('Infinity'));
  for (const label of Object.values(labels.skillLabels)) assert.ok(html.includes(language === 'ru' ? label : dictionary[label][language]));
  assert.ok(html.includes(language === 'ru' ? 'Нет данных' : dictionary['Нет данных'][language]));
  assert.ok(html.includes('scope="col"') && html.includes('scope="row"'));
}
const { editorQuestionSchema } = load('src/api/contentQuiz.ts');
const title = { ru: 'test', kk: 'test', en: 'test' };
const question = { id: '1', kind: 'input', prompt: title, explanation: title, accepted: ['test'], topic: 'courtesy', skill: 'vocabulary' };
assert.equal(editorQuestionSchema.parse(question).topic, 'courtesy');
assert.equal(editorQuestionSchema.parse(question).skill, 'vocabulary');
assert.ok(editorQuestionSchema.safeParse({ ...question, skill: 'choice' }).success === false);
console.log('Accuracy: 3 localized tables, zero vs missing data, rounding, accessible headings and editor metadata passed.');
