import { useEffect, useState } from "react"
import { Flame, CheckCircle2, Circle } from "lucide-react"
import { getStats, type LearningStats as Stats } from "../api/stats"
import { useLanguage } from "../i18n/LanguageProvider"

const kindNames = {
  choice: "Выбор ответа",
  match: "Сопоставление пар",
  order: "Порядок слов",
  gap: "Заполнение пропуска",
  input: "Свободный ввод",
  dictation: "Диктант",
}

export default function LearningStats() {
  const { t, language } = useLanguage()
  const [data, setData] = useState<Stats | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let controller: AbortController | undefined
    const refresh = () => {
      controller?.abort()
      const current = new AbortController()
      controller = current
      getStats(current.signal)
        .then((value) => {
          if (!current.signal.aborted) {
            setData(value)
            setError(false)
          }
        })
        .catch(() => {
          if (!current.signal.aborted) setError(true)
        })
    }
    refresh()
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener("focus", refresh)
    return () => {
      controller?.abort()
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [attempt])

  if (error)
    return (
      <div role="alert" className="rounded-2xl border border-border p-6">
        <p>{t("Не удалось загрузить статистику.")}</p>
        <button
          onClick={() => {
            setError(false)
            setData(null)
            setAttempt((value) => value + 1)
          }}
          className="underline py-2"
        >
          {t("Повторить")}
        </button>
      </div>
    )
  if (!data) return <p role="status">{t("Загрузка статистики…")}</p>

  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(language, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`))
  return (
    <div className="space-y-6">
      <section
        className="bg-card border border-border rounded-2xl p-6 space-y-4"
        aria-labelledby="study-streak-title"
      >
        <h2
          id="study-streak-title"
          className="text-xl font-semibold flex items-center gap-2"
        >
          <Flame aria-hidden="true" className="text-primary" />
          {t("Серия учебных дней")}
        </h2>
        <p>
          {t("Дней подряд")}: <strong className="text-3xl">{data.streak}</strong>
        </p>
        <p>
          {t(
            data.activeToday
              ? "Сегодня занятие засчитано."
              : "Пройдите блок, отправьте тест или повторите карточку сегодня.",
          )}
        </p>
        <ul className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {data.week.map((day) => (
            <li
              key={day.date}
              className="rounded-xl bg-secondary p-2 text-center text-sm"
            >
              {day.active ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mx-auto mb-2 text-primary"
                />
              ) : (
                <Circle
                  aria-hidden="true"
                  className="mx-auto mb-2 text-foreground/40"
                />
              )}
              <time dateTime={day.date}>{dateLabel(day.date)}</time>
              <span className="sr-only">
                {" "}
                · {t(day.active ? "Было занятие" : "Без занятия")}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-foreground/65">
          {t("Часовой пояс")}: {data.timezone}.{" "}
          {t("Серия сохраняется до конца дня, если вы занимались вчера.")}
        </p>
        <p className="text-sm text-foreground/65">
          {t(
            "Ранние занятия могут учитываться не полностью: раньше сохранялось только последнее прохождение блока.",
          )}
        </p>
      </section>
      <section
        className="bg-card border border-border rounded-2xl p-6 space-y-4"
        aria-labelledby="weak-areas-title"
      >
        <h2 id="weak-areas-title" className="text-xl font-semibold">
          {t("Трудности по типам заданий")}
        </h2>
        <p className="text-sm text-foreground/65">
          {t(
            "Последняя попытка каждого актуального опубликованного теста за 30 дней. Пересдача заменяет прежний результат.",
          )}
        </p>
        {!data.assessedQuestions ? (
          <p>{t("Пока недостаточно данных. Пройдите тест урока.")}</p>
        ) : (
          <>
            <p>
              {t("Учтено ответов")}: {data.assessedQuestions}
            </p>
            {data.weakAreas.length === 0 ? (
              <p>{t("В учтённых попытках ошибок нет.")}</p>
            ) : (
              <ul className="space-y-3">
                {data.weakAreas.map((area) => (
                  <li
                    key={area.kind}
                    className="flex flex-wrap justify-between gap-2 border-b border-border pb-3"
                  >
                    <span className="font-medium">
                      {t(kindNames[area.kind])}
                    </span>
                    <span>
                      {t("Ошибок")}: {area.incorrect} / {area.total} (
                      {Math.round((area.incorrect / area.total) * 100)}%)
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-foreground/65">
              {t(
                "Повторите задания с ошибками в уроке. Это ориентир для практики, а не оценка уровня HSK.",
              )}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
