import { useRef, useState } from 'react';
import { finishVocabularyTest, type VocabularyTest as Test, type VocabularyResult } from '../api/vocabulary';
import { useLanguage } from '../i18n/LanguageProvider';
import { ApiError } from '../api/client';
export default function VocabularyTest({ test, onFinished, onClose }: { test: Test; onFinished: (result: VocabularyResult) => void; onClose: () => void }) {
  const { t } = useLanguage();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VocabularyResult | null>(null);
  const question = test.questions[index];
  async function submit() {
    if (pending.current || test.questions.some(q => answers[q.id] === undefined)) return;
    pending.current = true; setBusy(true); setError('');
    try { const value = await finishVocabularyTest(test.id, test.questions.map(q => ({ id: q.id, choice: answers[q.id] }))); setResult(value); onFinished(value); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Не удалось сохранить карточку.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-8 space-y-5">
    <h2 className="text-2xl font-bold">{t(result ? 'Результат проверки' : 'Проверка слов')}</h2>
    {result ? <><p role="status">{t('Статусы сохранены')}: {result.results.length}</p><p className="text-muted-foreground">{t('Проверены узнавание перевода и пиньиня. Письмо и понимание речи этот тест не оценивает.')}</p><ul className="space-y-2">{result.results.map(word => <li key={word.key} className={`rounded-xl border p-3 knowledge-${word.status}`}><span lang="zh-CN" className="text-2xl">{word.hanzi}</span> · {t(word.status === 'known' ? 'Знаю' : 'Изучаю')} · {word.correct}/{word.total}</li>)}</ul><details><summary className="cursor-pointer underline">{t('Разобрать ответы')}</summary><ul className="mt-3 space-y-3">{test.questions.map(q => <li key={q.id}>{q.hanzi} · {t(q.skill === 'meaning' ? 'Перевод' : 'Пиньинь')}: {q.options[result.questions.find(answer => answer.id === q.id)!.correct]} {answers[q.id] === result.questions.find(answer => answer.id === q.id)!.correct ? '✓' : '✗'}</li>)}</ul></details></> : <>
      <p>{t('Вопрос')} {index + 1}/{test.questions.length} · {test.wordCount} {t('слов')}</p><progress className="w-full" value={index} max={test.questions.length} aria-label={t('Проверка слов')} />
      <p className="text-sm text-muted-foreground">{t('По два вопроса на слово: перевод и пиньинь. Два верных ответа — «Знаю», иначе — «Изучаю». Статусы обновятся после завершения.')}</p>
      <fieldset key={question.id} disabled={busy} className="space-y-3"><legend className="mb-4 text-lg">{t(question.skill === 'meaning' ? 'Выберите перевод' : 'Выберите пиньинь')}: <span lang="zh-CN" className="text-4xl">{question.hanzi}</span></legend>{question.options.map((option, choice) => <label key={choice} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-4 ${answers[question.id] === choice ? 'border-primary bg-secondary' : 'border-border'}`}><input type="radio" name={question.id} checked={answers[question.id] === choice} onChange={() => setAnswers(current => ({ ...current, [question.id]: choice }))} />{option}</label>)}</fieldset>
      <div className="flex flex-wrap gap-3"><button disabled={busy || index === 0} onClick={() => setIndex(n => n - 1)} className="rounded-xl border border-border px-4 py-3 disabled:opacity-40">{t('Назад')}</button>{index < test.questions.length - 1 ? <button disabled={busy || answers[question.id] === undefined} onClick={() => setIndex(n => n + 1)} className="rounded-xl bg-primary px-4 py-3 text-primary-foreground disabled:opacity-40">{t('Далее')}</button> : <button disabled={busy || test.questions.some(q => answers[q.id] === undefined)} onClick={() => void submit()} className="rounded-xl bg-primary px-4 py-3 text-primary-foreground disabled:opacity-40">{t(busy ? 'Сохранение…' : 'Завершить проверку')}</button>}</div>
      <p className="text-xs text-muted-foreground">{t('На тест — 20 минут. При выходе или обновлении страницы незавершённые ответы не сохраняются, статусы не меняются.')}</p>
    </>}
    {error && <p role="alert">{t(error)}</p>}
    <button disabled={busy} onClick={onClose} className="min-h-11 underline">{t(result ? 'Вернуться к словарю' : 'Выйти без изменений')}</button>
  </section>;
}
