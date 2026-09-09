import { Play, Lock, ChevronRight } from 'lucide-react';
import type { Screen } from '../app/routes';

export default function Catalog({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-dark-green">Каталог курсов</h1>
        <p className="text-muted-foreground mt-2 font-medium">Ваш путь от новичка до свободного владения.</p>
      </header>

      <div className="relative pl-6 sm:pl-10 space-y-8">
        {/* Vertical Line */}
        <div className="absolute top-4 bottom-4 left-7 sm:left-11 w-0.5 bg-border -z-10"></div>

        {/* HSK 1 - Active */}
        <div className="relative">
          <div className="absolute -left-6 sm:-left-10 bg-primary text-primary-foreground size-8 rounded-full flex items-center justify-center font-bold text-sm ring-4 ring-background">
            1
          </div>
          <div className="bg-white rounded-3xl p-6 border-2 border-primary/20 shadow-sm transition-all hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-primary font-bold text-sm tracking-wider uppercase">В процессе</span>
                <h3 className="text-2xl font-bold mt-1 text-dark-green">HSK 1: Базовый</h3>
              </div>
              <span className="bg-secondary text-primary px-3 py-1 text-xs font-bold rounded-lg">150 слов</span>
            </div>
            <p className="text-muted-foreground mb-6">Основы фонетики (пиньинь), простая грамматика и самые необходимые фразы для выживания.</p>
            
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-dark-green uppercase tracking-wider mb-2">Раздел 1: Первые фразы</h4>
              <div 
                onClick={() => onNavigate('lesson')}
                className="group flex items-center justify-between p-4 bg-sage rounded-2xl cursor-pointer hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-primary">
                    <Play size={16} fill="currentColor" />
                  </div>
                  <div>
                    <h5 className="font-bold text-dark-green group-hover:text-primary transition-colors">你好 — первое приветствие</h5>
                    <p className="text-xs text-muted-foreground mt-0.5">12 мин • Урок 1</p>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-2xl opacity-70">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-background flex items-center justify-center border border-border text-muted-foreground">
                    <Lock size={16} />
                  </div>
                  <div>
                    <h5 className="font-bold text-muted-foreground">Меня зовут...</h5>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">15 мин • Урок 2</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HSK 2 - Locked */}
        <div className="relative opacity-60 hover:opacity-100 transition-opacity">
          <div className="absolute -left-6 sm:-left-10 bg-secondary text-muted-foreground size-8 rounded-full flex items-center justify-center font-bold text-sm ring-4 ring-background border border-border">
            2
          </div>
          <div className="bg-white rounded-3xl p-6 border border-border shadow-sm">
             <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm tracking-wider uppercase">
                  <Lock size={14} /> Заблокировано
                </div>
                <h3 className="text-2xl font-bold mt-1 text-dark-green">HSK 2: Элементарный</h3>
              </div>
              <span className="bg-secondary text-muted-foreground px-3 py-1 text-xs font-bold rounded-lg">+150 слов</span>
            </div>
            <p className="text-muted-foreground">Продолжение базового уровня. Больше тем для общения на повседневные темы.</p>
          </div>
        </div>
        
        {/* HSK 3 - Locked */}
        <div className="relative opacity-50">
          <div className="absolute -left-6 sm:-left-10 bg-secondary text-muted-foreground size-8 rounded-full flex items-center justify-center font-bold text-sm ring-4 ring-background border border-border">
            3
          </div>
          <div className="bg-white rounded-3xl p-6 border border-border shadow-sm flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-dark-green">HSK 3: Средний</h3>
              <p className="text-sm text-muted-foreground mt-1">+300 слов</p>
            </div>
            <Lock className="text-muted-foreground" size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}
