import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { loadReviews, rateCard, type Card } from '../api/reviews';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';

const LIMIT = 3;

// Stage 4: repeat weak words inside a lesson. Shows up to three due cards that were already
// reviewed before (new words stay on the review page and its daily limit).
export default function LessonWarmup() {
  const { t, explanationLanguage: lang } = useLanguage();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    loadReviews(controller.signal)
      .then(data => { if (!controller.signal.aborted) setCards(data.queue.map(id => data.cards.find(c => c.id === id)).filter((c): c is Card => !!c && c.repetitions > 0).slice(0, LIMIT)); })
      // The warm-up is optional: a failure must not block the lesson.
      .catch(() => { if (!controller.signal.aborted) setCards([]); });
    return () => controller.abort();
  }, []);
  if (closed || !cards || cards.length === 0) return null;
  const card = cards[index];
  async function rate(remembered: boolean) {
    if (!card || busy || !lifetime.current) return;
    const signal = lifetime.current.signal;
    const rating = remembered ? 'good' : 'again';
    const key = `${card.id}:${card.version}:${rating}`;
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      await rateCard(card.id, { rating, version: card.version, requestId: retry.current.id }, signal);
      if (!signal.aborted) { setRevealed(false); setIndex(i => i + 1); }
    } catch (err) { if (!signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось сохранить карточку.'); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  return <section aria-labelledby="warmup-title" className="space-y-4 rounded-2xl border border-border bg-secondary p-5">
    <div className="flex items-center gap-3">
      <RefreshCw size={22} className="shrink-0 text-primary" aria-hidden="true" />
      <h2 id="warmup-title" className="text-lg font-bold text-dark-green">{t('Разминка: повторите слова')}</h2>
      <span className="ml-auto tabular-nums text-muted-foreground">{Math.min(index + 1, cards.length)} / {cards.length}</span>
    </div>
    {!card ? <div className="flex flex-wrap items-center gap-3">
      <p role="status" className="font-semibold text-primary">{t('Разминка завершена. Переходите к уроку.')}</p>
      <button type="button" className="min-h-11 rounded-xl px-3 underline" onClick={() => setClosed(true)}>{t('Скрыть')}</button>
    </div> : <>
      <p lang="zh-CN" className="sc-text text-4xl">{card.content.hanzi}</p>
      {revealed && <div><p className="text-lg text-primary">{card.content.pinyin}</p><p>{card.content.translation[lang]}</p></div>}
      {error && <p role="alert">{t(error)}</p>}
      <div className="flex flex-wrap gap-3">
        {!revealed
          ? <button type="button" className="min-h-11 rounded-xl bg-primary px-5 font-bold text-primary-foreground" onClick={() => setRevealed(true)}>{t('Показать ответ')}</button>
          : <>
            <button type="button" disabled={busy} className="min-h-11 rounded-xl border border-border bg-card px-5 font-bold disabled:opacity-40" onClick={() => void rate(false)}>{t('Не помню')}</button>
            <button type="button" disabled={busy} className="min-h-11 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-40" onClick={() => void rate(true)}>{t('Помню')}</button>
          </>}
        <button type="button" className="min-h-11 rounded-xl px-3 underline" onClick={() => setClosed(true)}>{t('Пропустить')}</button>
      </div>
    </>}
  </section>;
}
