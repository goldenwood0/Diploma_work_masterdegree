import Dictionary from './pages/Dictionary';
import MediaLibrary from './pages/MediaLibrary';
import { useLanguage } from './i18n/LanguageProvider';
import ProfileForm from './components/ProfileForm';
import { Home, BookOpen, RefreshCw, User, Sparkles } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import useRoute from './app/useRoute';
import NavButton from './components/NavButton';
import MobileNavButton from './components/MobileNavButton';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import Lesson from './pages/Lesson';
import AiTutorPanel from './components/AiTutorPanel';
import Profile from './pages/Profile';
import Reviews from './pages/Reviews';
import NotFound from './pages/NotFound';
import Auth, { isAuthScreen } from './pages/Auth';
import useAccount from './app/useAccount';
import ContentAdmin from './pages/ContentAdmin';
import UsersAdmin from './pages/UsersAdmin';

export default function App() {
  const { t } = useLanguage();
  const [currentScreen, setCurrentScreen, lessonSlug] = useRoute();
  const [isAiTutorOpen, setIsAiTutorOpen] = useState(false);
  const [reviewMistakes, setReviewMistakes] = useState(false);
  const { account, loading, error, refresh, accept } = useAccount();

  const mobileNav = useRef<HTMLElement>(null);
  const header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!mobileNav.current || !header.current) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--mobile-nav-height', `${mobileNav.current?.getBoundingClientRect().height ?? 0}px`);
      root.style.setProperty('--app-header-height', `${header.current?.getBoundingClientRect().height ?? 0}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(mobileNav.current);
    observer.observe(header.current);
    update();
    return () => {
      observer.disconnect();
      root.style.removeProperty('--mobile-nav-height');
      root.style.removeProperty('--app-header-height');
    };
  }, [loading, account, currentScreen]);

  if (loading) return <main className="p-12 text-center" role="status">{t("Загрузка аккаунта…")}</main>;
  if (isAuthScreen(currentScreen)) return <Auth key={currentScreen} mode={currentScreen} onNavigate={setCurrentScreen} onSignedIn={refresh} />;
  if (error) return <main className="p-12 text-center space-y-4"><p role="alert">{t(error)}</p><button className="text-primary underline" onClick={() => void refresh()}>{t("Повторить")}</button></main>;
  if (!account) return <Auth key="login" mode="login" onNavigate={setCurrentScreen} onSignedIn={refresh} />;

  if (!account.settings?.onboardingCompletedAt) return <main className="max-w-2xl mx-auto px-4 py-10"><ProfileForm account={account} onboarding onSaved={user => { accept(user); setCurrentScreen('dashboard'); }} /></main>;

  return (
    <div className="app-shell flex flex-col min-h-dvh bg-background relative font-sans">
      {/* Navigation */}
      <header ref={header} className="app-header sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button type="button" aria-label={`ZhPath — ${t("Главная")}`} className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg" onClick={() => setCurrentScreen('dashboard')}>
              <div aria-hidden="true" className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold sc-text text-xl">
                中
              </div>
              <span className="font-bold text-xl text-dark-green tracking-tight">ZhPath</span>
            </button>
            
            <nav aria-label={t("Основная навигация")} className="hidden lg:flex gap-1">
              <NavButton 
                icon={<Home size={18} />} 
                label={t("Главная")} 
                active={currentScreen === 'dashboard'} 
                onClick={() => setCurrentScreen('dashboard')} 
              />
              <NavButton 
                icon={<BookOpen size={18} />} 
                label={t("Курсы")} 
                active={currentScreen === 'catalog' || currentScreen === 'lesson'} 
                onClick={() => setCurrentScreen('catalog')} 
              />
              <NavButton 
                icon={<RefreshCw size={18} />} 
                label={t("Повторение")} 
                active={currentScreen === 'reviews'} 
                onClick={() => setCurrentScreen('reviews')} 
              />
              <NavButton 
                icon={<User size={18} />} 
                label={t("Профиль")} 
                active={currentScreen === 'profile'} 
                onClick={() => setCurrentScreen('profile')} 
              />
              <NavButton icon={<BookOpen size={18} />} label={t("Словарь")} active={currentScreen === 'dictionary'} onClick={() => setCurrentScreen('dictionary')} />
              <MobileNavButton label={t("Словарь")} icon={<BookOpen size={24} />} active={currentScreen === 'dictionary'} onClick={() => setCurrentScreen('dictionary')} />
      </nav>

            <div className="flex items-center">
              <button
                type="button"
                aria-label={t("Открыть ИИ-помощника")}
                title={t("Открыть ИИ-помощника")}
                aria-haspopup="dialog"
                aria-expanded={isAiTutorOpen}
                onClick={() => { setReviewMistakes(false); setIsAiTutorOpen(true); }}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-secondary transition-colors"
              >
                <Sparkles size={24} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pt-6 sm:pt-10 transition-all duration-300">
        {account.role !== 'STUDENT' && <div className="mb-6 flex flex-wrap justify-end gap-2">
          {([
            ['content', 'Управление уроками'],
            ...(account.role === 'ADMIN' ? [['users', 'Пользователи и роли']] : []),
            ['media', 'Медиатека'],
          ] as const).map(([screen, label]) => <button key={screen}
            aria-current={currentScreen === screen ? 'page' : undefined}
            className={`min-h-11 rounded-xl border px-4 py-2 text-sm transition-colors ${currentScreen === screen ? 'border-primary bg-secondary font-semibold text-primary' : 'border-border bg-card text-primary hover:bg-secondary'}`}
            onClick={() => setCurrentScreen(screen as 'content' | 'users' | 'media')}>{t(label)}</button>)}
        </div>}
        {currentScreen === 'media' && <MediaLibrary role={account.role} />}
        {currentScreen === 'users' && <UsersAdmin role={account.role} currentUserId={account.id} />}
        {currentScreen === 'content' && <ContentAdmin role={account.role} />}
        {currentScreen === 'dashboard' && <Dashboard name={account.name} onNavigate={setCurrentScreen} />}
        {currentScreen === 'catalog' && <Catalog onNavigate={setCurrentScreen} />}
        {currentScreen === 'lesson' && <Lesson key={`${account.id}:${lessonSlug}`} userId={account.id} slug={lessonSlug} onNavigate={setCurrentScreen} onReviewMistakes={() => { setReviewMistakes(true); setIsAiTutorOpen(true); }} />}
        {currentScreen === 'profile' && <Profile account={account} onSignedOut={refresh} onSaved={accept} />}
        {currentScreen === 'reviews' && <Reviews />}
        {currentScreen === 'dictionary' && <Dictionary key={account.id} />}
        {currentScreen === 'not-found' && <NotFound />} 
      </main>

      {/* AI Tutor Sidebar */}
      {isAiTutorOpen && (
        <AiTutorPanel key={`${account.id}:${currentScreen}:${lessonSlug}:${reviewMistakes}`} initialMode={reviewMistakes ? 'mistakes' : 'explain'} autoSend={reviewMistakes} lessonSlug={currentScreen === 'lesson' ? lessonSlug : undefined} onClose={() => setIsAiTutorOpen(false)} />
      )}

      {/* Mobile Bottom Nav */}
      <nav ref={mobileNav} aria-label={t("Основная навигация")} className="mobile-nav lg:hidden fixed bottom-0 inset-x-0 bg-background border-t border-border grid grid-cols-5 gap-1 z-40">
        <MobileNavButton label={t("Главная")} icon={<Home size={24} />} active={currentScreen === 'dashboard'} onClick={() => setCurrentScreen('dashboard')} />
        <MobileNavButton label={t("Курсы")} icon={<BookOpen size={24} />} active={currentScreen === 'catalog' || currentScreen === 'lesson'} onClick={() => setCurrentScreen('catalog')} />
        <MobileNavButton label={t("Повторение")} icon={<RefreshCw size={24} />} active={currentScreen === 'reviews'} onClick={() => setCurrentScreen('reviews')} />
        <MobileNavButton label={t("Профиль")} icon={<User size={24} />} active={currentScreen === 'profile'} onClick={() => setCurrentScreen('profile')} />
        <MobileNavButton label={t("Словарь")} icon={<BookOpen size={24} />} active={currentScreen === 'dictionary'} onClick={() => setCurrentScreen('dictionary')} />
      </nav>
    </div>
  );
}
