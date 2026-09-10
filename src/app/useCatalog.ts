import { useEffect, useState } from 'react';
import { getCatalog, type CatalogData } from '../api/learning';
export default function useCatalog() {
  const [data, setData] = useState<CatalogData | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(false); setData(null);
    getCatalog(controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  return { data, error, retry: () => setAttempt(a => a + 1) };
}
