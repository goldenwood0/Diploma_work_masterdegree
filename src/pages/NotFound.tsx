import { useLanguage } from '../i18n/LanguageProvider';
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <section className="max-w-3xl mx-auto rounded-3xl bg-white border border-border p-8 space-y-4">
      <h1 className="text-3xl font-bold text-dark-green">{t("Страница не найдена")}</h1>
      <p className="text-muted-foreground">{t("Проверьте адрес или вернитесь на главную.")}</p>
      <a className="inline-block text-primary font-bold hover:underline" href="#/">{t("На главную")}</a>
    </section>
  );
}
