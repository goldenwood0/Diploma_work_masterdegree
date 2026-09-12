import { useRef, useState } from 'react';
import { exportVocabularyCsv, parseVocabularyCsv, type VocabularyWord } from '../api/vocabularyCsv';
import { useLanguage } from '../i18n/LanguageProvider';

export default function VocabularyCsv({ words, onChange }: { words: VocabularyWord[]; onChange: (words: VocabularyWord[]) => void }) {
  const { t, language } = useLanguage();
  const [source, setSource] = useState('');
  const [preview, setPreview] = useState<VocabularyWord[] | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const inspect = (value: string) => {
    setSource(value); setPreview(null); setError('');
    try { setPreview(parseVocabularyCsv(value)); } catch (err) { setError((err as Error).message); }
  };
  function download() {
    const url = URL.createObjectURL(new Blob([exportVocabularyCsv(words)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'vocabulary.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function downloadExcel() {
    setExporting(true); setError('');
    try {
      const { exportVocabularyExcel } = await import('../api/vocabularyExcel');
      const bytes = await exportVocabularyExcel(words);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a'); link.href = url; link.download = 'vocabulary.xlsx'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Не удалось создать Excel. Повторите попытку.'); }
    finally { setExporting(false); }
  }
  return <details className="border border-border rounded-lg p-3 space-y-3"><summary>{t('Импорт и экспорт слов CSV / Excel')}</summary>
    <p>{t('UTF-8, разделитель — запятая. Столбцы: hanzi,pinyin,ru,kk,en. От 1 до 100 слов.')}</p>
    <button type="button" className="underline" onClick={download}>{t('Скачать слова CSV')}</button>
    <button type="button" disabled={exporting} className="underline ml-4 disabled:opacity-40" onClick={() => void downloadExcel()}>{t('Скачать слова Excel')}</button><p>{t('Excel: один лист, текстовые ячейки без формул. Столбцы: hanzi,pinyin,ru,kk,en.')}</p>
    <label className="block">{t('Загрузить CSV или Excel')}<input ref={file} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="block" onChange={async e => {
      const selected = e.target.files?.[0]; const current = ++sequence.current;
      setPreview(null); setError(''); setSource('');
      if (!selected) return;
      if (selected.size > 1_000_000) { setError('Файл: максимум 1 МБ.'); return; }
      try {
        const buffer = await selected.arrayBuffer();
        if (selected.name.toLowerCase().endsWith('.xlsx')) {
          const { parseVocabularyExcel } = await import('../api/vocabularyExcel');
          try { const words = await parseVocabularyExcel(new Uint8Array(buffer)); if (current === sequence.current) setPreview(words); }
          catch (err) { if (current === sequence.current) setError((err as Error).message); }
        } else {
          const value = new TextDecoder('utf-8', { fatal: true }).decode(buffer); if (current === sequence.current) inspect(value);
        }
      }
      catch { if (current === sequence.current) setError('CSV: заполните все поля и проверьте длину текста и UTF-8.'); }
    }} /></label>
    <label className="block">{t('Или вставьте CSV')}<textarea maxLength={1_000_000} rows={4} className="block w-full border border-border rounded-lg p-2" value={source} onChange={e => { sequence.current++; if (file.current) file.current.value = ''; inspect(e.target.value); }} /></label>
    {error && <p role="alert">{t(error)}</p>}
    {preview && <><p>{t('Предпросмотр импорта')} · {preview.length}</p><div className="max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th>{t('Иероглифы')}</th><th>{t('Пиньинь')}</th><th>{t('Перевод')}</th></tr></thead><tbody>{preview.map((word, i) => <tr key={i}><td>{word.hanzi}</td><td>{word.pinyin}</td><td>{word.translation[language]}</td></tr>)}</tbody></table></div>
      <p>{t('Импорт заменит слова этого блока. Для записи в базу сохраните урок.')}</p>
      <button type="button" className="border border-border rounded-lg p-2" onClick={() => { onChange(preview); setPreview(null); setSource(''); if (file.current) file.current.value = ''; }}>{t('Заменить слова блока')}</button></>}
  </details>;
}
