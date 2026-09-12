import { useEffect, useState } from 'react';
import { listMedia, type MediaAsset } from '../api/media';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';
export default function MediaPicker({ onSelect }: { onSelect: (asset: MediaAsset) => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setLoading(true); setError('');
    listMedia(query, false, page, controller.signal).then(value => { if (!controller.signal.aborted) setAssets(value); }).catch(err => { if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить медиатеку.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, query, page]);
  return <div className="space-y-3"><button type="button" className="underline" onClick={() => setOpen(value => !value)}>{t(open ? 'Закрыть медиатеку' : 'Выбрать из медиатеки')}</button>{open && <div className="border border-border rounded-lg p-3 space-y-3"><p>{t('Загрузите новую запись на странице «Медиатека», затем выберите её здесь.')}</p><label>{t('Поиск записи')}<input className="block w-full border border-border p-2" maxLength={100} value={search} onChange={e => setSearch(e.target.value)} /></label><button type="button" onClick={() => { setQuery(search); setPage(0); }}>{t('Найти')}</button>{error && <p role="alert">{t(error)}</p>}{loading ? <p role="status">{t('Загрузка…')}</p> : <><ul>{assets.map(asset => <li key={asset.id}><button type="button" className="py-2 underline" onClick={() => { onSelect(asset); setOpen(false); }}>{asset.name} · {asset.author}</button></li>)}</ul>{!assets.length && <p>{t('Записи не найдены.')}</p>}<div className="flex gap-4"><button type="button" disabled={page === 0} onClick={() => setPage(n => n - 1)}>{t('Назад')}</button><span>{t('Страница')} {page + 1}</span><button type="button" disabled={assets.length < 50} onClick={() => setPage(n => n + 1)}>{t('Далее')}</button></div></>}</div>}</div>;
}
