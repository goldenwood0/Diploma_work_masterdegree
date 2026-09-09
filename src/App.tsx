import { Home, BookOpen, RefreshCw, User, Sparkles } from 'lucide-react';
import { useState } from 'react';
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

export default function App() {
  const [currentScreen, setCurrentScreen] = useRoute();
  const [isAiTutorOpen, setIsAiTutorOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-x-hidden font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentScreen('dashboard')}>
              <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold sc-text text-xl">
                中
              </div>
              <span className="font-bold text-xl text-dark-green tracking-tight">ZhPath</span>
            </div>
            
            <div className="hidden md:flex space-x-1">
              <NavButton 
                icon={<Home size={18} />} 
                label="Главная" 
                active={currentScreen === 'dashboard'} 
                onClick={() => setCurrentScreen('dashboard')} 
              />
              <NavButton 
                icon={<BookOpen size={18} />} 
                label="Курсы" 
                active={currentScreen === 'catalog' || currentScreen === 'lesson'} 
                onClick={() => setCurrentScreen('catalog')} 
              />
              <NavButton 
                icon={<RefreshCw size={18} />} 
                label="Повторение" 
                active={currentScreen === 'reviews'} 
                onClick={() => setCurrentScreen('reviews')} 
              />
              <NavButton 
                icon={<User size={18} />} 
                label="Профиль" 
                active={currentScreen === 'profile'} 
                onClick={() => setCurrentScreen('profile')} 
              />
            </div>

            <div className="md:hidden flex items-center">
               <button 
                aria-label="Профиль"
                onClick={() => setCurrentScreen('profile')}
                className="p-2 text-foreground/70 hover:text-foreground hover:bg-secondary rounded-full transition-colors"
               >
                 <User size={20} />
               </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pt-6 sm:pt-10 transition-all duration-300">
        {currentScreen === 'dashboard' && <Dashboard onNavigate={setCurrentScreen} />}
        {currentScreen === 'catalog' && <Catalog onNavigate={setCurrentScreen} />}
        {currentScreen === 'lesson' && <Lesson onNavigate={setCurrentScreen} openAiTutor={() => setIsAiTutorOpen(true)} />}
        {currentScreen === 'profile' && <Profile />}
        {currentScreen === 'reviews' && <Reviews />}
        {currentScreen === 'not-found' && <NotFound />} 
      </main>

      {/* Floating AI Tutor Button (Hidden in lesson because lesson has it inline) */}
      {currentScreen !== 'lesson' && (
        <button 
          aria-label="Открыть ИИ-помощника"
          onClick={() => setIsAiTutorOpen(true)}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 bg-accent text-accent-foreground p-4 rounded-full shadow-sm hover:shadow-md transition-all hover:scale-105 focus:outline-none focus:ring-4 focus:ring-accent/30 z-40 group flex items-center justify-center"
        >
          <Sparkles size={24} className="group-hover:animate-pulse" />
        </button>
      )}

      {/* AI Tutor Sidebar */}
      {isAiTutorOpen && (
        <AiTutorPanel onClose={() => setIsAiTutorOpen(false)} />
      )}

      {/* Mobile Bottom Nav */}
      <div className="md:hidden sticky bottom-0 w-full bg-background border-t border-border flex justify-around p-3 z-30">
        <MobileNavButton label="Главная" icon={<Home size={24} />} active={currentScreen === 'dashboard'} onClick={() => setCurrentScreen('dashboard')} />
        <MobileNavButton label="Курсы" icon={<BookOpen size={24} />} active={currentScreen === 'catalog'} onClick={() => setCurrentScreen('catalog')} />
        <MobileNavButton label="Повторение" icon={<RefreshCw size={24} />} active={currentScreen === 'reviews'} onClick={() => setCurrentScreen('reviews')} />
      </div>
    </div>
  );
}
