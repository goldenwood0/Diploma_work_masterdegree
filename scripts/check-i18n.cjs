const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const scope = { exports: {}, require: name => dependencies[name] };
  vm.runInNewContext(source, scope);
  return scope.exports;
}
const dictionary = load('src/i18n/messages.ts', { './learningMessages': load('src/i18n/learningMessages.ts') });
const { translate } = load('src/i18n/translate.ts', { './messages': dictionary });
assert.equal(translate('Главная', 'ru'), 'Главная');
assert.equal(translate('Главная', 'en'), 'Home');
assert.equal(translate('Главная', 'kk'), 'Басты бет');
assert.equal(translate('Missing translation', 'kk'), 'Missing translation');
dictionary.messages['Fallback check'] = { en: '', kk: ' ' };
assert.equal(translate('Fallback check', 'en'), 'Fallback check');
assert.equal(translate('Fallback check', 'kk'), 'Fallback check');
delete dictionary.messages['Fallback check'];
for (const [key, value] of Object.entries(dictionary.messages)) {
  for (const language of ['en', 'kk']) assert.ok(value[language]?.trim(), `Missing ${language}: ${key}`);
}
function inspect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'i18n') inspect(file); continue; }
    if (!file.endsWith('.tsx')) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && ['t', 'explain'].includes(node.expression.getText(source))) {
        for (const arg of node.arguments) {
          function check(value) {
            if (ts.isStringLiteral(value) && /[А-Яа-яЁё]/.test(value.text)) assert.ok(dictionary.messages[value.text], `${file}: untranslated key ${value.text}`);
            ts.forEachChild(value, check);
          }
          check(arg);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
inspect('src');
console.log(`Three languages, missing/empty fallback and ${Object.keys(dictionary.messages).length} translation entries checked.`);
