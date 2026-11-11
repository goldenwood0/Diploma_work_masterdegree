const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { JSDOM } = require('../outputs/quiz-test-runtime/node_modules/jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const React = require('react');
const { createRoot } = require('react-dom/client');
let rated = 0;
const cards = ['你', '好'].map((hanzi, i) => ({ id: String(i), version: 0, note: '', favorite: false, content: { hanzi, pinyin: 'test', translation: { ru: 'слово', kk: 'сөз', en: 'word' } } }));
const deps = {
 '../components/HskBadge': { __esModule: true, default: () => null },
 '../i18n/LanguageProvider': { useLanguage: () => ({ t: x => x, explanationLanguage: 'ru', language: 'ru' }) },
 '../api/client': { ApiError: Error },
 '../api/reviews': { loadReviews: async () => ({ cards, queue: ['0','1'], history: [], reviewedToday: 0, remainingNew: 10, newLimit: 10, timezone: 'Asia/Qyzylorda' }), editCard: async () => {}, rateCard: async () => { rated++; return { version: 1, dueAt: '2026-10-25T12:00:00Z' }; } },
 '../components/StudyTimeTracker': { __esModule: true, default: () => null },
 '../components/CharacterPractice': { __esModule: true, default: ({text}) => React.createElement('div', {'data-writing':text}, text) },
};
const code = ts.transpileModule(fs.readFileSync('src/pages/Reviews.tsx','utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const scope = {exports:{},require:id=>deps[id]??require(id),AbortController,crypto:require('node:crypto').webcrypto};
vm.runInNewContext(code,scope);
(async()=>{
 const root=createRoot(document.getElementById('root'));
 await React.act(async()=>root.render(React.createElement(scope.exports.default)));
 assert.ok(!document.body.textContent.includes('Asia/Qyzylorda'));
 const queue=document.querySelector('select').parentElement.parentElement;
 const open=async()=>{const d=queue.querySelector('details');assert.ok(d);await React.act(async()=>{d.open=true;d.dispatchEvent(new dom.window.Event('toggle'));});};
 await open(); assert.equal(queue.querySelector('[data-writing]').getAttribute('data-writing'),'你');assert.equal(rated,0);
 await React.act(async()=>{const s=document.querySelector('select');s.value='translation';s.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 assert.equal(queue.querySelector('details'),null);
 await React.act(async()=>[...queue.querySelectorAll('button')].find(b=>b.textContent==='Показать ответ').click());
 await open(); assert.equal(queue.querySelector('[data-writing]').getAttribute('data-writing'),'你');
 await React.act(async()=>[...queue.querySelectorAll('button')].find(b=>b.textContent==='Хорошо').click());
 assert.equal(rated,1);assert.equal(queue.querySelector('details'),null);
 assert.equal(document.querySelectorAll('article details').length,2);
 await React.act(async()=>root.unmount());
 console.log('PASS review writing: lazy open, correct character, no premature answer, card change reset, no automatic rating, dictionary practice, hidden timezone');
})().catch(e=>{console.error(e);process.exitCode=1});
