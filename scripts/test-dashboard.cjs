const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, dependencies = {}) {
  const scope = { exports: {}, require: name => dependencies[name] ?? require(name), Intl, Date };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, scope);
  return scope.exports;
}
const recommend = load('src/app/studyRecommendation.ts').default;
const lesson = (id, nextBlock = 0, completedAt = null, locked = false) => ({ id, slug: id, title: { ru: id, kk: id, en: id }, blockCount: 3, locked, progress: { nextBlock, completedAt } });
const fresh = lesson('fresh'), started = lesson('started', 1), finished = lesson('finished', 3, '2026-09-15'), locked = lesson('locked', 1, null, true);
const cases = [
  [[fresh, started, finished], 2, ['finished'], 'reviews', null],
  [[fresh, started, finished], 0, ['finished'], 'continue', 'started'],
  [[fresh, finished], 0, ['finished'], 'mistakes', 'finished'],
  [[fresh, finished], 0, [], 'start', 'fresh'],
  [[locked, fresh], 0, ['locked', 'missing'], 'start', 'fresh'],
  [[finished], 0, [], 'complete', null],
  [[locked], 0, [], 'catalog', null],
  [[], 0, [], 'catalog', null],
];
const messages = load('src/i18n/learningMessages.ts').learningMessages;
let current, language = 'ru', navigation;
const Dashboard = load('src/pages/Dashboard.tsx', {
  '../app/useStudyDashboard': { default: () => current },
  '../app/studyRecommendation': { default: recommend },
  '../i18n/LanguageProvider': { useLanguage: () => ({ language, t: key => language === 'ru' ? key : messages[key]?.[language] ?? key }) },
  '../components/LearningStats': { default: () => null },
}).default;
function buttons(element) {
  if (!element || typeof element !== 'object') return [];
  return [...(element.type === 'button' ? [element] : []), ...React.Children.toArray(element.props?.children).flatMap(buttons)];
}
for (const [lessons, ready, mistakes, kind, id] of cases) {
  const action = recommend(lessons, ready, mistakes);
  assert.equal(action.kind, kind); assert.equal(action.lesson?.id ?? null, id);
  current = { data: {
    catalog: { curricula: [{ levels: [{ units: [{ lessons }] }] }] },
    reviews: { ready, dueReviews: ready, availableNew: 0, deferredNew: 0, remainingNew: 10, newLimit: 10, reviewedToday: 0, totalCards: ready, timezone: 'Asia/Qyzylorda', nextReviewAt: null },
    stats: { mistakeLessonIds: mistakes },
  }, error: false, retry() {} };
  for (language of ['ru', 'kk', 'en']) {
    const tree = Dashboard({ name: 'Learner', onNavigate: (...args) => { navigation = args; } });
    const html = renderToStaticMarkup(tree);
    assert.ok(html.includes('review-summary-title') && html.includes('next-action-title'));
    const actions = buttons(tree);
    actions[0].props.onClick(); assert.equal(navigation[0], 'reviews');
    actions[1].props.onClick();
    assert.equal(navigation[0], kind === 'reviews' ? 'reviews' : id ? 'lesson' : 'catalog');
    if (id) assert.equal(navigation[1], id);
  }
}
current = { data: null, error: false };
assert.ok(renderToStaticMarkup(Dashboard({ name: 'Learner', onNavigate() {} })).includes('role="status"'));
let retried = false;
current = { data: null, error: true, retry() { retried = true; } };
const failed = Dashboard({ name: 'Learner', onNavigate() {} });
assert.ok(renderToStaticMarkup(failed).includes('role="alert"'));
assert.ok(!renderToStaticMarkup(failed).includes('review-summary-title'));
buttons(failed)[0].props.onClick(); assert.ok(retried);
console.log('8 recommendation scenarios, 24 localized dashboard renders and navigation, loading/error/retry passed.');
