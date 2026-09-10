import { useEffect, useRef, useState } from 'react';
import { getQuiz, submitQuiz, type Answer, type Attempt, type QuizData } from '../api/quiz';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';
import QuizQuestion from './QuizQuestion';

function Feedback({ attempt }: { attempt: Attempt }) {
  const { t, explanationLanguage: lang } = useLanguage();
  return <div className="space-y-4"><p className="font-bold text-xl" role="status">{t(attempt.result.passed ? 'Тест пройден' : 'Попробуйте ещё раз')} · {attempt.result.score}/{attempt.result.total}</p>
    {attempt.result.items.map((item, i) => {
      const q = item.question;
      const choices = q.kind === 'choice' || q.kind === 'order' ? q.options : q.kind === 'match' ? q.right : [];
      const show = (id: string) => choices.find(o => o.id === id)?.text[lang] ?? id;
      const given = Array.isArray(item.value) ? item.value.map(show).join(' · ') : show(item.value);
      const expected = typeof item.expected === 'string' ? item.expected : Array.isArray(item.expected) ? item.expected.map(v => v[lang]).join(' · ') : item.expected[lang];
      return <div key={q.id} className="border border-border rounded-xl p-4 space-y-2"><p className="font-semibold">{i + 1}. {q.prompt[lang]}</p><p>{t(item.correct ? 'Верно' : 'Неверно')}</p><p>{t('Ваш ответ')}: {given}</p><p>{t('Правильный ответ')}: {expected}</p><p className="text-foreground/70">{item.explanation[lang]}</p></div>;
    })}</div>;
}

export default function QuizPanel({ slug, onPassed }: { slug: string; onPassed: (at: string) => void }) {
  const { t, language } = useLanguage();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<Attempt | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const lifetime = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const retry = useRef<{ signature: string; requestId: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller; pending.current = false;
    setQuiz(null); setError(''); setBusy(false); setAnswers({}); setResult(null); retry.current = null;
    getQuiz(slug, controller.signal).then(data => { if (!controller.signal.aborted) { setQuiz(data); setResult(data.attempts.find(a => a.quizRevision === data.revision && a.lessonRevision === data.lessonRevision) ?? null); } }).catch(err => { if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить тест.'); });
    return () => controller.abort();
  }, [slug, reload]);
  const ready = quiz?.questions.every(q => {
    const value = answers[q.id];
    return q.kind === 'match' || q.kind === 'order' ? Array.isArray(value) && value.length === (q.kind === 'match' ? q.left.length : q.options.length) && value.every(Boolean) : typeof value === 'string' && !!value.trim();
  });
  async function submit() {
    if (!quiz || !ready || pending.current || !lifetime.current) return;
    const signal = lifetime.current.signal;
    const values = quiz.questions.map(q => ({ questionId: q.id, value: answers[q.id] }));
    const signature = JSON.stringify({ values, revision: quiz.revision, lessonRevision: quiz.lessonRevision });
    if (retry.current?.signature !== signature) retry.current = { signature, requestId: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError('');
    try {
      const attempt = await submitQuiz(slug, { requestId: retry.current.requestId, lessonRevision: quiz.lessonRevision, quizRevision: quiz.revision, answers: values }, signal);
      if (!signal.aborted) { setResult(attempt); setQuiz({ ...quiz, attempts: [attempt, ...quiz.attempts.filter(a => a.id !== attempt.id)].slice(0, 10) }); if (attempt.result.passed) onPassed(attempt.createdAt); }
    } catch (err) { if (!signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось сохранить результат теста.'); }
    finally { if (!signal.aborted) { pending.current = false; setBusy(false); } }
  }
  return <section className="space-y-5 border-t border-border pt-6">
    <h2 className="text-2xl font-bold">{t(quiz?.kind === 'module' ? 'Тест модуля' : 'Тест урока')}</h2>
    {error && <div role="alert"><p>{t(error)}</p><button disabled={busy} className="underline" onClick={() => setReload(n => n + 1)}>{t('Обновить тест')}</button></div>}
    {!quiz && !error && <p role="status">{t('Загрузка…')}</p>}
    {quiz && <><p>{t('Порог прохождения')}: {quiz.passPercent}% · {t('Нужно верных ответов')}: {Math.ceil(quiz.questions.length * quiz.passPercent / 100)}/{quiz.questions.length}</p>
      {result ? <><Feedback attempt={result} /><button type="button" className="border border-border rounded-xl px-5 py-3" onClick={() => { setResult(null); setAnswers({}); retry.current = null; setError(''); }}>{t('Пройти заново')}</button></> : <form className="space-y-6" onSubmit={e => { e.preventDefault(); void submit(); }}>
        {quiz.questions.map((q, i) => <QuizQuestion key={q.id} question={q} number={i + 1} disabled={busy} value={answers[q.id]} onChange={value => setAnswers(current => ({ ...current, [q.id]: value }))} />)}
        <p className="text-sm text-foreground/65">{t('Ответы сохраняются после отправки. Заполните все задания.')}</p>
        <button disabled={!ready || busy} className="bg-primary text-primary-foreground rounded-xl px-6 py-3 disabled:opacity-40">{t(busy ? 'Сохранение…' : 'Проверить ответы')}</button>
      </form>}
      {quiz.attempts.length > 0 && <details className="border border-border rounded-xl p-4"><summary className="cursor-pointer font-semibold">{t('Последние 10 попыток')}</summary><div className="space-y-3 mt-4">{quiz.attempts.map(a => <details key={a.id} className="border border-border rounded-lg p-3"><summary className="cursor-pointer">{new Date(a.createdAt).toLocaleString(language === 'kk' ? 'kk-KZ' : language)} · {a.result.score}/{a.result.total} · {t('Версия')} {a.quizRevision} · {t(a.result.passed ? 'Тест пройден' : 'Не пройден')}</summary><div className="mt-4"><Feedback attempt={a} /></div></details>)}</div></details>}
    </>}
  </section>;
}
