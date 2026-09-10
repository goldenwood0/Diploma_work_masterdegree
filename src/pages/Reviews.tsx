import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import { editCard, loadReviews, rateCard, type Card, type ReviewData } from '../api/reviews';
import { ApiError } from '../api/client';
const labels: Record<string, string> = { again: 'Ещё раз', hard: 'Трудно', good: 'Хорошо', easy: 'Легко' };
function DictionaryCard({ card, onChange }: { card: Card; onChange: (value: Card) => void }) {
  const { t, explanationLanguage } = useLanguage();
  const [note, setNote] = useState(card.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function save(data: { note?: string; favorite?: boolean }) {
    if (busy) return; setBusy(true); setError(''); setSaved(false);
    try { await editCard(card.id, data); onChange({ ...card, ...data }); setSaved(true); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Не удалось сохранить карточку.'); }
    finally { setBusy(false); }
  }
  return <article className="rounded-xl border border-border bg-card p-5 space-y-3"><div className="flex justify-between gap-3"><div><p lang="zh-CN" className="text-3xl">{card.content.hanzi}</p><p className="text-primary">{card.content.pinyin}</p><p>{card.content.translation[explanationLanguage]}</p></div><button disabled={busy} aria-pressed={card.favorite} onClick={() => void save({ favorite: !card.favorite })} className="self-start border border-border rounded-lg p-2">{card.favorite ? '★' : '☆'} {t('Избранное')}</button></div>
    <label className="block"><span className="text-sm">{t('Заметка')}</span><textarea maxLength={2000} value={note} onChange={e => { setNote(e.target.value); setSaved(false); }} className="w-full border border-border bg-background rounded-lg p-2" /></label>
    <button disabled={busy || note === card.note} onClick={() => void save({ note })} className="text-primary underline disabled:opacity-40">{t('Сохранить заметку')}</button>
    {saved && <p role="status">{t('Сохранено')}</p>}{error && <p role="alert">{t(error)}</p>}
  </article>;
}
export default function Reviews() {
  const { t, explanationLanguage: lang, language } = useLanguage();
  const [data, setData] = useState<ReviewData | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState(false);
  const [mode, setMode] = useState('hanzi');
  const [audioError, setAudioError] = useState(false);
  const lifecycle = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); lifecycle.current = controller; setError(''); setData(null); setBusy(false); pending.current = false; setRevealed(false);
    loadReviews(controller.signal).then(value => { if (!controller.signal.aborted) setData(value); }).catch(err => { if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить карточки.'); });
    return () => controller.abort();
  }, [reload]);
  const card = data?.cards.find(c => c.id === data.queue[0]);
  useEffect(() => { setRevealed(false); setAudioError(false); }, [card?.id, mode]);
  async function rate(rating: string) {
    if (!card || !data || !revealed || pending.current || !lifecycle.current) return;
    const signal = lifecycle.current.signal; const key = `${card.id}:${card.version}:${rating}`;
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await rateCard(card.id, { rating, version: card.version, requestId: retry.current.id }, signal);
      if (!signal.aborted) {
        const event = { id: retry.current!.id, cardId: card.id, rating, createdAt: new Date().toISOString(), result };
        setData(current => current ? { ...current, cards: current.cards.map(c => c.id === card.id ? { ...c, ...result } : c), queue: current.queue.filter(id => id !== card.id), reviewedToday: current.reviewedToday + 1, remainingNew: Math.max(0, current.remainingNew - (card.version === 0 ? 1 : 0)), history: [event, ...current.history].slice(0, 30) } : current);
        setRevealed(false);
      }
    } catch (err) { if (!signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось сохранить карточку.'); }
    finally { if (!signal.aborted) { pending.current = false; setBusy(false); } }
  }
  const query = search.trim().toLocaleLowerCase();
  const filtered = data?.cards.filter(c => (!favorites || c.favorite) && [c.content.hanzi, c.content.pinyin, ...Object.values(c.content.translation)].some(value => value.toLocaleLowerCase().includes(query))) ?? [];
  const date = (value: string) => new Date(value).toLocaleString(language === 'kk' ? 'kk-KZ' : language, { timeZone: data?.timezone });
  return <section className="max-w-4xl mx-auto space-y-6"><h1 className="text-3xl font-bold text-dark-green">{t('Словарь и повторение')}</h1>
    {error && <div role="alert"><p>{t(error)}</p><button disabled={busy} className="underline" onClick={() => setReload(n => n + 1)}>{t('Обновить карточки')}</button></div>}
    {!data && !error && <p role="status">{t('Загрузка…')}</p>}
    {data && <><p>{t('Повторений сегодня')}: {data.reviewedToday} · {t('Новых осталось')}: {data.remainingNew}/{data.newLimit} · {data.timezone}</p>
      <div className="bg-secondary rounded-2xl p-5 sm:p-8 space-y-5"><h2 className="text-xl font-bold">{t('Очередь повторения')} · {data.queue.length}</h2>
        <label className="block">{t('Режим')} <select disabled={busy} value={mode} onChange={e => setMode(e.target.value)} className="border border-border rounded-lg p-2 bg-background"><option value="hanzi">{t('Иероглифы')}</option><option value="translation">{t('Перевод')}</option><option value="reading">{t('Чтение пиньинь')}</option><option value="audio">{t('Аудио')}</option></select></label>
        {!card ? <><p role="status">{t(data.cards.length ? 'Очередь завершена. Возвращайтесь к следующему повторению.' : 'Завершите урок, чтобы добавить слова.')}</p>{data.cards.length > 0 && <p>{t('Ближайшее повторение')}: {date(data.cards.filter(c => c.version > 0).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt ?? data.serverNow)}</p>}<button className="underline" onClick={() => setReload(n => n + 1)}>{t('Обновить карточки')}</button><a className="block text-primary underline" href="#/courses">{t('Курсы')}</a></> : <div className="space-y-4" key={card.id}>
          {mode === 'audio' ? card.content.hanzi === '你好' ? <><audio controls preload="none" src="https://upload.wikimedia.org/wikipedia/commons/7/7d/Zh_n%C7%90_h%C7%8Eo.ogg" onError={() => setAudioError(true)} className="w-full" aria-label={t('Аудио')} /><p className="text-xs"><a href="https://commons.wikimedia.org/wiki/File:Zh_n%C7%90_h%C7%8Eo.ogg" target="_blank" rel="noreferrer" className="underline">Sjors Provoost · Wikimedia Commons</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer" className="underline">CC BY-SA 3.0</a> · {t('Запись без изменений')}</p>{audioError && <p role="alert">{t('Аудио недоступно. Проверьте соединение и повторите.')}</p>}</> : <p>{t('Запись этого слова пока не добавлена. Выберите другой режим.')}</p> : <p className="text-4xl leading-relaxed">{mode === 'translation' ? card.content.translation[lang] : mode === 'reading' ? card.content.pinyin : card.content.hanzi}</p>}
          {!revealed ? <button disabled={mode === 'audio' && (card.content.hanzi !== '你好' || audioError)} className="rounded-xl bg-primary text-primary-foreground px-6 py-3 disabled:opacity-40" onClick={() => setRevealed(true)}>{t('Показать ответ')}</button> : <><div className="bg-card rounded-xl p-5 space-y-2"><p lang="zh-CN" className="text-3xl">{card.content.hanzi}</p><p>{card.content.pinyin}</p><p>{card.content.translation[lang]}</p></div><p>{t('Оцените, насколько легко вспомнили ответ.')}</p><div className="flex flex-wrap gap-2">{Object.entries(labels).map(([rating, label]) => <button key={rating} disabled={busy} onClick={() => void rate(rating)} className="border border-border bg-card rounded-xl px-4 py-3 disabled:opacity-40">{t(label)}</button>)}</div></>}
        </div>}
      </div>
      <h2 className="text-2xl font-semibold">{t('Мой словарь')} · {data.cards.length}</h2><label className="block">{t('Поиск слова')}<input type="search" value={search} onChange={e => setSearch(e.target.value)} className="block w-full border border-border rounded-xl p-3 mt-2" /></label><label className="flex gap-2"><input type="checkbox" checked={favorites} onChange={e => setFavorites(e.target.checked)} />{t('Только избранное')}</label>
      {filtered.length === 0 && <p>{t('Слова не найдены.')}</p>}<div className="grid sm:grid-cols-2 gap-4">{filtered.map(c => <DictionaryCard key={c.id} card={c} onChange={value => setData(current => current ? { ...current, cards: current.cards.map(old => old.id === value.id ? { ...old, note: value.note, favorite: value.favorite } : old) } : current)} />)}</div>
      <details className="border border-border rounded-xl p-4"><summary>{t('Последние 30 повторений')}</summary><ul className="space-y-2 mt-4">{data.history.map(e => <li key={e.id}>{data.cards.find(c => c.id === e.cardId)?.content.hanzi} · {t(labels[e.rating] ?? e.rating)} · {date(e.createdAt)} → {date(e.result.dueAt)}</li>)}</ul></details>
    </>}
  </section>;
}
