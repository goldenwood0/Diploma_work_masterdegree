import { useEffect, useRef, useState } from 'react';
import { listMedia, uploadMedia, archiveMedia, mediaHistory, type MediaAsset } from '../api/media';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';
const inputClass = 'block w-full border border-border bg-background rounded-lg p-2';
export default function MediaLibrary({ role }: { role: string }) {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState<Awaited<ReturnType<typeof mediaHistory>>>([]);
  const [historyName, setHistoryName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState({ name: '', author: '', license: '', sourceUrl: '', licenseUrl: '' });
  const lifetime = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const dirty = !!file || Object.values(fields).some(Boolean);
  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; return () => controller.abort(); }, []);
  useEffect(() => {
    if (!dirty && !busy) return;
    const leave = (event: Event) => { if (busy || !window.confirm(t('Отменить несохранённые изменения?'))) event.preventDefault(); };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('zhpath:before-navigate', leave); window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('zhpath:before-navigate', leave); window.removeEventListener('beforeunload', unload); };
  }, [dirty, busy, t]);
  useEffect(() => {
    if (role === 'STUDENT') return;
    const controller = new AbortController(); setLoading(true); setError('');
    listMedia(query, archived, page, controller.signal).then(value => { if (!controller.signal.aborted) setAssets(value); }).catch(err => { if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить медиатеку.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, archived, page, reload, role]);
  if (role === 'STUDENT') return <p role="alert">{t('Недостаточно прав.')}</p>;
  async function action(work: (signal: AbortSignal) => Promise<void>) {
    if (!lifetime.current || pending.current) return;
    const signal = lifetime.current.signal; pending.current = true; setBusy(true); setError(''); setSuccess('');
    try { await work(signal); } catch (err) { if (!signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось сохранить файл.'); }
    finally { if (!signal.aborted) { pending.current = false; setBusy(false); } }
  }
  async function upload(signal: AbortSignal) {
    if (!file) { setError('Выберите WAV-файл.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Нужен корректный PCM WAV до 5 МБ и 5 минут.'); return; }
    const form = new FormData(); Object.entries(fields).forEach(([key, value]) => form.append(key, value)); form.append('file', file);
    await uploadMedia(form, signal);
    if (!signal.aborted) { setFields({ name: '', author: '', license: '', sourceUrl: '', licenseUrl: '' }); setFile(null); if (fileInput.current) fileInput.current.value = ''; setArchived(false); setQuery(''); setSearch(''); setPage(0); setReload(n => n + 1); setSuccess('Аудио загружено. Выберите его в редакторе урока или диктанта.'); }
  }
  return <section className="max-w-5xl mx-auto space-y-6"><h1 className="text-3xl font-bold">{t('Медиатека')}</h1><p>{t('PCM WAV, до 5 МБ и 5 минут. Для MP3 и OGG пока используйте HTTPS-ссылку.')}</p>
    {error && <p role="alert">{t(error)}</p>}{success && <p role="status">{t(success)}</p>}
    <form className="border border-border rounded-2xl p-5 space-y-4" onSubmit={e => { e.preventDefault(); void action(upload); }}><fieldset disabled={busy} className="space-y-4"><label className="block">{t('Аудиофайл WAV')}<input className={inputClass} ref={fileInput} type="file" accept=".wav,audio/wav,audio/x-wav" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>{(Object.keys(fields) as Array<keyof typeof fields>).map(key => <label className="block" key={key}>{t({ name: 'Название записи', author: 'Автор', license: 'Лицензия', sourceUrl: 'Источник аудио', licenseUrl: 'Ссылка на лицензию' }[key])}<input className={inputClass} required type={key.endsWith('Url') ? 'url' : 'text'} pattern={key.endsWith('Url') ? 'https://.*' : undefined} maxLength={key.endsWith('Url') ? 2000 : 200} value={fields[key]} onChange={e => setFields({ ...fields, [key]: e.target.value })} /></label>)}<button className="bg-primary text-primary-foreground rounded-lg px-5 py-3">{t('Загрузить аудио')}</button></fieldset></form>
    <form className="flex gap-3 items-end" onSubmit={e => { e.preventDefault(); setQuery(search); setPage(0); setReload(n => n + 1); }}><label className="grow">{t('Поиск записи')}<input disabled={busy} maxLength={100} className={inputClass} value={search} onChange={e => setSearch(e.target.value)} /></label><button disabled={busy} className="border border-border rounded-lg p-2">{t('Найти')}</button></form>
    <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={archived} onChange={e => { setArchived(e.target.checked); setPage(0); }} />{t('Показать архив')}</label>
    {loading ? <p role="status">{t('Загрузка…')}</p> : <div className="space-y-4">{assets.map(asset => <article key={asset.id} className="border border-border rounded-xl p-4 space-y-3"><h2 className="font-bold">{asset.name}</h2><p>{Math.ceil(asset.size / 1024)} KB · {asset.duration.toFixed(1)} s · {asset.author} · {asset.license}</p><audio controls preload="none" src={asset.audioUrl} aria-label={asset.name} /><div className="flex gap-4"><a href={asset.sourceUrl} target="_blank" rel="noreferrer">{t('Источник аудио')}</a><a href={asset.licenseUrl} target="_blank" rel="noreferrer">{t('Лицензия')}</a></div><div className="flex gap-4"><button disabled={busy} onClick={() => void action(async signal => { const changes = await mediaHistory(asset.id, signal); if (!signal.aborted) { setHistory(changes); setHistoryName(asset.name); } })}>{t('Журнал изменений')}</button>{role === 'ADMIN' && <button disabled={busy} onClick={() => void action(async signal => { await archiveMedia(asset, signal); if (!signal.aborted) { setReload(n => n + 1); setHistory([]); setHistoryName(''); } })}>{t(asset.archived ? 'Восстановить из архива' : 'Архивировать')}</button>}</div></article>)}{!assets.length && <p>{t('Записи не найдены.')}</p>}<div className="flex gap-4"><button disabled={busy || page === 0} onClick={() => setPage(n => n - 1)}>{t('Назад')}</button><span>{t('Страница')} {page + 1}</span><button disabled={busy || assets.length < 50} onClick={() => setPage(n => n + 1)}>{t('Далее')}</button></div></div>}
    {historyName && <section className="space-y-3"><h2 className="font-bold">{t('Журнал изменений')} · {historyName}</h2>{history.map(change => <p key={change.id}>{new Date(change.createdAt).toLocaleString(language)} · {t({ UPLOAD: 'Загрузка файла', ARCHIVE: 'Архивирование файла', RESTORE: 'Восстановление файла' }[change.action] ?? change.action)} · {change.actorId}</p>)}</section>}
    <p>{t('Архив скрывает запись из выбора. Уже опубликованные уроки продолжают её воспроизводить.')}</p>
  </section>;
}
