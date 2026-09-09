import { RefreshCw, Play, CheckCircle2, ChevronRight } from 'lucide-react';
import type { Screen } from '../app/routes';

export default function Dashboard({ onNavigate, name }: { onNavigate: (screen: Screen) => void; name: string }) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-dark-green">你好, {name}!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Учебные показатели и материалы ниже пока демонстрационные.</p>
        <p className="text-muted-foreground mt-2 font-medium">Отличный день для новых иероглифов.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Action Card */}
        <div className="md:col-span-2 bg-sage rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border border-border/50">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">HSK 1</span>
              <span className="text-muted-foreground text-sm font-medium">Урок 4</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">Приветствия и знакомство</h2>
            <p className="text-foreground/70 mb-4 max-w-sm">Продолжим изучать базовые фразы для первого разговора.</p>
            <button 
              onClick={() => onNavigate('lesson')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-2xl font-semibold flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
            >
              <Play size={18} fill="currentColor" />
              Продолжить урок
            </button>
          </div>
          
          {/* Progress Circular indicator mock */}
          <div className="relative size-32 shrink-0 flex items-center justify-center self-center sm:self-auto">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" className="stroke-background" strokeWidth="8" fill="none" />
              <circle cx="50" cy="50" r="40" className="stroke-accent" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - 0.61)} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-bold">61%</span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Курса</span>
            </div>
          </div>
        </div>

        {/* Stats & Daily Goal */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 border border-border flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Дневная цель</p>
              <p className="text-2xl font-bold text-dark-green"><span className="text-primary">12</span> / 20 мин</p>
            </div>
            <div className="size-12 rounded-full bg-sage flex items-center justify-center text-primary">
              <CheckCircle2 size={24} />
            </div>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-border flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Ударный режим (Streak)</p>
              <p className="text-2xl font-bold text-coral flex items-center gap-1">
                4 дня 
                <span className="text-xl">🔥</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Next Up / Spaced Repetition */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-dark-green">Повторение</h3>
        </div>
        <div className="bg-coral text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <RefreshCw size={120} />
          </div>
          <div className="relative z-10">
            <h4 className="text-xl font-bold mb-2">24 карточки ждут вас</h4>
            <p className="text-white/80 max-w-sm mb-4">Интервальное повторение — ключ к запоминанию иероглифов.</p>
            <button onClick={() => onNavigate('reviews')} className="bg-white text-coral hover:bg-white/90 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95">
              Начать повторение
            </button>
          </div>
        </div>
      </section>

      {/* Courses block */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-dark-green">Ваши курсы</h3>
          <button onClick={() => onNavigate('catalog')} className="text-primary font-medium hover:underline text-sm flex items-center">
            Все курсы <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="group cursor-pointer bg-white rounded-2xl p-4 sm:p-5 border border-border hover:border-primary/30 transition-all hover:shadow-sm">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-sage flex items-center justify-center font-bold text-xl text-primary">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-lg group-hover:text-primary transition-colors">HSK 1: Базовый</h4>
                <div className="w-full bg-secondary h-2 rounded-full mt-2 overflow-hidden">
                  <div className="bg-primary h-full w-[61%] rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
