import { useEffect, useState } from 'react';
import { getStats, type LearningStats as Stats } from '../api/stats';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';
import LearningStats from './LearningStats';

// Profile → «Прогресс» from the ПР4 sitemap: full statistics live here, the home screen keeps a short summary.
export default function ProgressSection() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    getStats(controller.signal)
      .then(value => { if (!controller.signal.aborted) setStats(value); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить учебные данные.'); });
    return () => controller.abort();
  }, [attempt]);
  return <section id="progress" aria-labelledby="progress-title" className="scroll-mt-24 space-y-4">
    <h2 id="progress-title" className="text-2xl font-bold text-dark-green">{t('Прогресс')}</h2>
    {stats && <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-2xl border border-border bg-card p-5">
      <p className="text-lg font-bold text-dark-green">{t('Уровень')} {stats.points.level}</p>
      <p className="tabular-nums text-muted-foreground">{t('Очки')}: {stats.points.xp}</p>
    </div>}
    {error && <div role="alert" className="space-y-2"><p>{t(error)}</p><button type="button" className="min-h-11 underline" onClick={() => setAttempt(n => n + 1)}>{t('Повторить загрузку')}</button></div>}
    {!stats && !error && <p role="status">{t('Загрузка…')}</p>}
    {stats && <LearningStats data={stats} />}
  </section>;
}
