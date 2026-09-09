import { useState } from 'react';
import { authAction, type Account } from '../api/auth';
import ProfileForm from '../components/ProfileForm';
import { useLanguage } from '../i18n/LanguageProvider';

export default function Profile({ account, onSignedOut, onSaved }: { account: Account; onSignedOut: () => Promise<void>; onSaved: (account: Account) => void }) {
  const { t } = useLanguage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function logout(all: boolean) {
    setBusy(true); setError('');
    try { await authAction(all ? 'logout-all' : 'logout'); await onSignedOut(); }
    catch { setError('Не удалось выйти. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }
  return <div className="max-w-2xl mx-auto space-y-6 pb-20">
    <header className="bg-white border rounded-3xl p-6 flex gap-5 items-center">
      <div className="size-16 rounded-full bg-coral text-white flex items-center justify-center text-2xl shrink-0">{account.name.charAt(0)}</div>
      <div className="min-w-0"><h1 className="text-2xl font-bold break-words">{account.name}</h1><p className="break-all text-muted-foreground">{account.email}</p><p className="text-sm text-primary mt-2">{t('Email подтверждён')}</p></div>
    </header>
    <ProfileForm account={account} onSaved={onSaved} />
    <section className="bg-white rounded-3xl border p-6 space-y-4">
      <h2 className="font-bold text-xl">{t('Безопасность аккаунта')}</h2>
      {error && <p role="alert">{t(error)}</p>}
      <div className="flex flex-wrap gap-4">
        <button disabled={busy} className="text-primary underline disabled:opacity-50" onClick={() => void logout(false)}>{t('Выйти')}</button>
        <button disabled={busy} className="text-primary underline disabled:opacity-50" onClick={() => void logout(true)}>{t('Выйти со всех устройств')}</button>
      </div>
    </section>
  </div>;
}
