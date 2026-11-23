import levels from '../api/hsk2015.json';
import { useLanguage } from '../i18n/LanguageProvider';
export function hskLevel(word: string): number | undefined {
  return (levels as Record<string, number>)[word.trim()];
}
export default function HskBadge({ word }: { word: string }) {
  const { t } = useLanguage();
  const level = hskLevel(word);
  return <span className="inline-block rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium">{level ? `HSK ${level} · 2015` : t('HSK не указан')}</span>;
}
