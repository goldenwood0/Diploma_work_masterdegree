import { useLanguage } from '../i18n/LanguageProvider';
export default function Reviews() {
  const { t } = useLanguage();
  return (
    <section className="max-w-3xl mx-auto rounded-3xl bg-white border border-border p-8 space-y-4">
      <h1 className="text-3xl font-bold text-dark-green">{t("Повторение")}</h1>
      <p className="text-muted-foreground">{t("Здесь будут слова из пройденных уроков и ваши карточки для ежедневной практики. Повторение пока недоступно.")}</p>
      <a className="inline-block text-primary font-bold hover:underline" href="#/courses">{t("Перейти к курсам")}</a>
    </section>
  );
}
