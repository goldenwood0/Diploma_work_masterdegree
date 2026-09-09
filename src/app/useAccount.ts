import { useCallback, useEffect, useState } from 'react';
import { currentAccount, type Account } from '../api/auth';
import { ApiError } from '../api/client';

export default function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setAccount(await currentAccount()); }
    catch (err) {
      setAccount(null);
      if (!(err instanceof ApiError && err.status === 401)) setError('Не удалось подключиться к серверу.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { account, loading, error, refresh };
}
