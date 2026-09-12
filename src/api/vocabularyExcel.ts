import ExcelJS from 'exceljs';
import { unzipSync, zipSync } from 'fflate';
import { exportVocabularyCsv, parseVocabularyCsv, type VocabularyWord } from './vocabularyCsv';

export const excelError = 'Excel: нужен файл .xlsx с одним листом, пятью текстовыми столбцами и 1–100 словами, без формул. Максимум 1 МБ.';
export async function exportVocabularyExcel(words: VocabularyWord[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Vocabulary');
  sheet.columns = ['hanzi', 'pinyin', 'ru', 'kk', 'en'].map(header => ({ header, width: 30, style: { numFmt: '@', alignment: { wrapText: true, vertical: 'top' } } }));
  words.forEach(w => sheet.addRow([w.hanzi, w.pinyin, w.translation.ru, w.translation.kk, w.translation.en]));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export async function parseVocabularyExcel(bytes: Uint8Array): Promise<VocabularyWord[]> {
  try {
    if (bytes.byteLength > 1_000_000) throw new Error();
    // Bound expansion before the workbook reader processes XML, styles or shared strings.
    let expanded = 0, entries = 0;
    const files = unzipSync(bytes, { filter: file => {
      expanded += file.originalSize; entries++;
      if (expanded > 8_000_000 || entries > 100 || /vbaProject|externalLinks|embeddings/i.test(file.name)) throw new Error();
      return true;
    } });
    if (!files['xl/workbook.xml'] || !files['[Content_Types].xml']) throw new Error();
    const workbook = new ExcelJS.Workbook();
    // Repack validated entries so both ZIP readers see the same bounded payload.
    await workbook.xlsx.load(zipSync(files) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    if (workbook.worksheets.length !== 1) throw new Error();
    const sheet = workbook.worksheets[0];
    if (sheet.rowCount < 2 || sheet.rowCount > 101 || sheet.columnCount !== 5 || sheet.model.merges?.length) throw new Error();
    const rows: string[][] = [];
    for (let r = 1; r <= sheet.rowCount; r++) {
      const values: string[] = [];
      for (let c = 1; c <= 5; c++) {
        const value = sheet.getCell(r, c).value;
        if (typeof value !== 'string') throw new Error();
        values.push(value);
      }
      rows.push(values);
    }
    if (rows.shift()!.join(',') !== 'hanzi,pinyin,ru,kk,en') throw new Error();
    const words = rows.map(([hanzi, pinyin, ru, kk, en]) => ({ hanzi, pinyin, translation: { ru, kk, en } }));
    return parseVocabularyCsv(exportVocabularyCsv(words));
  } catch { throw new Error(excelError); }
}
