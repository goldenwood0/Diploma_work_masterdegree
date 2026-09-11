import { useEffect, useRef, useState } from 'react';
import { listContent, getContent, updateContent, type ContentLesson, type ContentDetail } from '../api/content';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';
const stateLabels: Record<string, string> = { DRAFT: 'Черновик', REVIEW: 'На проверке', PUBLISHED: 'Опубликован', ARCHIVED: 'В архиве' };
export default function ContentAdmin({ role }: { role: string }) {
  const { t, language, explanationLanguage: lang } = useLanguage();
  const [lessons, setLessons] = useState<ContentLesson[]>([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [title, setTitle] = useState({ ru: '', kk: '', en: '' });
  const [minutes, setMinutes] = useState(10);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const lifetime = useRef<AbortController | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (role === 'STUDENT') return;
    const controller = new AbortController(); lifetime.current = controller; setLoading(true); setError(''); setDetail(null); setBusy(false); pending.current = false;
    (async () => { try {
      const list = await listContent(controller.signal);
      const value = selected ? await getContent(selected, controller.signal) : null;
      if (!controller.signal.aborted) { setLessons(list.lessons); setDetail(value); if (value) { setTitle(value.title); setMinutes(value.minutes); } }
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить редактор.'); }
    finally { if (!controller.signal.aborted) setLoading(false); } })();
    return () => controller.abort();
  }, [selected, reload, role]);
  if (role === 'STUDENT') return <p role="alert">{t('Недостаточно прав.')}</p>;
  const state = detail?.published ? 'PUBLISHED' : detail?.editorialState;
  async function save(nextState?: string) {
    if (!detail || pending.current || !lifetime.current) return;
    pending.current = true; setBusy(true); setError(''); const signal = lifetime.current.signal;
    try { await updateContent(detail.id, nextState ? { version: detail.editVersion, state: nextState } : { version: detail.editVersion, title, minutes }, !!nextState, signal); if (!signal.aborted) setReload(n => n + 1); }
    catch (err) { if (!signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось сохранить урок.'); }
    finally { if (!signal.aborted) { pending.current = false; setBusy(false); } }
  }
  return <section className="max-w-5xl mx-auto space-y-6"><h1 className="text-3xl font-bold">{t('Управление уроками')}</h1>
    {error && <div role="alert"><p>{t(error)}</p><button disabled={busy} className="underline" onClick={() => setReload(n => n + 1)}>{t('Обновить')}</button></div>}
    <label className="block">{t('Выберите урок')}<select disabled={busy} className="block w-full border border-border bg-background p-3 rounded-xl mt-2" value={selected} onChange={e => setSelected(e.target.value)}><option value="">—</option>{lessons.map(l => <option key={l.id} value={l.id}>{l.title[language]} · {t(stateLabels[l.published ? 'PUBLISHED' : l.editorialState])}</option>)}</select></label>
    {loading && <p role="status">{t('Загрузка…')}</p>}
    {detail && <><p>{t(stateLabels[state!])} · {t('Версия')} {detail.editVersion}</p><form className="space-y-4 bg-card border border-border rounded-2xl p-6" onSubmit={e => { e.preventDefault(); void save(); }}><fieldset disabled={busy || state !== 'DRAFT'} className="space-y-4">{(['ru', 'kk', 'en'] as const).map(key => <label key={key} className="block">{t('Название урока')} · {key}<input required maxLength={200} value={title[key]} onChange={e => setTitle({ ...title, [key]: e.target.value })} className="block w-full border border-border rounded-lg p-3" /></label>)}<label className="block">{t('Длительность, мин')}<input type="number" min={1} max={120} required value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="block border border-border rounded-lg p-3" /></label><button className="bg-primary text-primary-foreground rounded-xl px-5 py-3 disabled:opacity-40">{t('Сохранить')}</button></fieldset></form>
      <div className="flex gap-3 flex-wrap">{(state === 'DRAFT' ? ['REVIEW'] : state === 'REVIEW' ? role === 'ADMIN' ? ['DRAFT', 'PUBLISHED'] : ['DRAFT'] : state === 'PUBLISHED' ? role === 'ADMIN' ? ['ARCHIVED'] : [] : ['DRAFT']).map(next => <button key={next} disabled={busy} onClick={() => void save(next)} className="border border-border rounded-xl px-5 py-3">{t({ DRAFT: 'Вернуть в черновик', REVIEW: 'Отправить на проверку', PUBLISHED: 'Опубликовать', ARCHIVED: 'Архивировать' }[next]!)}</button>)}</div>
      {state === 'PUBLISHED' && <p>{t('Для изменения названия администратор должен сначала архивировать урок.')}</p>}
      <details className="border border-border rounded-xl p-5"><summary>{t('Предпросмотр содержания')}</summary><div className="space-y-4 mt-4">{detail.blocks.map(b => <article key={b.id} className="rounded-xl bg-secondary p-4 space-y-2"><h2 className="font-bold">{b.content.title[lang]}</h2>{b.content.text && <p>{b.content.text[lang]}</p>}<p className="text-2xl whitespace-pre-line">{b.content.hanzi}</p><p>{b.content.pinyin}</p>{b.content.translation && <p>{b.content.translation[lang]}</p>}{b.content.words?.map(w => <p key={w.hanzi}>{w.hanzi} · {w.pinyin} · {w.translation[lang]}</p>)}</article>)}</div></details>
      <details className="border border-border rounded-xl p-5"><summary>{t('Журнал изменений')}</summary><ul className="space-y-2 mt-4">{detail.changes.map(c => <li key={c.id}>{new Date(c.createdAt).toLocaleString(language)} · {c.action === 'EDIT' ? t('Редактирование') : t(stateLabels[c.action] ?? c.action)}</li>)}</ul></details>
    </>}
  </section>;
}
