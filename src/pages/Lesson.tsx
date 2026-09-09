import { useLanguage } from '../i18n/LanguageProvider';
import { BookOpen, User, Volume2, Sparkles, ChevronLeft } from 'lucide-react';
import type { Screen } from '../app/routes';
import WordCard from '../components/WordCard';

export default function Lesson({ onNavigate, openAiTutor }: { onNavigate: (screen: Screen) => void, openAiTutor: () => void }) {
  const { t, explain } = useLanguage();
  return (
    <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500 pb-24">
      {/* Lesson Header */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => onNavigate('catalog')}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
        >
          <ChevronLeft size={20} />
          <span>{t("Назад")}</span>
        </button>
        <div className="flex items-center gap-4">
           <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest hidden sm:inline-block">HSK 1</span>
           <div className="w-32 sm:w-48 bg-secondary h-2.5 rounded-full overflow-hidden">
             <div className="bg-accent h-full w-1/3 rounded-full"></div>
           </div>
           <span className="text-sm font-bold text-dark-green">1/3</span>
        </div>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-dark-green mb-3">{t("你好 — первое приветствие")}</h1>
        <p className="text-muted-foreground">{explain("Цель: научиться здороваться и называть себя.")}</p>
      </div>

      <div className="space-y-8">
        {/* Flashcards */}
        <section>
          <h2 className="text-lg font-bold text-dark-green mb-4 flex items-center gap-2"> {t("Новые слова")} </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <WordCard hz="你" py="nǐ" ru="ты" />
            <WordCard hz="好" py="hǎo" ru="хорошо, хороший" />
            <WordCard hz="我" py="wǒ" ru="я" />
            <WordCard hz="叫" py="jiào" ru="звать, называться" />
          </div>
        </section>

        {/* Grammar highlight */}
        <section className="bg-sage/50 border border-border rounded-3xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
             <div className="bg-white p-3 rounded-2xl shadow-sm text-primary shrink-0">
               <BookOpen size={24} />
             </div>
             <div>
               <h3 className="text-xl font-bold text-dark-green mb-2">{t("Грамматика: Приветствие")}</h3>
               <p className="text-foreground/80 leading-relaxed"> {explain("В китайском языке самое распространенное приветствие")} <strong>你好 (nǐ hǎo)</strong> {explain("буквально переводится как «ты хороший». Когда два третьих тона (nǐ и hǎo) идут подряд, первый слог читается вторым тоном.")} </p>
             </div>
          </div>
        </section>

        {/* Mini Dialogue */}
        <section>
          <h2 className="text-lg font-bold text-dark-green mb-4">{t("Диалог")}</h2>
          <div className="bg-white border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            
            {/* Message 1 */}
            <div className="flex gap-4 max-w-2xl">
              <div className="size-10 sm:size-12 rounded-full bg-secondary shrink-0 overflow-hidden flex items-center justify-center">
                <User size={24} className="text-muted-foreground" />
              </div>
              <div className="bg-secondary rounded-2xl rounded-tl-sm p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="sc-text text-2xl sm:text-3xl font-bold">你好！</div>
                  <button className="text-primary hover:bg-white p-2 rounded-full transition-colors shrink-0">
                    <Volume2 size={20} />
                  </button>
                </div>
                <div className="text-primary font-medium mb-1 tracking-wide text-sm sm:text-base">Nǐ hǎo!</div>
                <div className="text-foreground/80 text-sm sm:text-base">{explain("Привет!")}</div>
              </div>
            </div>

            {/* Message 2 */}
            <div className="flex gap-4 max-w-2xl ml-auto flex-row-reverse">
              <div className="size-10 sm:size-12 rounded-full bg-primary/20 shrink-0 overflow-hidden flex items-center justify-center">
                <User size={24} className="text-primary" />
              </div>
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4 mb-2 flex-row-reverse">
                  <div className="sc-text text-2xl sm:text-3xl font-bold">你好！我叫 Айдана。</div>
                  <button className="text-white hover:bg-white/20 p-2 rounded-full transition-colors shrink-0">
                    <Volume2 size={20} />
                  </button>
                </div>
                <div className="text-primary-foreground/80 font-medium mb-1 tracking-wide text-sm sm:text-base text-right">Nǐ hǎo! Wǒ jiào Aidana.</div>
                <div className="text-primary-foreground/90 text-sm sm:text-base text-right">{explain("Привет! Меня зовут Айдана.")}</div>
              </div>
            </div>

          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border p-4 z-20 flex justify-center gap-4">
        <button 
          onClick={openAiTutor}
          className="px-6 py-4 rounded-2xl font-bold transition-all shadow-sm flex items-center gap-2 bg-white border border-border text-foreground hover:bg-secondary active:scale-95"
        >
          <Sparkles size={20} className="text-accent-foreground" />
          <span className="hidden sm:inline">{t("Спросить AI")}</span>
        </button>
        <button 
          onClick={() => onNavigate('catalog')}
          className="w-full max-w-sm bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-sm active:scale-95"
        > {t("Завершить урок")} </button>
      </div>
    </div>
  );
}
