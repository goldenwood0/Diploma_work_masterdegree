import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isLanguage, translate, type Language } from './translate';
const Context = createContext({ language: 'ru' as Language, explanationLanguage: 'ru' as Language,
  setLanguage: (_language: Language) => {}, setExplanationLanguage: (_language: Language) => {} });
function initialLanguage(): Language {
  try { const value = localStorage.getItem('zhpath-language'); if (isLanguage(value)) return value; } catch { /* Storage may be disabled. */ }
  const locale = navigator.language.split('-')[0];
  return isLanguage(locale) ? locale : 'ru';
}
export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [explanationLanguage, setExplanationLanguage] = useState<Language>(language);
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('zhpath-language', language); } catch { /* UI still works without storage. */ }
  }, [language]);
  return <Context.Provider value={{ language, setLanguage, explanationLanguage, setExplanationLanguage }}>{children}</Context.Provider>;
}
export function useLanguage() {
  const state = useContext(Context);
  return { ...state, t: (key: string) => translate(key, state.language), explain: (key: string) => translate(key, state.explanationLanguage) };
}
