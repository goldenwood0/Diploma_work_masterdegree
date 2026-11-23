import { Check, ChevronDown, Lock, Search, SlidersHorizontal, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { useLanguage } from "../i18n/LanguageProvider"
import useCatalog from "../app/useCatalog"
import type { Screen } from "../app/routes"
import type { CatalogData } from "../api/learning"

type Lesson = CatalogData["curricula"][number]["levels"][number]["units"][number]["lessons"][number]
type Status = "all" | "available" | "completed"
type Sort = "course" | "available"

const hashParams = () =>
  new URLSearchParams(window.location.hash.split("?")[1] ?? "")
const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ")
const isOpen = (lesson: Lesson) => !lesson.locked && !lesson.progress.completedAt
const MOBILE_PAGE = 4

// Catalog per ПР6: desktop (≥1200) has a 282 px filter sidebar and 3 cards per row,
// tablet has a "Filters · N" button and 2 per row, phone starts with "Continue learning".
export default function Catalog({
  onNavigate,
}: {
  onNavigate: (screen: Screen, slug?: string) => void
}) {
  const { t, language } = useLanguage()
  const { data, error, retry } = useCatalog()
  const [query, setQuery] = useState(() => hashParams().get("q") ?? "")
  const [levels, setLevels] = useState<number[]>([])
  const [status, setStatus] = useState<Status>("all")
  const [sort, setSort] = useState<Sort>("course")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const asideSearch = useRef<HTMLInputElement>(null)
  const sheetSearch = useRef<HTMLInputElement>(null)

  // The header search and the phone search icon navigate here with ?q= or ?focus=search.
  useEffect(() => {
    const apply = () => {
      const params = hashParams()
      if (params.has("q")) setQuery(params.get("q") ?? "")
      if (params.get("focus") === "search") {
        if (window.matchMedia("(width >= 75rem)").matches) asideSearch.current?.focus()
        else setSheetOpen(true)
        params.delete("focus")
        const rest = params.toString()
        window.history.replaceState(null, "", `#/courses${rest ? `?${rest}` : ""}`)
      }
    }
    apply()
    window.addEventListener("hashchange", apply)
    return () => window.removeEventListener("hashchange", apply)
  }, [])

  const all = useMemo(
    () =>
      data?.curricula.flatMap((curriculum) =>
        curriculum.levels.flatMap((level) =>
          level.units.flatMap((unit) =>
            unit.lessons.map((lesson) => ({ curriculum, level, unit, lesson })),
          ),
        ),
      ) ?? [],
    [data],
  )
  const levelNumbers = [...new Set(data?.curricula.flatMap((c) => c.levels.map((l) => l.number)) ?? [])].sort((a, b) => a - b)
  const emptyLevels = levelNumbers.filter((n) => !all.some((item) => item.level.number === n))
  const completed = all.filter((item) => item.lesson.progress.completedAt).length
  const next = all.find((item) => isOpen(item.lesson))?.lesson

  const terms = normalize(query).split(" ").filter(Boolean)
  const filterCount = levels.length + (status !== "all" ? 1 : 0) + (terms.length ? 1 : 0)
  const matches = all.filter(({ curriculum, level, unit, lesson }) => {
    const text = normalize(
      [`HSK ${level.number}`, ...Object.values(curriculum.title), ...Object.values(unit.title), ...Object.values(lesson.title), lesson.searchText].join(" "),
    )
    return (
      terms.every((term) => text.includes(term)) &&
      (levels.length === 0 || levels.includes(level.number)) &&
      (status === "all" ||
        (status === "available" && isOpen(lesson)) ||
        (status === "completed" && !!lesson.progress.completedAt))
    )
  })
  const rank = (lesson: Lesson) => (isOpen(lesson) ? 0 : lesson.progress.completedAt ? 1 : 2)
  const groups = [...new Set(matches.map((item) => item.unit))].map((unit) => {
    const items = matches.filter((item) => item.unit === unit)
    return {
      unit,
      level: items[0].level,
      items: sort === "available" ? [...items].sort((a, b) => rank(a.lesson) - rank(b.lesson)) : items,
    }
  })
  const reset = () => {
    setQuery("")
    setLevels([])
    setStatus("all")
  }

  const fields = (prefix: string, searchRef: RefObject<HTMLInputElement | null>) => (
    <FilterFields
      prefix={prefix}
      searchRef={searchRef}
      query={query}
      onQuery={setQuery}
      levelNumbers={levelNumbers}
      levels={levels}
      onLevels={setLevels}
      status={status}
      onStatus={setStatus}
    />
  )
  const lessonNumber = (lesson: Lesson) => all.findIndex((item) => item.lesson.id === lesson.id) + 1
  let shown = 0

  return (
    <section className="space-y-6 tablet:space-y-8">
      <div className="space-y-2">
        <nav aria-label={t("Навигационная цепочка")} className="hidden text-sm uppercase tracking-wide text-muted-foreground tablet:block">
          <button type="button" className="uppercase hover:underline" onClick={() => onNavigate("dashboard")}>{t("Главная")}</button>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{t("Курсы")}</span>
        </nav>
        <h1 className="text-3xl font-bold text-dark-green tablet:text-4xl">{t("Курсы")}</h1>
        <p className="text-muted-foreground tablet:text-lg">
          {t("Пилотный модуль HSK 1. Материалы проходят методическую проверку.")}
        </p>
      </div>

      {error ? (
        <div role="alert" className="space-y-2">
          <p>{t("Не удалось загрузить учебные данные.")}</p>
          <button className="min-h-11 underline" onClick={retry}>{t("Повторить")}</button>
        </div>
      ) : !data ? (
        <p role="status">{t("Загрузка…")}</p>
      ) : all.length === 0 ? (
        <p>{t("Материалы готовятся.")}</p>
      ) : (
        <div className="grid gap-6 desktop:grid-cols-[282px_minmax(0,1fr)]">
          <aside className="hidden space-y-6 desktop:block">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-xl font-bold text-dark-green">{t("Фильтры")}</h2>
              {fields("aside", asideSearch)}
              {filterCount > 0 && (
                <button type="button" onClick={reset} className="mt-6 min-h-11 w-full rounded-xl font-bold text-dark-green hover:bg-secondary">
                  {t("Сбросить")}
                </button>
              )}
            </div>
            <div className="space-y-3 rounded-2xl bg-secondary p-6">
              <p className="font-bold text-dark-green">{t("Ваш прогресс")}</p>
              <p className="text-3xl font-bold text-dark-green">{completed} / {all.length}</p>
              <p>{t("уроков пройдено")}</p>
              <Segments done={completed} total={all.length} />
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            {next && (
              <div className="space-y-3 rounded-2xl bg-primary p-5 text-primary-foreground tablet:hidden">
                <p className="text-sm font-bold uppercase tracking-wide text-accent">{t("Продолжить обучение")}</p>
                <p className="text-2xl font-bold">{next.title[language]}</p>
                <p>HSK {all.find((item) => item.lesson === next)?.level.number} · {next.minutes} {t("мин")} · {next.progress.nextBlock}/{next.blockCount} {t("блоков")}</p>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{t("Пройдено уроков")}: {completed} / {all.length}</span>
                  <Segments done={completed} total={all.length} light />
                </div>
                <button type="button" onClick={() => onNavigate("lesson", next.slug)} className="min-h-14 w-full rounded-xl bg-card text-lg font-bold text-dark-green">
                  {t(next.progress.nextBlock ? "Продолжить" : "Начать урок")}
                </button>
              </div>
            )}

            <div className="hidden items-center gap-4 rounded-2xl bg-secondary px-5 py-4 tablet:flex desktop:hidden">
              <span className="shrink-0 font-bold text-dark-green">{t("Пройдено уроков")}: {completed} / {all.length}</span>
              <Segments done={completed} total={all.length} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setSheetOpen(true)} aria-haspopup="dialog"
                className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 font-bold text-dark-green desktop:hidden">
                <SlidersHorizontal size={20} aria-hidden="true" />
                {t("Фильтры")}{filterCount > 0 && ` · ${filterCount}`}
              </button>
              <div className="contents desktop:hidden">
                {levels.map((n) => (
                  <Chip key={n} label={`HSK ${n}`} onRemove={() => setLevels(levels.filter((l) => l !== n))} />
                ))}
                {status !== "all" && <Chip label={t(status === "available" ? "Доступные" : "Пройденные")} onRemove={() => setStatus("all")} />}
                {terms.length > 0 && <Chip label={`«${query.trim()}»`} onRemove={() => setQuery("")} />}
              </div>
              <label className="ml-auto hidden tablet:block">
                <span className="sr-only">{t("Сортировка")}</span>
                <span className="relative block">
                  <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}
                    className="min-h-12 appearance-none rounded-xl border border-border bg-card py-2 pl-4 pr-10">
                    <option value="course">{t("По порядку")}</option>
                    <option value="available">{t("Сначала доступные")}</option>
                  </select>
                  <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </span>
              </label>
            </div>

            <p role="status" className={filterCount ? "font-semibold" : "sr-only"}>
              {t("Найдено уроков")}: {matches.length}
            </p>

            {groups.length === 0 ? (
              <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
                <p>{t("Уроки не найдены. Измените запрос или сбросьте фильтры.")}</p>
                <button type="button" onClick={reset} className="min-h-11 rounded-xl border border-border px-4 font-bold">{t("Сбросить фильтры")}</button>
              </div>
            ) : (
              groups.map(({ unit, level, items }) => (
                <section key={unit.id} className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-dark-green tablet:text-3xl">HSK {level.number} · {unit.title[language]}</h2>
                    <p className="text-muted-foreground">{t("Уроков")}: {items.length}</p>
                  </div>
                  <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-2 tablet:gap-5 desktop:grid-cols-3 desktop:gap-6">
                    {items.map(({ lesson }) => {
                      shown += 1
                      const hiddenOnPhone = !showAll && shown > MOBILE_PAGE
                      return (
                        <li key={lesson.id} className={hiddenOnPhone ? "hidden tablet:block" : undefined}>
                          <LessonCard lesson={lesson} level={level.number} number={lessonNumber(lesson)} isNext={lesson === next}
                            onOpen={() => onNavigate("lesson", lesson.slug)} />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            )}

            {!showAll && matches.length > MOBILE_PAGE && (
              <button type="button" onClick={() => setShowAll(true)} className="min-h-14 w-full rounded-xl border border-border bg-card text-lg font-bold text-dark-green tablet:hidden">
                {t("Показать ещё")} · {matches.length - MOBILE_PAGE}
              </button>
            )}

            {emptyLevels.length > 0 && filterCount === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-5 text-muted-foreground">
                {emptyLevels.map((n) => `HSK ${n}`).join(" · ")} — {t("Материалы готовятся.")}
              </p>
            )}
          </div>
        </div>
      )}

      {sheetOpen && (
        <FilterSheet count={matches.length} onClose={() => setSheetOpen(false)} onReset={reset} searchRef={sheetSearch}>
          {fields("sheet", sheetSearch)}
        </FilterSheet>
      )}
    </section>
  )
}

function Segments({ done, total, light = false }: { done: number; total: number; light?: boolean }) {
  return (
    <span aria-hidden="true" className="flex min-w-0 flex-1 gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-2 min-w-2 flex-1 rounded-full ${i < done ? (light ? "bg-accent" : "bg-primary") : light ? "bg-primary-foreground/30" : "bg-card"}`} />
      ))}
    </span>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useLanguage()
  return (
    <button type="button" onClick={onRemove} aria-label={`${t("Убрать фильтр")}: ${label}`}
      className="flex min-h-12 items-center gap-2 rounded-full bg-secondary px-4 font-bold text-dark-green">
      {label}<X size={18} aria-hidden="true" />
    </button>
  )
}

function LessonCard({ lesson, level, number, isNext, onOpen }: {
  lesson: Lesson
  level: number
  number: number
  isNext: boolean
  onOpen: () => void
}) {
  const { t, language } = useLanguage()
  const done = !!lesson.progress.completedAt
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 tablet:p-6">
      <div aria-hidden="true" className={`hidden h-24 items-center justify-center rounded-xl text-2xl font-bold tablet:flex ${lesson.locked ? "bg-background text-muted-foreground" : "bg-secondary text-dark-green"}`}>
        {lesson.locked ? <Lock size={28} /> : `${t("Урок")} ${number}`}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-secondary px-3 py-1 text-sm font-bold text-dark-green">HSK {level}</span>
        {done ? (
          <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground"><Check size={16} aria-hidden="true" />{t("Пройден")}</span>
        ) : lesson.locked ? (
          <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground"><Lock size={16} aria-hidden="true" />{t("Закрыт")}</span>
        ) : (
          <span className="rounded-lg bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">{t(lesson.progress.nextBlock ? "В процессе" : "Новое")}</span>
        )}
      </div>
      <h3 className="text-xl font-bold text-dark-green">{lesson.title[language]}</h3>
      {lesson.locked && <p className="text-sm text-muted-foreground">{t("Сначала завершите предыдущий урок.")}</p>}
      <p className="text-muted-foreground">{lesson.minutes} {t("мин")} · {lesson.progress.nextBlock}/{lesson.blockCount} {t("блоков")}</p>
      <div className="mt-auto pt-2">
        {lesson.locked ? (
          <button type="button" disabled className="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-secondary font-bold text-muted-foreground">
            <Lock size={18} aria-hidden="true" />{t("Урок закрыт")}
          </button>
        ) : (
          <button type="button" onClick={onOpen}
            className={`min-h-12 w-full rounded-xl font-bold transition-colors ${isNext ? "bg-primary text-primary-foreground hover:bg-dark-green" : "border border-border text-dark-green hover:bg-secondary"}`}>
            {t(done ? "Повторить" : lesson.progress.nextBlock ? "Продолжить" : "Начать урок")}
          </button>
        )}
      </div>
    </article>
  )
}

function FilterFields({ prefix, searchRef, query, onQuery, levelNumbers, levels, onLevels, status, onStatus }: {
  prefix: string
  searchRef: RefObject<HTMLInputElement | null>
  query: string
  onQuery: (value: string) => void
  levelNumbers: number[]
  levels: number[]
  onLevels: (value: number[]) => void
  status: Status
  onStatus: (value: Status) => void
}) {
  const { t } = useLanguage()
  const option = "flex min-h-11 cursor-pointer items-center gap-3"
  const control = "size-5 shrink-0 accent-[var(--color-primary)]"
  return (
    <div className="space-y-6">
      <label className="block space-y-2">
        <span className="font-bold text-dark-green">{t("Поиск по названию")}</span>
        <span className="search-field flex min-h-12 items-center gap-2 rounded-xl border border-border px-3 focus-within:border-primary">
          <Search size={20} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <input ref={searchRef} type="search" value={query} maxLength={200} onChange={(event) => onQuery(event.target.value)}
            placeholder={t("Название, слово или пиньинь")} aria-describedby={`${prefix}-search-hint`}
            className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-muted-foreground" />
        </span>
        <span id={`${prefix}-search-hint`} className="block text-sm text-muted-foreground">{t("Пиньинь можно вводить без тонов.")}</span>
      </label>
      <fieldset className="space-y-1">
        <legend className="mb-2 font-bold text-dark-green">{t("Уровень")}</legend>
        {levelNumbers.map((n) => (
          <label key={n} className={option}>
            <input type="checkbox" className={control} checked={levels.includes(n)}
              onChange={(event) => onLevels(event.target.checked ? [...levels, n].sort((a, b) => a - b) : levels.filter((l) => l !== n))} />
            HSK {n}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="mb-2 font-bold text-dark-green">{t("Статус")}</legend>
        {([["all", "Все"], ["available", "Доступные"], ["completed", "Пройденные"]] as const).map(([value, label]) => (
          <label key={value} className={option}>
            <input type="radio" name={`${prefix}-status`} className={control} checked={status === value} onChange={() => onStatus(value)} />
            {t(label)}
          </label>
        ))}
      </fieldset>
    </div>
  )
}

function FilterSheet({ count, onClose, onReset, searchRef, children }: {
  count: number
  onClose: () => void
  onReset: () => void
  searchRef: RefObject<HTMLInputElement | null>
  children: ReactNode
}) {
  const { t } = useLanguage()
  const opener = useRef<Element | null>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    opener.current = document.activeElement
    searchRef.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close.current() }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener("keydown", onKey)
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
    // Runs once per opening; the latest onClose is read through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-dark-green/40 desktop:hidden" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="filters-title" onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full flex-col bg-card tablet:max-w-md">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 tablet:px-6">
          <h2 id="filters-title" className="text-2xl font-bold text-dark-green">{t("Фильтры")}</h2>
          <button type="button" onClick={onClose} aria-label={t("Закрыть")} className="flex size-11 items-center justify-center rounded-full hover:bg-secondary">
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 tablet:px-6">{children}</div>
        <div className="space-y-2 border-t border-border px-4 py-4 tablet:px-6">
          <button type="button" onClick={onClose} className="min-h-14 w-full rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            {t("Показать уроков")}: {count}
          </button>
          <button type="button" onClick={onReset} className="min-h-11 w-full rounded-xl font-bold text-dark-green hover:bg-secondary">{t("Сбросить")}</button>
        </div>
      </div>
    </div>
  )
}
