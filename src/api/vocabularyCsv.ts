export type VocabularyWord = { hanzi: string; pinyin: string; translation: { ru: string; kk: string; en: string } };
const headers = ['hanzi', 'pinyin', 'ru', 'kk', 'en'];
const unsafe = /^[\s\u0000-\u001f]*[=+@-]/;
const protect = (value: string) => unsafe.test(value) || value.startsWith("'") ? "'" + value : value;
const unprotect = (value: string) => value.startsWith("'") && (unsafe.test(value.slice(1)) || value.startsWith("''")) ? value.slice(1) : value;
export function exportVocabularyCsv(words: VocabularyWord[]) {
  const quote = (value: string) => '"' + protect(value).replace(/"/g, '""') + '"';
  return '\uFEFF' + [headers.join(','), ...words.map(w => [w.hanzi, w.pinyin, w.translation.ru, w.translation.kk, w.translation.en].map(quote).join(','))].join('\r\n') + '\r\n';
}
export function parseVocabularyCsv(source: string): VocabularyWord[] {
  if (source.length > 1_000_000) throw new Error('CSV: максимум 1 МБ.');
  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const fail = () => { throw new Error('CSV: неверные кавычки или число столбцов.'); };
  const endCell = () => { row.push(cell); cell = ''; closed = false; if (row.length > 5) fail(); };
  const endRow = () => { endCell(); rows.push(row); row = []; if (rows.length > 101) throw new Error('CSV: требуется от 1 до 100 слов.'); };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += char;
    } else if (char === ',') endCell();
    else if (char === '\n' || char === '\r') { if (char === '\r' && text[i + 1] === '\n') i++; endRow(); }
    else if (char === '"' && !cell && !closed) quoted = true;
    else { if (closed || char === '"') fail(); cell += char; }
  }
  if (quoted) fail();
  if (cell || row.length || closed) endRow();
  if (JSON.stringify(rows.shift()) !== JSON.stringify(headers)) throw new Error('CSV: нужны столбцы hanzi,pinyin,ru,kk,en.');
  if (!rows.length) throw new Error('CSV: требуется от 1 до 100 слов.');
  return rows.map(values => {
    if (values.length !== 5) fail();
    const fields = values.map(value => unprotect(value).trim());
    if (fields.some((value, i) => !value || value.length > (i === 0 ? 4000 : 8000) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/.test(value))) throw new Error('CSV: заполните все поля и проверьте длину текста и UTF-8.');
    const [hanzi, pinyin, ru, kk, en] = fields;
    return { hanzi, pinyin, translation: { ru, kk, en } };
  });
}
