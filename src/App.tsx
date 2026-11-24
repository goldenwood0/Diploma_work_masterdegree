import Dictionary from './pages/Dictionary';
import MediaLibrary from './pages/MediaLibrary';
import { useLanguage } from './i18n/LanguageProvider';
import ProfileForm from './components/ProfileForm';
import { Home, BookOpen, RefreshCw, User, LayoutPanelTop } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import useRoute from './app/useRoute';
import AppHeader from './components/AppHeader';
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
  const [reviewQuestion, setReviewQuestion] = useState<string | undefined>();
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
      <AppHeader ref={header} name={account.name} current={currentScreen} aiOpen={isAiTutorOpen}
        onNavigate={setCurrentScreen} onOpenAi={() => { setReviewMistakes(false); setReviewQuestion(undefined); setIsAiTutorOpen(true); }} />

      {/* Main Content Area */}
      <main className="page-container min-w-0 flex-1 w-full py-6 tablet:py-10">
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
        {currentScreen === 'dashboard' && <Dashboard name={account.name} dailyGoalMinutes={account.settings?.dailyGoalMinutes} onNavigate={setCurrentScreen} />}
        {currentScreen === 'catalog' && <Catalog onNavigate={setCurrentScreen} />}
        {currentScreen === 'lesson' && <Lesson key={`${account.id}:${lessonSlug}`} userId={account.id} slug={lessonSlug} onNavigate={setCurrentScreen} onReviewMistakes={(questionId?: string) => { setReviewMistakes(true); setReviewQuestion(questionId); setIsAiTutorOpen(true); }} />}
        {currentScreen === 'profile' && <Profile account={account} onSignedOut={refresh} onSaved={accept} />}
        {currentScreen === 'reviews' && <Reviews />}
        {currentScreen === 'dictionary' && <Dictionary key={account.id} />}
        {currentScreen === 'not-found' && <NotFound />} 
      </main>

      {/* AI Tutor Sidebar */}
      {isAiTutorOpen && (
        <AiTutorPanel key={`${account.id}:${currentScreen}:${lessonSlug}:${reviewMistakes}:${reviewQuestion ?? ''}`} initialMode={reviewMistakes ? 'mistakes' : 'chat'} autoSend={reviewMistakes} questionId={reviewMistakes ? reviewQuestion : undefined} lessonSlug={currentScreen === 'lesson' ? lessonSlug : undefined} onClose={() => setIsAiTutorOpen(false)} />
      )}

      {/* Mobile Bottom Nav */}
      <nav ref={mobileNav} aria-label={t("Основная навигация")} className="mobile-nav tablet:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border grid grid-cols-5 gap-1 z-40">
        <MobileNavButton label={t("Главная")} icon={<Home size={24} />} active={currentScreen === 'dashboard'} onClick={() => setCurrentScreen('dashboard')} />
        <MobileNavButton label={t("Курсы")} icon={<LayoutPanelTop size={24} />} active={currentScreen === 'catalog' || currentScreen === 'lesson'} onClick={() => setCurrentScreen('catalog')} />
        <MobileNavButton label={t("Повтор")} icon={<RefreshCw size={24} />} active={currentScreen === 'reviews'} onClick={() => setCurrentScreen('reviews')} />
        <MobileNavButton label={t("Словарь")} icon={<BookOpen size={24} />} active={currentScreen === 'dictionary'} onClick={() => setCurrentScreen('dictionary')} />
        <MobileNavButton label={t("Профиль")} icon={<User size={24} />} active={currentScreen === 'profile'} onClick={() => setCurrentScreen('profile')} />
      </nav>
    </div>
  );
}
