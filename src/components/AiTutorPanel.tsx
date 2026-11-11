import { useEffect, useRef, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import { askTutor, tutorError, tutorStatus, type TutorMode, type TutorTurn } from '../api/tutor';

const modes: Array<[TutorMode, string]> = [['explain', 'Объясни правило'], ['check', 'Проверь мою фразу'], ['dialogue', 'Начать диалог'], ['practice', 'Тренировочные вопросы'], ['mistakes', 'Разбор ошибок теста']];
// autoSend: opened from a quiz result, so the first request goes out without extra clicks.
export default function AiTutorPanel({ onClose, lessonSlug, initialMode = 'explain', autoSend = false }: { onClose: () => void; lessonSlug?: string; initialMode?: TutorMode; autoSend?: boolean }) {
  const { t, explanationLanguage } = useLanguage();
  const [provider, setProvider] = useState<'unconfigured' | 'test' | 'live' | null>(null);
  const [mode, setMode] = useState<TutorMode>(initialMode);
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const active = useRef<AbortController | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  const autoSent = useRef(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setProvider(null); setError(''); setTurns([]); setNotice(''); setLoading(false); active.current = null;
    tutorStatus(controller.signal).then(s => { if (!controller.signal.aborted) setProvider(s.provider); })
      .catch(e => { if (!controller.signal.aborted) setError(tutorError(e)); });
    return () => { controller.abort(); active.current?.abort(); };
  }, [lessonSlug, explanationLanguage, retry]);
  function cancel() { active.current?.abort(); active.current = null; setLoading(false); setNotice('Запрос отменён.'); }
  async function send() {
    if (!lessonSlug || active.current || !provider || provider === 'unconfigured' || (mode === 'check' && !text.trim())) return;
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(''); setNotice('');
    try {
      const result = await askTutor({ lessonSlug, mode, text, history: mode === 'dialogue' ? turns.slice(-6).map(m => ({ ...m, text: m.text.slice(0, 2000) })) : [] }, controller.signal);
      if (!controller.signal.aborted) {
        setProvider(result.provider);
        setTurns(old => [...old, { role: 'user', text: text || t(modes.find(m => m[0] === mode)![1]) }, { role: 'assistant', text: result.text }].slice(-20) as TutorTurn[]);
        setText('');
      }
    } catch (e) { if (!controller.signal.aborted) setError(tutorError(e)); }
    finally { if (active.current === controller) { active.current = null; setLoading(false); } }
  }
  useEffect(() => {
    if (!autoSend || autoSent.current || !provider || provider === 'unconfigured') return;
    autoSent.current = true; void send();
  }, [provider]);
  return <div className="fixed inset-0 z-50 bg-dark-green/20 flex justify-end" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="tutor-title" className="tutor-panel w-full max-w-sm h-dvh bg-background shadow-xl flex flex-col min-w-0" onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), select:not(:disabled)'));
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      <header className="p-4 flex items-center justify-between border-b border-border"><h2 id="tutor-title" className="font-bold flex items-center gap-2"><Sparkles size={20} />{t('Помощник ZhPath')}</h2><button ref={close} onClick={onClose} aria-label={t('Закрыть')} className="flex size-11 shrink-0 items-center justify-center rounded-lg"><X aria-hidden="true" /></button></header>
      <div className="p-4 flex-1 overflow-y-auto space-y-4 min-h-0" aria-live="polite">
        {!lessonSlug && <p>{t('Откройте урок, чтобы обсудить его материал.')}</p>}
        {provider === null && !error && <p role="status">{t('Проверка доступности помощника…')}</p>}
        {provider === 'unconfigured' && <p role="status">{t('ИИ-провайдер пока не настроен. Ответы ИИ недоступны.')}</p>}
        {provider === 'test' && <p className="font-semibold">{t('Тестовый адаптер: это не ответы настоящего ИИ.')}</p>}
        {provider === 'live' && <p>{t('Ответы ИИ могут содержать ошибки. Проверяйте их с преподавателем.')}</p>}
        {turns.map((turn, i) => <p key={i} className={`whitespace-pre-wrap break-words rounded-xl p-3 ${turn.role === 'user' ? 'bg-secondary' : 'bg-card border border-border'}`}><strong>{t(turn.role === 'user' ? 'Вы' : 'Помощник ZhPath')}: </strong>{turn.text}</p>)}
        {loading && <p role="status">{t('Помощник готовит ответ…')}</p>}
        {notice && <p role="status">{t(notice)}</p>}
        {error && <div role="alert"><p>{t(error)}</p><button className="underline mt-2" disabled={loading} onClick={() => provider ? void send() : setRetry(n => n + 1)}>{t('Повторить')}</button></div>}
      </div>
      <form className="p-4 border-t border-border space-y-3" onSubmit={e => { e.preventDefault(); void send(); }}>
        <label className="block">{t('Режим помощника')}<select className="block w-full p-2 rounded-lg border border-border mt-1" value={mode} disabled={loading} onChange={e => { setMode(e.target.value as TutorMode); setTurns([]); setError(''); }}>
          {modes.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
        </select></label>
        <label className="block">{t('Сообщение помощнику')}<textarea className="w-full resize-none p-2 rounded-lg border border-border mt-1" rows={3} maxLength={1500} value={text} onChange={e => setText(e.target.value)} disabled={loading} /></label>
        <div className="flex flex-wrap gap-3">
          {loading ? <button type="button" onClick={e => { e.preventDefault(); cancel(); }} className="underline">{t('Отменить запрос')}</button> : <button type="submit" disabled={!lessonSlug || !provider || provider === 'unconfigured' || (mode === 'check' && !text.trim())} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl disabled:opacity-50">{t('Отправить')}</button>}
          <button type="button" disabled={loading} className="underline" onClick={() => { setTurns([]); setText(''); setError(''); setNotice(''); }}>{t('Начать заново')}</button>
        </div>
      </form>
    </section>
  </div>;
}
