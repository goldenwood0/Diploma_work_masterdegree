import { useEffect, useState } from 'react';
import { loadVocabulary, markKnowledge, normalizeSearch, type VocabularyWord } from '../api/vocabulary';
import { useLanguage } from '../i18n/LanguageProvider';
import CharacterPractice from '../components/CharacterPractice';
import HskBadge, { hskLevel } from '../components/HskBadge';
function Entry({ word, onChange }: { word: VocabularyWord; onChange: (word: VocabularyWord) => void }) {
  const { t, explanationLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function change(known = !word.known) {
    if (busy) return;
    setBusy(true); setError(false);
    try { await markKnowledge(word.key, known); onChange({ ...word, known, inReviews: true }); }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  return <article className={`min-w-0 rounded-2xl border p-5 space-y-3 ${word.known ? 'border-primary bg-secondary' : 'border-border bg-card'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><HskBadge word={word.content.hanzi} />{word.known && <span className="font-semibold text-primary">✓ {t('Уже знаю')}</span>}</div>
    <h2 lang="zh-CN" className="text-3xl">{word.content.hanzi}</h2><p className="text-primary">{word.content.pinyin}</p><p>{word.content.translation[explanationLanguage]}</p>
    <button aria-pressed={word.known} disabled={busy} onClick={() => void change()} className="min-h-11 rounded-xl border border-primary px-4 py-2 text-primary disabled:opacity-50">{t(word.known ? 'Вернуть в изучение' : 'Уже знаю')}</button>
    {!word.inReviews && <button disabled={busy} onClick={() => void change(false)} className="ml-2 min-h-11 rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{t('Добавить в повторение')}</button>}
    {word.inReviews && !word.known && <p className="text-sm text-muted-foreground">{t('В личном повторении')}</p>}
    {error && <p role="alert">{t('Не удалось сохранить карточку.')}</p>}
    <details onToggle={e => setOpen(e.currentTarget.open)}><summary className="cursor-pointer text-primary underline">{t('Практика письма')}</summary>{open && <div className="mt-4"><CharacterPractice text={word.content.hanzi} /></div>}</details>
  </article>;
}
export default function Dictionary() {
  const { t } = useLanguage();
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');
  const [knowledge, setKnowledge] = useState('all');
  const [limit, setLimit] = useState(30);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false);
    loadVocabulary(controller.signal).then(value => { if (!controller.signal.aborted) setWords(value); }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => setLimit(30), [search, level, knowledge]);
  const query = normalizeSearch(search.trim());
  const filtered = words.filter(word => (knowledge === 'all' || word.known === (knowledge === 'known')) && (level === 'all' || String(hskLevel(word.content.hanzi) ?? 'unknown') === level) && [word.content.hanzi, word.content.pinyin, ...Object.values(word.content.translation)].some(value => normalizeSearch(value).includes(query)));
  return <section className="mx-auto max-w-4xl space-y-6"><h1 className="text-3xl font-bold">{t('Словарь')}</h1>
    <p className="text-muted-foreground">{t('Слова опубликованных уроков доступны без прохождения курса. Это учебный словарь, его база будет расширяться.')}</p>
    <p className="text-sm text-muted-foreground">{t('Отметка «Уже знаю» сохраняется в аккаунте и убирает слово из повторения. Её можно снять. Это ваша самооценка, а не результат теста.')}</p>
    <p className="text-sm"><a className="underline" href="https://old.chinesetest.cn/godownload.do" target="_blank" rel="noreferrer">{t('Уровни HSK: список 2015 года')}</a>. {t('Уровень относится к целому слову. Если точного совпадения нет, HSK не указан.')}</p>
    <div className="grid gap-4 sm:grid-cols-3"><label>{t('Поиск слова')}<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="你 · nǐ · ni3" className="mt-2 block w-full rounded-xl border border-border bg-card p-3" /></label>
      <label>{t('Уровень HSK')}<select value={level} onChange={e => setLevel(e.target.value)} className="mt-2 block w-full rounded-xl border border-border bg-card p-3"><option value="all">{t('Все уровни')}</option>{[1,2,3,4,5,6].map(n => <option key={n} value={n}>HSK {n} · 2015</option>)}<option value="unknown">{t('HSK не указан')}</option></select></label>
      <label>{t('Знание слов')}<select value={knowledge} onChange={e => setKnowledge(e.target.value)} className="mt-2 block w-full rounded-xl border border-border bg-card p-3"><option value="all">{t('Все слова')}</option><option value="known">{t('Уже знаю')}</option><option value="learning">{t('Ещё изучаю')}</option></select></label></div>
    {loading ? <p role="status">{t('Загрузка…')}</p> : error ? <div role="alert"><p>{t('Не удалось загрузить карточки.')}</p><button className="underline" onClick={() => setRetry(n => n + 1)}>{t('Повторить')}</button></div> : <><p role="status">{t('Слов найдено')}: {filtered.length} · {t('Уже знаю')}: {words.filter(word => word.known).length}/{words.length}</p>{!filtered.length && <p>{t('Слова не найдены.')}</p>}<div className="grid gap-4 sm:grid-cols-2">{filtered.slice(0, limit).map(word => <Entry key={word.key} word={word} onChange={updated => setWords(current => current.map(old => old.key === updated.key ? updated : old))} />)}</div>{filtered.length > limit && <button className="rounded-xl border border-border px-4 py-3" onClick={() => setLimit(n => n + 30)}>{t('Показать ещё')}</button>}</>}
  </section>;
}
