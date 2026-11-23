import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CircleCheck, CircleX, Sparkles } from 'lucide-react';
import { checkAnswer, getQuiz, submitQuiz, type Answer, type Attempt, type Checked, type QuizData, type Question } from '../api/quiz';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';
import QuizQuestion from './QuizQuestion';
import { readDraft, writeDraft, clearDraft, makeDraft, type QuizDraft } from '../api/quizDraft';

type Lang = 'ru' | 'kk' | 'en';
const expectedText = (expected: Checked['expected'], lang: Lang) =>
  typeof expected === 'string' ? expected : Array.isArray(expected) ? expected.map(v => v[lang]).join(' · ') : expected[lang];

// Instant result under one question (stage 4 of the roadmap: feedback right after each answer).
function CheckResult({ checked, onExplain }: { checked: Checked; onExplain?: () => void }) {
  const { t, explanationLanguage: lang } = useLanguage();
  return <div role="status" className={`space-y-2 rounded-xl border-2 p-4 ${checked.correct ? 'border-primary bg-secondary' : 'border-danger bg-danger-soft'}`}>
    <p className={`flex items-center gap-2 text-lg font-bold ${checked.correct ? 'text-primary' : 'text-danger'}`}>
      {checked.correct ? <CircleCheck size={24} aria-hidden="true" /> : <CircleX size={24} aria-hidden="true" />}{t(checked.correct ? 'Верно!' : 'Неверно')}
    </p>
    {!checked.correct && <p><span className="font-semibold">{t('Правильный ответ')}:</span> {expectedText(checked.expected, lang)}</p>}
    <p className="text-foreground/80">{checked.explanation[lang]}</p>
    {!checked.correct && onExplain && <button type="button" onClick={onExplain} className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 font-bold text-accent-foreground hover:bg-secondary">
      <Sparkles size={20} aria-hidden="true" />{t('Объясни ошибку')}</button>}
  </div>;
}

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

const answered = (q: Question, value: Answer | undefined) =>
  q.kind === 'match' || q.kind === 'order' ? Array.isArray(value) && value.length === (q.kind === 'match' ? q.left.length : q.options.length) && value.every(Boolean) : typeof value === 'string' && !!value.trim();

