import { useRef, useState } from 'react';
import type { Answer, Question } from '../api/quiz';
import { useLanguage } from '../i18n/LanguageProvider';

export default function QuizQuestion({ question: q, value, onChange, disabled, number }: { question: Question; value: Answer | undefined; onChange: (value: Answer) => void; disabled: boolean; number: number }) {
  const { t, explanationLanguage: lang } = useLanguage();
  const audio = useRef<HTMLAudioElement>(null);
  const [audioError, setAudioError] = useState(false);
  const values = Array.isArray(value) ? value : [];
  return <fieldset disabled={disabled} className="rounded-xl border border-border p-4 sm:p-6 space-y-4">
    <legend className="font-semibold px-2">{number}. {q.prompt[lang]}</legend>
    {q.kind === 'choice' && q.options.map(o => <label key={o.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary cursor-pointer"><input type="radio" name={q.id} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} /><span>{o.text[lang]}</span></label>)}
    {q.kind === 'match' && q.left.map((left, i) => <label key={left.id} className="grid grid-cols-2 gap-3 items-center"><span>{left.text[lang]}</span><select className="border border-border rounded-lg bg-background p-3 min-w-0" value={values[i] ?? ''} onChange={e => { const next = q.left.map((_, n) => values[n] ?? ''); next[i] = e.target.value; onChange(next); }}><option value="">{t('Выберите перевод')}</option>{q.right.map(o => <option key={o.id} value={o.id} disabled={values.includes(o.id) && values[i] !== o.id}>{o.text[lang]}</option>)}</select></label>)}
    {q.kind === 'order' && <><p className="text-sm text-foreground/65">{t('Нажимайте слова в нужном порядке.')}</p><div className="min-h-14 rounded-lg bg-secondary p-3 text-xl" aria-live="polite">{values.map(id => q.options.find(o => o.id === id)?.text[lang]).join(' ') || '…'}</div><div className="flex flex-wrap gap-2">{q.options.map(o => <button key={o.id} type="button" disabled={disabled || values.includes(o.id)} onClick={() => onChange([...values, o.id])} className="border border-border rounded-lg px-4 py-3 disabled:opacity-40">{o.text[lang]}</button>)}</div><button type="button" className="underline" onClick={() => onChange(values.slice(0, -1))}>{t('Убрать последнее слово')}</button></>}
    {q.kind === 'dictation' && <div className="space-y-2"><audio ref={audio} controls preload="none" src={q.audioUrl} aria-label={t('Запись для диктанта')} className="w-full" onError={() => setAudioError(true)} onLoadedMetadata={() => setAudioError(false)} />
      {audioError && <p role="alert">{t('Аудио недоступно. Проверьте соединение и повторите.')} <button type="button" className="underline" onClick={() => audio.current?.load()}>{t('Повторить')}</button></p>}
      <p className="text-xs text-foreground/60"><a className="underline" href={q.sourceUrl} target="_blank" rel="noreferrer">{q.author} · Wikimedia Commons</a> · <a className="underline" href={q.licenseUrl} target="_blank" rel="noreferrer">{q.license}</a> · {t('Запись без изменений')}</p></div>}
    {['gap', 'input', 'dictation'].includes(q.kind) && <label className="block space-y-2"><span>{t('Ваш ответ')}</span><input maxLength={500} autoComplete="off" spellCheck={false} className="w-full rounded-lg border border-border bg-background p-3 text-xl" value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} /></label>}
  </fieldset>;
}
