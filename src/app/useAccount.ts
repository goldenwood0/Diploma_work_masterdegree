import { useCallback, useEffect, useState } from 'react';
import { currentAccount, type Account } from '../api/auth';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';

export default function useAccount() {
  const { setLanguage, setExplanationLanguage } = useLanguage();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const user = await currentAccount(); setAccount(user);
      if (user.settings) { setLanguage(user.settings.uiLanguage); setExplanationLanguage(user.settings.explanationLanguage); }
    }
    catch (err) {
      setAccount(null);
      if (!(err instanceof ApiError && err.status === 401)) setError('Не удалось подключиться к серверу.');
    } finally { setLoading(false); }
  }, [setLanguage, setExplanationLanguage]);
  useEffect(() => { void refresh(); }, [refresh]);
  const accept = (user: Account) => {
    setAccount(user);
    if (user.settings) { setLanguage(user.settings.uiLanguage); setExplanationLanguage(user.settings.explanationLanguage); }
  };
  return { account, loading, error, refresh, accept };
}
