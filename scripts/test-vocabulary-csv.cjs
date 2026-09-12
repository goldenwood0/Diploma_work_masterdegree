const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const scope = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/api/vocabularyCsv.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, scope);
const { parseVocabularyCsv: parse, exportVocabularyCsv: serialize } = scope.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const word = { hanzi: '你好', pinyin: 'nǐ hǎo', translation: { ru: 'Привет, "друг"\n你好', kk: 'Сәлем', en: 'Hello' } };
assert.deepEqual(plain(parse(serialize([word]))), [word]);
assert.deepEqual(plain(parse(serialize([word]).replace(/^\uFEFF/, ''))), [word]);
for (const value of ['=1+1', '+SUM(A1)', '-1', '@SUM(A1)', "'literal", "''literal"]) {
  const item = { ...word, translation: { ...word.translation, en: value } };
  const csv = serialize([item]);
  assert.ok(csv.includes('"\''));
  assert.deepEqual(plain(parse(csv)), [item]);
}
for (const input of [
  '', 'hanzi,pinyin,ru,kk,en\n', 'pinyin,hanzi,ru,kk,en\na,b,c,d,e',
  'hanzi,pinyin,ru,kk,en\na,b,c,d', 'hanzi,pinyin,ru,kk,en\na,b,c,d,e,f',
  'hanzi,pinyin,ru,kk,en\n"a,b,c,d,e', 'hanzi,pinyin,ru,kk,en\n"a"x,b,c,d,e',
  'hanzi,pinyin,ru,kk,en\na,b,,d,e', 'hanzi,pinyin,ru,kk,en\na,b,c,d,\ufffd',
  'x'.repeat(1_000_001), serialize(Array(101).fill(word)),
  serialize([{ ...word, hanzi: '你'.repeat(4001) }]),
]) assert.throws(() => parse(input));
assert.equal(parse(serialize(Array(100).fill(word))).length, 100);
assert.equal(parse('hanzi,pinyin,ru,kk,en\ra,b,c,d,e')[0].hanzi, 'a');
console.log('Vocabulary CSV: round trips, formula escaping, malformed input and limits passed.');
