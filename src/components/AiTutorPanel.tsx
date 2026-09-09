import { useLanguage } from '../i18n/LanguageProvider';
import { Play, ChevronRight, Sparkles } from 'lucide-react';

export default function AiTutorPanel({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-dark-green/20 backdrop-blur-sm z-40 transition-opacity animate-in fade-in" 
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-background shadow-2xl z-50 border-l border-border flex flex-col animate-in slide-in-from-right duration-300">
        <header className="px-6 py-5 border-b border-border flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{t("Помощник ZhPath")}</h2>
              <p className="text-xs text-primary font-medium">{t("HSK 1 • В сети")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors">
            <ChevronRight size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex justify-center my-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-secondary px-3 py-1 rounded-full">{t("Сегодня")}</span>
          </div>

          {/* AI Message */}
          <div className="flex gap-3">
            <div className="size-8 rounded-full bg-accent shrink-0 flex items-center justify-center">
              <Sparkles size={14} className="text-accent-foreground" />
            </div>
            <div className="bg-white border border-border rounded-2xl rounded-tl-sm p-4 shadow-sm text-sm">
              <p className="mb-2">{t("你好 (Nǐ hǎo)! Я твой AI-наставник.")}</p>
              <p>{t("Отлично справляешься с первым уроком. Помочь с грамматикой или попрактикуем диалог?")}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-white">
          <div className="flex flex-wrap gap-2 mb-4">
            <button className="text-xs font-medium bg-sage hover:bg-primary/10 text-dark-green px-3 py-2 rounded-xl transition-colors border border-border"> {t("Объясни правило")} </button>
            <button className="text-xs font-medium bg-sage hover:bg-primary/10 text-dark-green px-3 py-2 rounded-xl transition-colors border border-border"> {t("Проверь мою фразу")} </button>
            <button className="text-xs font-medium bg-sage hover:bg-primary/10 text-dark-green px-3 py-2 rounded-xl transition-colors border border-border"> {t("Начать диалог")} </button>
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder={t("Спроси о чем угодно...")} 
              className="w-full bg-secondary border border-border rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
               <Play size={14} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