type Props = { slug: string; userId: string; onPassed: (at: string) => void; onReviewMistakes?: (questionId?: string) => void };
export default function QuizPanel(props: Props) {
  return <QuizSession key={`${props.userId}:${props.slug}`} {...props} />;
}
function QuizSession({ slug, userId, onPassed, onReviewMistakes }: Props) {
  const { t, language } = useLanguage();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<Attempt | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const lifetime = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const draft = useRef<QuizDraft | null>(null);
  const [draftStatus, setDraftStatus] = useState('Восстановление черновика…');
  const [retrying, setRetrying] = useState(false);
  const [accountChanged, setAccountChanged] = useState(false);
  // ПР6 test screen: one question at a time; answers, drafts and submission are unchanged.
  const [current, setCurrent] = useState(0);
  // Server-confirmed instant checks for this attempt; a checked answer is locked.
  const [checks, setChecks] = useState<Record<string, Checked>>({});
  const [checking, setChecking] = useState(false);
  const questionTop = useRef<HTMLDivElement>(null);
  function goTo(index: number) {
    setCurrent(index);
    requestAnimationFrame(() => questionTop.current?.scrollIntoView({ block: 'nearest' }));
  }
  function persist(value: QuizDraft) {
    draft.current = value;
    try { writeDraft(value); setDraftStatus('Черновик сохранён в этом браузере.'); return true; }
    catch { setDraftStatus('Не удалось сохранить черновик. Не закрывайте страницу.'); return false; }
  }
  function changeAnswer(id: string, value: Answer) {
    if (!quiz || pending.current || retrying || accountChanged || checks[id]) return;
    const next = { ...answers, [id]: value };
    // Write in the input handler: even an immediate refresh retains the last edit.
    persist(makeDraft(userId, quiz, next));
    setAnswers(next);
  }
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller; pending.current = false;
    setQuiz(null); setError(''); setBusy(false); setResult(null); setChecks({});
    setDraftStatus('Восстановление черновика…');
    getQuiz(slug, controller.signal, userId).then(data => {
      if (controller.signal.aborted) return;
      setQuiz(data);
      let restored: QuizDraft | null = null;
      try {
        const stored = readDraft(userId, data, draft.current);
        restored = stored.draft;
        setDraftStatus(stored.status === 'restored' ? 'Черновик восстановлен.' : stored.status === 'outdated'
          ? 'Версия урока или теста изменилась. Старый черновик нельзя восстановить: задания могли измениться.'
          : stored.status === 'invalid' ? 'Черновик повреждён и не может быть восстановлен.' : 'Ответы автоматически сохраняются в этом браузере.');
      } catch { setDraftStatus('Не удалось прочитать черновик. Хранилище браузера недоступно.'); }
      draft.current = restored;
      // Answers already checked on the server are binding and win over the local draft.
      const serverChecked = Object.fromEntries(data.checks.map(c => [c.questionId, c.value]));
      const restoredAnswers = { ...(restored?.answers ?? {}), ...serverChecked };
      setAnswers(restoredAnswers); setRetrying(!!restored?.requestId);
      setChecks(Object.fromEntries(data.checks.map(({ questionId, value: _value, ...rest }) => [questionId, rest])));
      const firstOpen = data.questions.findIndex(q => !answered(q, restoredAnswers[q.id]) || (data.checks.length > 0 && !data.checks.some(c => c.questionId === q.id)));
      setCurrent(firstOpen === -1 ? Math.max(0, data.questions.length - 1) : firstOpen);
      setResult(restored || data.checks.length ? null : data.attempts.find(a => a.quizRevision === data.revision && a.lessonRevision === data.lessonRevision) ?? null);
    }).catch(err => { if (!controller.signal.aborted) {
      setDraftStatus('');
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить тест.');
      if (err instanceof ApiError && (err.status === 401 || err.message === 'Аккаунт изменился. Перезагрузите страницу.')) setAccountChanged(true);
    } });
    return () => controller.abort();
  }, [slug, userId, reload]);
  const ready = quiz?.questions.every(q => answered(q, answers[q.id]));
  async function check() {
    if (!quiz || checking || pending.current || accountChanged || !lifetime.current) return;
    const q = quiz.questions[current];
    if (!answered(q, answers[q.id]) || checks[q.id]) return;
    const signal = lifetime.current.signal;
    setChecking(true); setError('');
    try {
      const value = await checkAnswer(slug, { lessonRevision: quiz.lessonRevision, quizRevision: quiz.revision, questionId: q.id, value: answers[q.id] }, signal, userId);
      if (!signal.aborted) setChecks(old => ({ ...old, [q.id]: value }));
    } catch (err) { if (!signal.aborted) {
      setError(err instanceof ApiError ? err.message : 'Не удалось проверить ответ.');
      if (err instanceof ApiError && (err.status === 401 || err.message === 'Аккаунт изменился. Перезагрузите страницу.')) setAccountChanged(true);
    } }
    finally { if (!signal.aborted) setChecking(false); }
  }
  const correctCount = Object.values(checks).filter(c => c.correct).length;
  async function submit() {
    if (!quiz || !ready || pending.current || accountChanged || !lifetime.current) return;
    const signal = lifetime.current.signal;
    const values = quiz.questions.map(q => ({ questionId: q.id, value: answers[q.id] }));
    const requestId = draft.current?.requestId ?? crypto.randomUUID();
    // Persist the retry token before sending, otherwise a reload could duplicate an attempt.
    if (!persist(makeDraft(userId, quiz, answers, requestId))) return;
    setRetrying(true);
    pending.current = true; setBusy(true); setError('');
    try {
      const attempt = await submitQuiz(slug, { requestId, lessonRevision: quiz.lessonRevision, quizRevision: quiz.revision, answers: values }, signal, userId);
      if (!signal.aborted) {
        draft.current = null; setRetrying(false);
        try { clearDraft(userId, quiz.id); setDraftStatus('Результат сохранён. Черновик удалён.'); }
        catch { setDraftStatus('Результат сохранён, но удалить локальный черновик не удалось.'); }
        setResult(attempt); setQuiz({ ...quiz, attempts: [attempt, ...quiz.attempts.filter(a => a.id !== attempt.id)].slice(0, 10) }); if (attempt.result.passed) onPassed(attempt.createdAt); }
    } catch (err) { if (!signal.aborted) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить результат теста.');
      if (err instanceof ApiError && (err.status === 401 || err.message === 'Аккаунт изменился. Перезагрузите страницу.')) setAccountChanged(true);
      if (err instanceof ApiError && err.status === 409 && err.message === 'Урок обновлён. Откройте его заново.') setDraftStatus('Версия урока или теста изменилась. Старый черновик нельзя восстановить: задания могли измениться.');
      // Validation failure is definitive; an ambiguous network/server failure keeps the exact request.
      if (err instanceof ApiError && err.status === 400) { persist(makeDraft(userId, quiz, answers)); setRetrying(false); }
    } }
    finally { if (!signal.aborted) { pending.current = false; setBusy(false); } }
  }
  return <section className="space-y-5 border-t border-border pt-6">
    <h2 className="text-2xl font-bold">{t(quiz?.kind === 'module' ? 'Тест модуля' : 'Тест урока')}</h2>
    {draftStatus && <p role="status" aria-live="polite" className="text-sm text-foreground/70">{t(draftStatus)}</p>}
    {retrying && !busy && !result && <p role="status">{t('Отправка не подтверждена. Повторите отправку; ответы сохранены и временно недоступны для изменения.')}</p>}
    {error && <div role="alert"><p>{t(error)}</p><button disabled={busy || accountChanged} className="underline" onClick={() => setReload(n => n + 1)}>{t('Обновить тест')}</button></div>}
    {!quiz && !error && <p role="status">{t('Загрузка…')}</p>}
    {quiz && <><p>{t('Порог прохождения')}: {quiz.passPercent}% · {t('Нужно верных ответов')}: {Math.ceil(quiz.questions.length * quiz.passPercent / 100)}/{quiz.questions.length}</p>
      {result ? <><Feedback attempt={result} />{onReviewMistakes && result.id === quiz.attempts[0]?.id && result.result.items.some(item => !item.correct) && <button type="button" className="bg-primary text-primary-foreground rounded-xl px-5 py-3 mr-3" onClick={() => onReviewMistakes()}>{t('Разобрать ошибки с ИИ')}</button>}<button type="button" className="border border-border rounded-xl px-5 py-3" onClick={() => { setResult(null); setAnswers({}); setChecks({}); setCurrent(0); setRetrying(false); persist(makeDraft(userId, quiz, {})); setError(''); }}>{t('Пройти заново')}</button></> : <form className="space-y-5" onSubmit={e => { e.preventDefault(); const q = quiz.questions[current]; if (!checks[q.id] && !retrying) void check(); else if (current < quiz.questions.length - 1) goTo(current + 1); else void submit(); }}>
        <div ref={questionTop} className="space-y-3 scroll-mt-24">
          <div className="flex items-center gap-2">
            {current > 0 && <button type="button" onClick={() => goTo(current - 1)} aria-label={t('Предыдущий вопрос')} title={t('Предыдущий вопрос')} className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-secondary"><ArrowLeft size={22} aria-hidden="true" /></button>}
            <p className="font-bold text-muted-foreground" aria-live="polite">{t('Вопрос')} {current + 1} / {quiz.questions.length}</p>
            {Object.keys(checks).length > 0 && <p className="ml-auto font-bold text-primary">{t('Верно')}: {correctCount}/{Object.keys(checks).length}</p>}
          </div>
          <div aria-hidden="true" className="flex gap-1.5">{quiz.questions.map((q, i) => <span key={q.id} className={`h-2 flex-1 rounded-full ${checks[q.id] ? (checks[q.id].correct ? 'bg-primary' : 'bg-danger') : i === current ? 'bg-primary/50' : 'bg-secondary'}`} />)}</div>
        </div>
        <QuizQuestion key={quiz.questions[current].id} question={quiz.questions[current]} number={current + 1} disabled={busy || retrying || accountChanged || checking || !!checks[quiz.questions[current].id]} value={answers[quiz.questions[current].id]} onChange={value => changeAnswer(quiz.questions[current].id, value)} />
        {checks[quiz.questions[current].id]
          ? <CheckResult checked={checks[quiz.questions[current].id]} onExplain={onReviewMistakes ? () => onReviewMistakes(quiz.questions[current].id) : undefined} />
          : answered(quiz.questions[current], answers[quiz.questions[current].id])
          ? <p className="flex items-center gap-2 font-bold text-primary"><Check size={20} aria-hidden="true" />{t('Ответ сохранён в этом браузере.')}</p>
          : <p className="text-sm text-muted-foreground">{t('Ответы автоматически сохраняются в этом браузере.')}</p>}
        <div className="quiz-actions sticky z-30 -mx-4 space-y-1 border-t border-border bg-card px-4 py-3 tablet:static tablet:mx-0 tablet:flex tablet:flex-row-reverse tablet:items-center tablet:justify-start tablet:gap-3 tablet:space-y-0 tablet:border-0 tablet:bg-transparent tablet:p-0">
          {!checks[quiz.questions[current].id] && !retrying
            ? <button type="submit" disabled={!answered(quiz.questions[current], answers[quiz.questions[current].id]) || checking || accountChanged} className="min-h-14 w-full rounded-xl bg-primary px-6 text-lg font-bold text-primary-foreground disabled:opacity-40 tablet:w-auto">{t(checking ? 'Проверка…' : 'Проверить')}</button>
            : current < quiz.questions.length - 1
            ? <button type="submit" className="min-h-14 w-full rounded-xl bg-primary px-6 text-lg font-bold text-primary-foreground tablet:w-auto">{t('Дальше')}</button>
            : <button type="submit" disabled={!ready || busy || accountChanged} className="min-h-14 w-full rounded-xl bg-primary px-6 text-lg font-bold text-primary-foreground disabled:opacity-40 tablet:w-auto">{t(busy ? 'Сохранение…' : retrying ? 'Повторить отправку' : 'Завершить тест')}</button>}
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl font-bold text-dark-green hover:bg-secondary tablet:w-auto tablet:px-4"><ArrowLeft size={20} aria-hidden="true" />{t('К материалу')}</button>
        </div>
      </form>}
      {quiz.attempts.length > 0 && <details className="border border-border rounded-xl p-4"><summary className="cursor-pointer font-semibold">{t('Последние 10 попыток')}</summary><div className="space-y-3 mt-4">{quiz.attempts.map(a => <details key={a.id} className="border border-border rounded-lg p-3"><summary className="cursor-pointer">{new Date(a.createdAt).toLocaleString(language === 'kk' ? 'kk-KZ' : language)} · {a.result.score}/{a.result.total} · {t('Версия')} {a.quizRevision} · {t(a.result.passed ? 'Тест пройден' : 'Не пройден')}</summary><div className="mt-4"><Feedback attempt={a} /></div></details>)}</div></details>}
    </>}
  </section>;
}
