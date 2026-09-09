import { useState, type FormEvent } from 'react';
import { saveProfile, type Account, type ProfileInput } from '../api/auth';
import { useLanguage } from '../i18n/LanguageProvider';
import { isLanguage } from '../i18n/translate';

export default function ProfileForm({ account, onboarding = false, onSaved }: {
  account: Account; onboarding?: boolean; onSaved: (account: Account) => void;
}) {
  const { language, setLanguage, t } = useLanguage();
  const [form, setForm] = useState<ProfileInput>(() => ({
    name: account.name, uiLanguage: account.settings?.uiLanguage ?? language,
    explanationLanguage: account.settings?.explanationLanguage ?? language,
    timezone: account.settings?.onboardingCompletedAt ? account.settings.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    dailyGoalMinutes: account.settings?.dailyGoalMinutes ?? 20,
    experience: account.settings?.experience ?? 'beginner', goal: account.settings?.goal ?? 'communication',
    startLevel: account.settings?.startLevel ?? 1, remindersEnabled: account.settings?.remindersEnabled ?? false,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const field = 'mt-2 w-full rounded-xl border border-border bg-white p-3 focus:outline-none focus:ring-2 focus:ring-primary/30';
  function update<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) { setForm(previous => ({ ...previous, [key]: value })); setSaved(false); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setSaved(false);
    try { const result = await saveProfile({ ...form, completeOnboarding: onboarding }); onSaved(result); setSaved(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Проверьте настройки профиля.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="bg-white border border-border rounded-3xl p-6 sm:p-8 space-y-6">
    <div><h1 className="text-2xl font-bold">{t(onboarding ? 'Настроим ваше обучение' : 'Настройки обучения')}</h1>
      {onboarding && <p className="mt-2 text-muted-foreground">{t('Выберите цель и удобный темп. Всё можно изменить в профиле.')}</p>}</div>
    {error && <p role="alert" className="bg-coral/10 rounded-xl p-3">{t(error)}</p>}
    {saved && <p role="status" className="bg-sage rounded-xl p-3">{t('Настройки сохранены.')}</p>}
    <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
      <label className="block font-medium">{t('Имя')}<input required maxLength={80} autoComplete="name" value={form.name} onChange={e => update('name', e.target.value)} className={field} /></label>
      <div className="grid sm:grid-cols-2 gap-5">
        <label className="block font-medium">{t('Язык интерфейса')}<select className={field} value={form.uiLanguage} onChange={e => { const value = e.target.value; if (isLanguage(value)) { update('uiLanguage', value); setLanguage(value); } }}>
          <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
        </select></label>
        <label className="block font-medium">{t('Язык объяснений')}<select className={field} value={form.explanationLanguage} onChange={e => { if (isLanguage(e.target.value)) update('explanationLanguage', e.target.value); }}>
          <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
        </select></label>
      </div>
      <p className="text-sm text-muted-foreground">{t('Язык меню и язык объяснений можно выбрать независимо.')}</p>
      <label className="block font-medium">{t('Опыт изучения')}<select className={field} value={form.experience} onChange={e => update('experience', e.target.value as ProfileInput['experience'])}>
        <option value="beginner">{t('Начинаю с нуля')}</option><option value="some">{t('Знаю основы')}</option><option value="experienced">{t('Уже изучаю китайский')}</option>
      </select></label>
      <label className="block font-medium">{t('Цель обучения')}<select className={field} value={form.goal} onChange={e => update('goal', e.target.value as ProfileInput['goal'])}>
        <option value="communication">{t('Общение')}</option><option value="study">{t('Учёба')}</option><option value="work">{t('Работа')}</option><option value="exam">{t('Экзамен HSK')}</option>
      </select></label>
      <label className="block font-medium">{t('Стартовый уровень')}<select className={field} value={form.startLevel} onChange={e => update('startLevel', Number(e.target.value))}>
        {[1, 2, 3, 4, 5, 6].map(level => <option key={level} value={level}>HSK {level}</option>)}
      </select></label>
      <p className="text-sm text-muted-foreground">{t('Уровень сохранится в профиле. Доступность уроков зависит от опубликованной программы.')}</p>
      <label className="block font-medium">{t('Дневная норма (мин)')}: <output>{form.dailyGoalMinutes}</output>
        <input type="range" min={5} max={60} step={5} value={form.dailyGoalMinutes} onChange={e => update('dailyGoalMinutes', Number(e.target.value))} className="mt-3 block w-full accent-primary" />
      </label>
      <label className="block font-medium">{t('Часовой пояс')}<input required maxLength={80} list="timezones" value={form.timezone} onChange={e => update('timezone', e.target.value)} className={field} placeholder="Asia/Almaty" /></label>
      <datalist id="timezones">{['Asia/Almaty', 'Asia/Qyzylorda', 'Asia/Shanghai', 'Europe/Moscow', 'Europe/London', 'America/New_York', 'UTC'].map(zone => <option key={zone} value={zone} />)}</datalist>
      <label className="flex gap-3 items-center font-medium"><input type="checkbox" checked={form.remindersEnabled} onChange={e => update('remindersEnabled', e.target.checked)} className="size-5 accent-primary" />{t('Напоминать о ежедневной цели')}</label>
      <p className="text-sm text-muted-foreground">{t('Предпочтение сохранится; отправка напоминаний появится позже.')}</p>
      <button className="w-full rounded-xl bg-primary text-primary-foreground font-bold p-4">{t(busy ? 'Сохранение…' : onboarding ? 'Начать обучение' : 'Сохранить настройки')}</button>
    </fieldset>
  </form>;
}
