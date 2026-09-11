import { useEffect, useRef, useState } from 'react';
import { listContent, listUnits, createContent, getContent, updateContent, type ContentLesson, type ContentDetail, type ContentBlock, type ContentUnit } from '../api/content';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';
import ContentBlocksEditor, { TranslationFields, emptyTranslation } from '../components/ContentBlocksEditor';
const stateLabels: Record<string, string> = { DRAFT: 'Черновик', REVIEW: 'На проверке', PUBLISHED: 'Опубликован', ARCHIVED: 'В архиве' };
export default function ContentAdmin({ role }: { role: string }) {
  const { t, language, explanationLanguage: lang } = useLanguage();
  const [lessons, setLessons] = useState<ContentLesson[]>([]);
  const [units, setUnits] = useState<ContentUnit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [slug, setSlug] = useState('');
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [title, setTitle] = useState(emptyTranslation);
  const [minutes, setMinutes] = useState(10);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const lifetime = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const dirty = creating ? !!(title.ru || title.kk || title.en || slug || minutes !== 10 || unitId !== (units[0]?.id ?? '')) : !!detail && (JSON.stringify(title) !== JSON.stringify(detail.title) || minutes !== detail.minutes || JSON.stringify(blocks) !== JSON.stringify(detail.blocks));
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', leave);
    const navigate = (event: Event) => {
      if (!window.confirm(t('Отменить несохранённые изменения?'))) event.preventDefault();
    };
    window.addEventListener('zhpath:before-navigate', navigate);
    return () => { window.removeEventListener('beforeunload', leave); window.removeEventListener('zhpath:before-navigate', navigate); };
  }, [dirty, t]);
  useEffect(() => {
    if (role === 'STUDENT') return;
    const controller = new AbortController(); lifetime.current = controller; setLoading(true); setError(''); setDetail(null); setBusy(false); pending.current = false;
    (async () => { try {
      const [list, sections] = await Promise.all([listContent(controller.signal), listUnits(controller.signal)]);
      const value = selected ? await getContent(selected, controller.signal) : null;
      if (!controller.signal.aborted) { setLessons(list.lessons); setUnits(sections.units); setDetail(value); setTitle(value?.title ?? emptyTranslation()); setMinutes(value?.minutes ?? 10); setBlocks(value?.blocks ?? []); setSlug(''); setUnitId(sections.units[0]?.id ?? ''); }
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить редактор.'); }
    finally { if (!controller.signal.aborted) setLoading(false); } })();
    return () => controller.abort();
  }, [selected, reload, role, creating]);
  if (role === 'STUDENT') return <p role="alert">{t('Недостаточно прав.')}</p>;
  const state = creating ? 'DRAFT' : detail?.published ? 'PUBLISHED' : detail?.editorialState;
  function discard() { return !dirty || window.confirm(t('Отменить несохранённые изменения?')); }
  async function save(nextState?: string) {
    if ((!detail && !creating) || pending.current || !lifetime.current || (nextState && dirty)) return;
    pending.current = true; setBusy(true); setError(''); const signal = lifetime.current.signal;
    try {
      if (creating) {
        const created = await createContent({ unitId, slug, title, minutes }, signal);
        if (!signal.aborted) { setCreating(false); setSelected(created.id); }
      } else {
        await updateContent(detail!.id, nextState ? { version: detail!.editVersion, state: nextState } : { version: detail!.editVersion, title, minutes, blocks: blocks.map(({ kind, content }) => ({ kind, content })) }, !!nextState, signal);
        if (!signal.aborted) setReload(n => n + 1);
      }
    } catch (err) { if (!signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось сохранить урок.'); }
    finally { if (!signal.aborted) { pending.current = false; setBusy(false); } }
  }
  return <section className="max-w-5xl mx-auto space-y-6"><h1 className="text-3xl font-bold">{t('Управление уроками')}</h1>
    {error && <div role="alert"><p>{t(error)}</p><button disabled={busy} className="underline" onClick={() => { if (discard()) setReload(n => n + 1); }}>{t('Обновить')}</button></div>}
    <div className="flex gap-3 items-end"><label className="block grow">{t('Выберите урок')}<select disabled={busy || loading} className="block w-full border border-border bg-background p-3 rounded-xl mt-2" value={selected} onChange={e => { if (discard()) { setCreating(false); setSelected(e.target.value); } }}><option value="">—</option>{lessons.map(l => <option key={l.id} value={l.id}>{l.title[language]} · {t(stateLabels[l.published ? 'PUBLISHED' : l.editorialState])}</option>)}</select></label><button disabled={busy || loading || creating} className="border border-border p-3 rounded-xl" onClick={() => { if (discard()) { setSelected(''); setCreating(true); } }}>{t('Создать урок')}</button></div>
    {loading && <p role="status">{t('Загрузка…')}</p>}
    {!loading && (detail || creating) && <><p>{t(stateLabels[state!])}{detail && <> · {t('Версия')} {detail.editVersion}</>}</p>{dirty && <p role="status">{t('Есть несохранённые изменения.')}</p>}
      <form className="space-y-4 bg-card border border-border rounded-2xl p-6" onSubmit={e => { e.preventDefault(); void save(); }}><fieldset disabled={busy || state !== 'DRAFT'} className="space-y-4">
        {creating && <><label className="block">{t('Раздел')}<select required className="block w-full border border-border rounded-lg p-3" value={unitId} onChange={e => setUnitId(e.target.value)}>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.level.curriculum.title[language]} · HSK {unit.level.number} · {unit.title[language]}</option>)}</select></label><label className="block">{t('Адрес урока')}<input required minLength={3} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="hsk1-new-lesson" className="block w-full border border-border rounded-lg p-3" value={slug} onChange={e => setSlug(e.target.value)} /></label><p>{t('Урок добавится в конец раздела после предыдущего урока.')}</p></>}
        <TranslationFields label={t('Название урока')} maxLength={200} value={title} onChange={setTitle} />
        <label className="block">{t('Длительность, мин')}<input type="number" min={1} max={120} required value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="block border border-border rounded-lg p-3" /></label>
        {!creating && <ContentBlocksEditor blocks={blocks} onChange={setBlocks} />}
        <button className="bg-primary text-primary-foreground rounded-xl px-5 py-3 disabled:opacity-40">{t(creating ? 'Создать черновик' : 'Сохранить')}</button>
      </fieldset></form>
      {detail && <><div className="flex gap-3 flex-wrap">{(state === 'DRAFT' ? ['REVIEW'] : state === 'REVIEW' ? role === 'ADMIN' ? ['DRAFT', 'PUBLISHED'] : ['DRAFT'] : state === 'PUBLISHED' ? role === 'ADMIN' ? ['ARCHIVED'] : [] : ['DRAFT']).map(next => <button key={next} disabled={busy || dirty} onClick={() => void save(next)} className="border border-border rounded-xl px-5 py-3 disabled:opacity-40">{t({ DRAFT: 'Вернуть в черновик', REVIEW: 'Отправить на проверку', PUBLISHED: 'Опубликовать', ARCHIVED: 'Архивировать' }[next]!)}</button>)}</div>
      {state === 'PUBLISHED' && <p>{t('Для изменения названия администратор должен сначала архивировать урок.')}</p>}
      <details className="border border-border rounded-xl p-5"><summary>{t('Предпросмотр содержания')}</summary><div className="space-y-4 mt-4">{blocks.map(b => <article key={b.id} className="rounded-xl bg-secondary p-4 space-y-2"><h2 className="font-bold">{b.content.title[lang]}</h2>{b.content.text && <p className="whitespace-pre-line">{b.content.text[lang]}</p>}<p className="text-2xl whitespace-pre-line">{b.content.hanzi}</p><p>{b.content.pinyin}</p>{b.content.translation && <p>{b.content.translation[lang]}</p>}{b.content.words?.map((w, i) => <p key={i}>{w.hanzi} · {w.pinyin} · {w.translation[lang]}</p>)}{b.kind === 'audio' && <><audio controls preload="none" src={b.content.audioUrl?.startsWith('https://') ? b.content.audioUrl : undefined} aria-label={b.content.title[lang]} /><p>{b.content.author} · {b.content.license}</p>{b.content.sourceUrl?.startsWith('https://') && <a href={b.content.sourceUrl} target="_blank" rel="noreferrer">{t('Источник аудио')}</a>}{b.content.licenseUrl?.startsWith('https://') && <a className="ml-3" href={b.content.licenseUrl} target="_blank" rel="noreferrer">{t('Лицензия')}</a>}</>}</article>)}</div></details>
      <details className="border border-border rounded-xl p-5"><summary>{t('Журнал изменений')}</summary><ul className="space-y-2 mt-4">{detail.changes.map(c => <li key={c.id}>{new Date(c.createdAt).toLocaleString(language)} · {c.action === 'EDIT' ? t('Редактирование') : c.action === 'CREATE' ? t('Создание урока') : t(stateLabels[c.action] ?? c.action)}</li>)}</ul></details></>}
    </>}
  </section>;
}
