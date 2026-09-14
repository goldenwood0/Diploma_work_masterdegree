import { BookOpen, CheckCircle2, Lock } from "lucide-react"
import { useLanguage } from "../i18n/LanguageProvider"
import useCatalog from "../app/useCatalog"
import type { Screen } from "../app/routes"
import { useState } from "react"

export default function Catalog({
  onNavigate,
}: {
  onNavigate: (screen: Screen, slug?: string) => void
}) {
  const { t, language } = useLanguage()
  const { data, error, retry } = useCatalog()
  const [query, setQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState("")
  const [status, setStatus] = useState("all")
  const normalize = (value: string) =>
    value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ")
  const terms = normalize(query).split(" ").filter(Boolean)
  const filtering = terms.length > 0 || levelFilter !== "" || status !== "all"
  const curricula =
    data?.curricula
      .map((curriculum) => ({
        ...curriculum,
        levels: curriculum.levels
          .filter(
            (level) => !levelFilter || String(level.number) === levelFilter,
          )
          .map((level) => ({
            ...level,
            units: level.units
              .map((unit) => ({
                ...unit,
                lessons: unit.lessons.filter((lesson) => {
                  const text = normalize(
                    [
                      `HSK ${level.number}`,
                      ...Object.values(curriculum.title),
                      ...Object.values(unit.title),
                      ...Object.values(lesson.title),
                    ].join(" "),
                  )
                  return (
                    terms.every((term) => text.includes(term)) &&
                    (status === "all" ||
                      (status === "available" &&
                        !lesson.locked &&
                        !lesson.progress.completedAt) ||
                      (status === "completed" && !!lesson.progress.completedAt))
                  )
                }),
              }))
              .filter((unit) => !filtering || unit.lessons.length > 0),
          }))
          .filter((level) => !filtering || level.units.length > 0),
      }))
      .filter((curriculum) => !filtering || curriculum.levels.length > 0) ?? []
  const found = curricula.reduce(
    (sum, curriculum) =>
      sum +
      curriculum.levels.reduce(
        (count, level) =>
          count + level.units.reduce((n, unit) => n + unit.lessons.length, 0),
        0,
      ),
    0,
  )
  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-dark-green">{t("Курсы")}</h1>
      <p className="text-foreground/65">
        {t("Пилотный модуль HSK 1. Материалы проходят методическую проверку.")}
      </p>
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <label className="block space-y-2">
          <span className="font-semibold">{t("Поиск уроков")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={200}
            aria-describedby="catalog-search-hint"
            className="w-full min-w-0 rounded-xl border border-border p-3 focus-visible:outline-2 focus-visible:outline-primary"
          />
        </label>
        <p id="catalog-search-hint" className="text-sm text-foreground/65">
          {t(
            "По названиям уроков и разделов на русском, казахском и английском.",
          )}
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="space-y-2">
            <span className="block">{t("Уровень HSK")}</span>
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
              className="rounded-xl border border-border p-3"
            >
              <option value="">{t("Все уровни")}</option>
              {[
                ...new Set(
                  data?.curricula.flatMap((c) =>
                    c.levels.map((l) => l.number),
                  ) ?? [],
                ),
              ]
                .sort((a, b) => a - b)
                .map((number) => (
                  <option key={number} value={number}>
                    HSK {number}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="block">{t("Статус урока")}</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-border p-3"
            >
              <option value="all">{t("Все уроки")}</option>
              <option value="available">{t("Доступны для изучения")}</option>
              <option value="completed">{t("Завершено")}</option>
            </select>
          </label>
          {filtering && (
            <button
              onClick={() => {
                setQuery("")
                setLevelFilter("")
                setStatus("all")
              }}
              className="rounded-xl border border-border px-4 py-3"
            >
              {t("Сбросить фильтры")}
            </button>
          )}
        </div>
        {data && !error && filtering && (
          <p role="status">
            {t("Найдено уроков")}: {found}
          </p>
        )}
      </div>
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
      ) : curricula.length === 0 ? (
        <p>{t("Уроки не найдены. Измените запрос или сбросьте фильтры.")}</p>
      ) : (
        curricula.map((curriculum) => (
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
