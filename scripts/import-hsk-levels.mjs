import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
// Source: https://old.chinesetest.cn/userfiles/file/HSK/HSK-2015.xlsx
// Keep only exact headwords and their first introduced level, not translations.
const book = new ExcelJS.Workbook();
await book.xlsx.readFile('outputs/hsk-2015-source.xlsx');
const levels = {};
book.worksheets[0].eachRow((row, index) => {
  if (index === 1) return;
  const level = row.getCell(1).value;
  const word = row.getCell(2).value;
  if (!Number.isInteger(level) || level < 1 || level > 6 || typeof word !== 'string') throw new Error(`Invalid row ${index}`);
  levels[word.trim()] = Math.min(levels[word.trim()] ?? 7, level);
});
await writeFile('src/api/hsk2015.json', JSON.stringify(levels, null, 2) + '\n');
console.log(`Imported ${Object.keys(levels).length} exact HSK headwords (2015).`);
