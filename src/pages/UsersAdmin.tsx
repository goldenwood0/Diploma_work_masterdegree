import { useEffect, useRef, useState } from 'react';
import { listUsers, roleHistory, setUserRole, type ManagedUser, type RoleChange } from '../api/users';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';
const labels = { STUDENT: 'Ученик', EDITOR: 'Редактор', ADMIN: 'Администратор' };
const inputClass = 'block w-full border border-border rounded-lg bg-background p-3';
export default function UsersAdmin({ role, currentUserId }: { role: string; currentUserId: string }) {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [nextRole, setNextRole] = useState<ManagedUser['role']>('STUDENT');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<RoleChange[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const dirty = !!selected && (nextRole !== selected.role || !!reason);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!dirty && !busy) return;
    const guard = (event: Event) => { if (busy || !window.confirm(t('Отменить несохранённые изменения?'))) event.preventDefault(); };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('zhpath:before-navigate', guard); window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('zhpath:before-navigate', guard); window.removeEventListener('beforeunload', unload); };
  }, [dirty, busy, t]);
  useEffect(() => {
    if (role !== 'ADMIN') return;
    const controller = new AbortController(); setLoading(true); setError('');
    listUsers(query, filter, page, controller.signal).then(value => { if (!controller.signal.aborted) setUsers(value); }).catch(err => { if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить пользователей.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, filter, page, reload, role]);
  useEffect(() => {
    if (!selected || role !== 'ADMIN') return;
    const controller = new AbortController(); setHistory([]); setHistoryLoading(true);
    roleHistory(selected.id, controller.signal).then(value => { if (!controller.signal.aborted) setHistory(value); }).catch(err => { if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить журнал.'); }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [selected, role]);
  if (role !== 'ADMIN') return <p role="alert">{t('Недостаточно прав.')}</p>;
  function discard() { return !dirty || window.confirm(t('Отменить несохранённые изменения?')); }
  function select(user: ManagedUser) { if (!discard()) return; setSelected(user); setNextRole(user.role); setReason(''); setError(''); setMessage(''); }
  async function save() {
    if (!selected || pending.current || !lifetime.current || nextRole === selected.role) return;
    pending.current = true; setBusy(true); setError(''); setMessage(''); const signal = lifetime.current.signal;
    try {
      const updated = await setUserRole(selected, nextRole, reason, signal);
      if (!signal.aborted) { setSelected(updated); setNextRole(updated.role); setReason(''); setReload(n => n + 1); setMessage('Роль изменена. Пользователю нужно войти заново.'); }
    } catch (err) { if (!signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось изменить роль.'); }
    finally { if (!signal.aborted) { pending.current = false; setBusy(false); } }
  }
  return <section className="max-w-5xl mx-auto space-y-6"><h1 className="text-3xl font-bold">{t('Пользователи и роли')}</h1>
    <p>{t('Ученик учится; редактор готовит уроки; администратор публикует и управляет доступом.')}</p>
    {error && <div role="alert"><p>{t(error)}</p><button disabled={busy} className="underline" onClick={() => { if (discard()) { setSelected(null); setReason(''); setReload(n => n + 1); } }}>{t('Обновить список')}</button></div>}
    {message && <p role="status">{t(message)}</p>}
    <form className="flex flex-wrap gap-3 items-end" onSubmit={e => { e.preventDefault(); if (discard()) { setSelected(null); setReason(''); setPage(0); setQuery(search); setReload(n => n + 1); } }}><label className="grow">{t('Поиск по имени или email')}<input maxLength={100} disabled={busy} value={search} onChange={e => setSearch(e.target.value)} className={inputClass} /></label><button disabled={busy} className="border border-border rounded-lg p-3">{t('Найти')}</button></form>
    <label className="block">{t('Фильтр по роли')}<select disabled={busy} className={inputClass} value={filter} onChange={e => { if (discard()) { setSelected(null); setReason(''); setFilter(e.target.value); setPage(0); } }}><option value="">{t('Все роли')}</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
    {loading ? <p role="status">{t('Загрузка…')}</p> : <><ul className="space-y-3">{users.map(user => <li key={user.id} className="border border-border rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between"><div className="min-w-0 break-words"><p className="font-bold">{user.name}</p><p>{user.email}</p><p>{t(labels[user.role])} · {t(user.emailVerifiedAt ? 'Email подтверждён' : 'Email не подтверждён')}</p></div><button disabled={busy} className="border border-border rounded-lg p-3" onClick={() => select(user)}>{t('Настроить доступ')}</button></li>)}</ul>{!users.length && <p>{t('Пользователи не найдены.')}</p>}<div className="flex gap-4 items-center"><button disabled={busy || page === 0} onClick={() => { if (discard()) { setSelected(null); setPage(n => n - 1); } }}>{t('Назад')}</button><span>{t('Страница')} {page + 1}</span><button disabled={busy || users.length < 50} onClick={() => { if (discard()) { setSelected(null); setPage(n => n + 1); } }}>{t('Далее')}</button></div></>}
    {selected && <section className="border border-border rounded-2xl p-5 space-y-4"><h2 className="text-xl font-bold break-words">{selected.name} · {selected.email}</h2>
      {selected.id === currentUserId ? <p>{t('Свою роль изменять нельзя.')}</p> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(); }}><fieldset disabled={busy} className="space-y-4"><label className="block">{t('Новая роль')}<select className={inputClass} value={nextRole} onChange={e => setNextRole(e.target.value as ManagedUser['role'])}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value} disabled={!selected.emailVerifiedAt && value !== 'STUDENT'}>{t(label)}</option>)}</select></label><label className="block">{t('Причина изменения')}<textarea className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label><p>{t('Смена роли завершит все сессии этого пользователя.')}</p><p>{t(labels[selected.role])} → {t(labels[nextRole])}</p><button disabled={nextRole === selected.role || reason.trim().length < 3} className="bg-primary text-primary-foreground px-5 py-3 rounded-lg disabled:opacity-40">{t('Сохранить роль')}</button></fieldset></form>}
      <h3 className="font-bold">{t('История изменения ролей')}</h3>{historyLoading ? <p role="status">{t('Загрузка…')}</p> : <ul className="space-y-3">{history.map(change => <li key={change.id}><p>{new Date(change.createdAt).toLocaleString(language)} · {change.actor?.email ?? change.actorId}</p><p>{t(labels[change.before])} → {t(labels[change.after])}</p><p className="break-words">{change.reason}</p></li>)}{!history.length && <li>{t('Изменений пока нет.')}</li>}</ul>}
    </section>}
  </section>;
}
