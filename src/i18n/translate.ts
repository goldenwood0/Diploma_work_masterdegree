import { messages } from './messages';
export type Language = 'ru' | 'kk' | 'en';
export const isLanguage = (value: unknown): value is Language => value === 'ru' || value === 'kk' || value === 'en';
export function translate(key: string, language: Language): string {
  return language === 'ru' ? key : messages[key]?.[language]?.trim() || key;
}
