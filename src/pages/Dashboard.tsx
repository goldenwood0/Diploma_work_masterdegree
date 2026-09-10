import { ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import type { Screen } from '../app/routes';
import useCatalog from '../app/useCatalog';
import { useLanguage } from '../i18n/LanguageProvider';

export default function Dashboard({ name, onNavigate }: { name: string; onNavigate: (screen: Screen, slug?: string) => void }) {
  const { t, language } = useLanguage();
  const { data, error, retry } = useCatalog();
  const lessons = data?.curricula.flatMap(c => c.levels.flatMap(l => l.units.flatMap(u => u.lessons))) ?? [];
  const completed = lessons.filter(l => l.progress.completedAt).length;
  const available = lessons.filter(l => !l.locked && !l.progress.completedAt);
  const next = available.find(l => l.progress.nextBlock > 0) ?? available[0];
  return <section className="max-w-4xl mx-auto space-y-8">
    <header><h1 className="text-3xl font-bold text-dark-green">{t('Здравствуйте')}, {name}!</h1><p className="mt-3 text-foreground/65">{t('Продолжайте изучать китайский шаг за шагом.')}</p></header>
    {error ? <div role="alert"><p>{t('Не удалось загрузить учебные данные.')}</p><button className="underline" onClick={retry}>{t('Повторить')}</button></div> : !data ? <p role="status">{t('Загрузка…')}</p> : <>
      <div className="grid sm:grid-cols-2 gap-4"><div className="bg-card border border-border rounded-2xl p-6"><BookOpen className="text-primary mb-3" /><p>{t('Опубликовано уроков')}</p><strong className="text-3xl">{lessons.length}</strong></div>
        <div className="bg-card border border-border rounded-2xl p-6"><CheckCircle2 className="text-primary mb-3" /><p>{t('Завершено')}</p><strong className="text-3xl">{completed} / {lessons.length}</strong></div></div>
      <div className="bg-secondary rounded-2xl p-6 sm:p-8 space-y-4"><h2 className="text-xl font-semibold">{next ? next.title[language] : t(lessons.length ? 'Все опубликованные уроки завершены.' : 'Материалы готовятся.')}</h2>
        {next && <p>{next.progress.nextBlock}/{next.blockCount} {t('блоков')}</p>}
        <button onClick={() => next ? onNavigate('lesson', next.slug) : onNavigate('catalog')} className="inline-flex items-center gap-3 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-semibold">{t(next ? next.progress.nextBlock ? 'Продолжить' : 'Начать урок' : 'Курсы')}<ArrowRight size={18} /></button>
      </div>
    </>}
  </section>;
}
