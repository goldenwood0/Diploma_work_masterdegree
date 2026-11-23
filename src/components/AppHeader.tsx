import { ChevronDown, Search, Sparkles } from 'lucide-react';
import { forwardRef, useEffect, useRef, useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import type { Screen } from '../app/routes';

type Page = 'dashboard' | 'catalog' | 'reviews' | 'dictionary';

const pages: { screen: Page; label: string }[] = [
  { screen: 'dashboard', label: 'Главная' },
  { screen: 'catalog', label: 'Курсы' },
  { screen: 'reviews', label: 'Повторение' },
  { screen: 'dictionary', label: 'Словарь' },
];

// Header from the ПР6 "Navigation / Header" component: 4 links + search on desktop (≥1200),
// 2 links + "More" + search on tablet (768–1199), logo + search icon on phones.
const AppHeader = forwardRef<HTMLElement, {
  name: string;
  current: Screen | 'not-found';
  aiOpen: boolean;
  onNavigate: (screen: Screen) => void;
  onOpenAi: () => void;
}>(function AppHeader({ name, current, aiOpen, onNavigate, onOpenAi }, ref) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const isActive = (screen: Page) => current === screen || (screen === 'catalog' && current === 'lesson');
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'Z';

  function search(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    window.location.hash = q ? `/courses?q=${encodeURIComponent(q)}` : '/courses';
  }

  const link = (page: (typeof pages)[number], extra = '') => (
    <button key={page.screen} type="button" aria-current={isActive(page.screen) ? 'page' : undefined}
      onClick={() => onNavigate(page.screen)}
      className={`min-h-11 shrink-0 rounded-xl px-2.5 text-base desktop:px-3 transition-colors ${isActive(page.screen) ? 'bg-secondary font-bold text-dark-green' : 'font-medium text-foreground hover:bg-secondary'} ${extra}`}>
      {t(page.label)}
    </button>
  );

  return (
    <header ref={ref} className="app-header sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="page-container flex h-16 items-center gap-3 tablet:h-[72px] desktop:gap-6">
        <button type="button" aria-label={`ZhPath — ${t('Главная')}`} className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg" onClick={() => onNavigate('dashboard')}>
          <span aria-hidden="true" className="sc-text flex size-9 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground">中</span>
          <span className="text-xl font-bold tracking-tight text-dark-green">ZhPath</span>
        </button>

        <nav aria-label={t('Основная навигация')} className="hidden items-center gap-1 tablet:flex">
          <div className="hidden items-center gap-1 desktop:flex">{pages.map(page => link(page))}</div>
          <div className="flex items-center gap-1 desktop:hidden">
            {link(pages[1])}
            {link(pages[2])}
            <MoreMenu items={[pages[0], pages[3]]} isActive={isActive} onNavigate={onNavigate} />
          </div>
        </nav>

        <form role="search" onSubmit={search} className="ml-auto hidden min-w-0 flex-1 tablet:flex desktop:max-w-xl">
          <label className="search-field flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary">
            <Search size={20} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            <span className="sr-only">{t('Поиск уроков')}</span>
            <input type="search" value={query} maxLength={200} onChange={event => setQuery(event.target.value)}
              placeholder={t('Поиск уроков')} className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-muted-foreground" />
          </label>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2 tablet:ml-0">
          <button type="button" aria-label={t('Поиск уроков')} onClick={() => { window.location.hash = '/courses?focus=search'; }}
            className="flex size-11 items-center justify-center rounded-full text-foreground hover:bg-secondary tablet:hidden">
            <Search size={24} aria-hidden="true" />
          </button>
          <button type="button" aria-label={t('Открыть ИИ-помощника')} title={t('Открыть ИИ-помощника')} aria-haspopup="dialog" aria-expanded={aiOpen} onClick={onOpenAi}
            className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors hover:bg-secondary">
            <Sparkles size={22} aria-hidden="true" />
          </button>
          <button type="button" aria-label={t('Профиль')} title={t('Профиль')} aria-current={current === 'profile' ? 'page' : undefined} onClick={() => onNavigate('profile')}
            className={`hidden size-11 items-center justify-center rounded-full text-sm font-bold text-dark-green tablet:flex ${current === 'profile' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-border'}`}>
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
});

export default AppHeader;

function MoreMenu({ items, isActive, onNavigate }: {
  items: { screen: Page; label: string }[];
  isActive: (screen: Page) => boolean;
  onNavigate: (screen: Screen) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const active = items.some(item => isActive(item.screen));
  return (
    <div ref={root} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(value => !value)}
        className={`flex min-h-11 items-center gap-1 rounded-xl px-2.5 text-base transition-colors hover:bg-secondary ${active ? 'bg-secondary font-bold text-dark-green' : 'font-medium'}`}>
        {t('Ещё')}<ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-50 mt-2 min-w-48 rounded-xl border border-border bg-card p-1 shadow-lg">
          {items.map(item => (
            <li key={item.screen}>
              <button type="button" aria-current={isActive(item.screen) ? 'page' : undefined}
                onClick={() => { setOpen(false); onNavigate(item.screen); }}
                className={`flex min-h-11 w-full items-center rounded-lg px-3 text-left hover:bg-secondary ${isActive(item.screen) ? 'font-bold text-dark-green' : ''}`}>
                {t(item.label)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
