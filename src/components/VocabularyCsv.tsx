import { useRef, useState } from 'react';
import { exportVocabularyCsv, parseVocabularyCsv, type VocabularyWord } from '../api/vocabularyCsv';
import { useLanguage } from '../i18n/LanguageProvider';

export default function VocabularyCsv({ words, onChange }: { words: VocabularyWord[]; onChange: (words: VocabularyWord[]) => void }) {
  const { t, language } = useLanguage();
  const [source, setSource] = useState('');
  const [preview, setPreview] = useState<VocabularyWord[] | null>(null);
  const [error, setError] = useState('');
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
  return <details className="border border-border rounded-lg p-3 space-y-3"><summary>{t('Импорт и экспорт слов CSV')}</summary>
    <p>{t('UTF-8, разделитель — запятая. Столбцы: hanzi,pinyin,ru,kk,en. От 1 до 100 слов.')}</p>
    <button type="button" className="underline" onClick={download}>{t('Скачать слова CSV')}</button>
    <label className="block">{t('Загрузить CSV')}<input ref={file} type="file" accept=".csv,text/csv" className="block" onChange={async e => {
      const selected = e.target.files?.[0]; const current = ++sequence.current;
      setPreview(null); setError(''); setSource('');
      if (!selected) return;
      if (selected.size > 1_000_000) { setError('CSV: максимум 1 МБ.'); return; }
      try { const buffer = await selected.arrayBuffer(); const value = new TextDecoder('utf-8', { fatal: true }).decode(buffer); if (current === sequence.current) inspect(value); }
      catch { if (current === sequence.current) setError('CSV: заполните все поля и проверьте длину текста и UTF-8.'); }
    }} /></label>
    <label className="block">{t('Или вставьте CSV')}<textarea maxLength={1_000_000} rows={4} className="block w-full border border-border rounded-lg p-2" value={source} onChange={e => { sequence.current++; if (file.current) file.current.value = ''; inspect(e.target.value); }} /></label>
    {error && <p role="alert">{t(error)}</p>}
    {preview && <><p>{t('Предпросмотр импорта')} · {preview.length}</p><div className="max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th>{t('Иероглифы')}</th><th>{t('Пиньинь')}</th><th>{t('Перевод')}</th></tr></thead><tbody>{preview.map((word, i) => <tr key={i}><td>{word.hanzi}</td><td>{word.pinyin}</td><td>{word.translation[language]}</td></tr>)}</tbody></table></div>
      <p>{t('Импорт заменит слова этого блока. Для записи в базу сохраните урок.')}</p>
      <button type="button" className="border border-border rounded-lg p-2" onClick={() => { onChange(preview); setPreview(null); setSource(''); if (file.current) file.current.value = ''; }}>{t('Заменить слова блока')}</button></>}
  </details>;
}
