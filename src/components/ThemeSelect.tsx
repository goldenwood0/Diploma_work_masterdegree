import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';

export default function ThemeSelect() {
  const { t } = useLanguage();
  const [preference, setPreference] = useState(() => document.documentElement.dataset.themePreference || 'system');
  useEffect(() => {
    const sync = () => setPreference(document.documentElement.dataset.themePreference || 'system');
    window.addEventListener('zhpath-theme-applied', sync);
    return () => window.removeEventListener('zhpath-theme-applied', sync);
  }, []);
  return <section className="rounded-3xl border border-border bg-card p-6 space-y-3">
    <h2 className="text-xl font-bold">{t('Оформление')}</h2>
    <label className="block font-medium">{t('Тема')}
      <select value={preference} onChange={event => window.dispatchEvent(new CustomEvent('zhpath-theme-change', { detail: event.target.value }))}
        className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background p-3">
        <option value="system">{t('Как на устройстве')}</option>
        <option value="light">{t('Светлая')}</option>
        <option value="dark">{t('Тёмная')}</option>
      </select>
    </label>
    <p className="text-sm text-muted-foreground">{t('Тема применяется сразу и запоминается в этом браузере.')}</p>
  </section>;
}
