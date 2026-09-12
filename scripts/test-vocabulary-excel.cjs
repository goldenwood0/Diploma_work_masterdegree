const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { zipSync } = require('fflate');
function load(file, dependencies = {}) {
  const compiled = new Module(path.resolve(file), module);
  compiled.filename = path.resolve(file);
  compiled.paths = module.paths;
  compiled.require = name => dependencies[name] ?? require(name);
  compiled._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, compiled.filename);
  return compiled.exports;
}
const csv = load('src/api/vocabularyCsv.ts');
const { parseVocabularyExcel: parse, exportVocabularyExcel: serialize } = load('src/api/vocabularyExcel.ts', { './vocabularyCsv': csv });
const word = { hanzi: '你好', pinyin: 'nǐ hǎo', translation: { ru: 'Привет, "друг"\n你好', kk: 'Сәлем', en: '=1+1' } };
const plain = value => JSON.parse(JSON.stringify(value));
async function workbook(change) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await serialize([word]));
  change(book, book.worksheets[0]);
  return new Uint8Array(await book.xlsx.writeBuffer());
}
(async () => {
  assert.deepEqual(plain(await parse(await serialize([word]))), [word]);
  assert.equal((await parse(await serialize(Array(100).fill(word)))).length, 100);
  for (const change of [
    (b, s) => { s.getCell('E2').value = { formula: '1+1', result: 2 }; },
    (b, s) => { s.getCell('E2').value = 123; },
    (b, s) => { s.getCell('E2').value = null; },
    (b, s) => { s.getCell('E2').value = { text: 'link', hyperlink: 'https://example.com' }; },
    (b, s) => { s.getCell('F2').value = 'extra'; },
    (b, s) => { s.getCell('A1').value = 'wrong'; },
    (b, s) => { s.mergeCells('A2:B2'); },
    b => { b.addWorksheet('Extra'); },
  ]) await assert.rejects(parse(await workbook(change)));
  for (const bytes of [new Uint8Array([1, 2, 3]), new Uint8Array(1_000_001), await serialize([]), await serialize(Array(101).fill(word)), zipSync({ 'xl/workbook.xml': new Uint8Array(8_000_001) })]) await assert.rejects(parse(bytes));
  console.log('Vocabulary Excel: Unicode round trip, 100 words, formulas, types, columns, sheets, merges, invalid ZIP and expansion limit passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
