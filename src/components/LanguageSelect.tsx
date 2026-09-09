import { useLanguage } from '../i18n/LanguageProvider';
import { isLanguage } from '../i18n/translate';
export default function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage();
  return <label className="block text-sm font-medium">{t('Язык интерфейса')}
    <select className="mt-2 w-full bg-white rounded-xl border p-3" value={language} onChange={e => { if (isLanguage(e.target.value)) setLanguage(e.target.value); }}>
      <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
    </select>
  </label>;
}
