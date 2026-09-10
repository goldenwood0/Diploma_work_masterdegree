import { BookOpen, CheckCircle2, Lock } from "lucide-react"
import { useLanguage } from "../i18n/LanguageProvider"
import useCatalog from "../app/useCatalog"
import type { Screen } from "../app/routes"

export default function Catalog({
  onNavigate,
}: {
  onNavigate: (screen: Screen, slug?: string) => void
}) {
  const { t, language } = useLanguage()
  const { data, error, retry } = useCatalog()
  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-dark-green">{t("Курсы")}</h1>
      <p className="text-foreground/65">
        {t("Пилотный модуль HSK 1. Материалы проходят методическую проверку.")}
      </p>
      {error ? (
        <div role="alert">
          <p>{t("Не удалось загрузить учебные данные.")}</p>
          <button className="underline" onClick={retry}>
            {t("Повторить")}
          </button>
        </div>
      ) : !data ? (
        <p role="status">{t("Загрузка…")}</p>
      ) : data.curricula.length === 0 ? (
        <p>{t("Материалы готовятся.")}</p>
      ) : (
        data.curricula.map((curriculum) => (
          <div key={curriculum.id} className="space-y-5">
            <h2 className="text-xl font-semibold">
              {curriculum.title[language]}
            </h2>
            {curriculum.levels.map((level) => (
              <section
                key={level.id}
                className="bg-card rounded-2xl border border-border p-5 sm:p-7 space-y-4"
              >
                <h3 className="text-2xl font-bold">HSK {level.number}</h3>
                {!level.units.some((unit) => unit.lessons.length > 0) && (
                  <p className="text-foreground/60">
                    {t("Материалы готовятся.")}
                  </p>
                )}
                {level.units.map((unit) => (
                  <div key={unit.id} className="space-y-3">
                    <h4 className="font-semibold">{unit.title[language]}</h4>
                    {unit.lessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        disabled={lesson.locked}
                        onClick={() => onNavigate("lesson", lesson.slug)}
                        className="w-full flex items-center gap-4 text-left rounded-xl border border-border p-4 hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {lesson.locked ? (
                          <Lock size={22} className="shrink-0" />
                        ) : lesson.progress.completedAt ? (
                          <CheckCircle2
                            size={22}
                            className="text-primary shrink-0"
                          />
                        ) : (
                          <BookOpen
                            size={22}
                            className="text-primary shrink-0"
                          />
                        )}
                        <span className="flex-1">
                          <span className="block font-semibold">
                            {lesson.title[language]}
                          </span>
                          <span className="text-sm text-foreground/65">
                            {lesson.minutes} {t("мин")} ·{" "}
                            {lesson.progress.nextBlock}/{lesson.blockCount}{" "}
                            {t("блоков")}
                          </span>
                          <span className="block text-sm">
                            {t(
                              lesson.locked
                                ? "Сначала завершите предыдущий урок."
                                : lesson.progress.completedAt
                                  ? "Завершено"
                                  : lesson.progress.nextBlock
                                    ? "Продолжить"
                                    : "Начать урок",
                            )}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        ))
      )}
    </section>
  )
}
