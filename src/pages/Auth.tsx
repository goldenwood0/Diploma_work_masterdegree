import { useLanguage } from '../i18n/LanguageProvider';
import LanguageSelect from '../components/LanguageSelect';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { authAction } from '../api/auth';
import type { Screen } from '../app/routes';

const modes = {
  login: ['Войти в ZhPath', 'Войти', 'login'],
  register: ['Начните изучать китайский', 'Создать аккаунт', 'register'],
  forgotPassword: ['Восстановить доступ', 'Отправить ссылку', 'forgot-password'],
  resetPassword: ['Новый пароль', 'Сохранить пароль', 'reset-password'],
  verifyEmail: ['Подтверждение email', 'Подтвердить email', 'verify-email'],
  resendVerification: ['Письмо подтверждения', 'Отправить повторно', 'resend-verification'],
} as const;
export type AuthScreen = keyof typeof modes;
export function isAuthScreen(screen: string): screen is AuthScreen { return Object.prototype.hasOwnProperty.call(modes, screen); }

export default function Auth({ mode, onNavigate, onSignedIn }: {
  mode: AuthScreen; onNavigate: (screen: Screen) => void; onSignedIn: () => Promise<void>;
}) {
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [title, button, endpoint] = modes[mode];
  const needsEmail = !['verifyEmail', 'resetPassword'].includes(mode);
  const needsPassword = ['login', 'register', 'resetPassword'].includes(mode);
  const token = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('token') ?? '';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = {};
    if (needsEmail) body.email = String(form.get('email'));
    if (needsPassword) body.password = String(form.get('password'));
    if (mode === 'register') { body.name = String(form.get('name')); body.uiLanguage = language; }
    if (mode === 'verifyEmail' || mode === 'resetPassword') body.token = token;
    setBusy(true); setError('');
    try {
      const result = await authAction(endpoint, body);
      if (mode === 'login') { await onSignedIn(); onNavigate('dashboard'); }
      else {
        setMessage(z.object({ message: z.string() }).parse(result).message);
        if (mode === 'resetPassword' || mode === 'verifyEmail') window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${endpoint}`);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось выполнить действие.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-md bg-white rounded-3xl border border-border shadow-sm p-6 sm:p-8 space-y-6">
        <a href="#/login" className="font-bold text-2xl text-primary">中 ZhPath</a>
        <LanguageSelect />
        <div><h1 className="text-2xl font-bold text-dark-green">{t(title)}</h1><p className="mt-2 text-muted-foreground">{t("Китайский язык — шаг за шагом.")}</p></div>
        {error && <p role="alert" className="rounded-xl bg-coral/10 p-3 text-dark-green">{t(error)}</p>}
        {message ? <p role="status" className="rounded-xl bg-sage p-4">{t(message)}</p> : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
              {mode === 'register' && <label className="block font-medium">{t("Имя")}<input name="name" autoComplete="name" required maxLength={80} className="mt-2 w-full rounded-xl border p-3" /></label>}
              {needsEmail && <label className="block font-medium">Email<input name="email" type="email" autoComplete="email" required maxLength={254} className="mt-2 w-full rounded-xl border p-3" /></label>}
              {needsPassword && <label className="block font-medium">{t(mode === 'resetPassword' ? 'Новый пароль' : 'Пароль')}<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={12} maxLength={128} className="mt-2 w-full rounded-xl border p-3" /><span className="text-sm text-muted-foreground">{t("От 12 до 128 символов")}</span></label>}
              {mode === 'verifyEmail' && <p>{t("Нажмите кнопку, чтобы подтвердить адрес из письма.")}</p>}
              <button className="w-full bg-primary text-primary-foreground rounded-xl p-3 font-bold" type="submit">{t(busy ? 'Подождите…' : button)}</button>
            </fieldset>
          </form>
        )}
        <nav aria-label={t("Доступ к аккаунту")} className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-primary">
          {mode !== 'login' && <a href="#/login" className="hover:underline">{t("Войти")}</a>}
          {mode !== 'register' && <a href="#/register" className="hover:underline">{t("Создать аккаунт")}</a>}
          <a href="#/forgot-password" className="hover:underline">{t("Забыли пароль?")}</a>
          <a href="#/resend-verification" className="hover:underline">{t("Повторить письмо подтверждения")}</a>
        </nav>
      </section>
    </main>
  );
}
