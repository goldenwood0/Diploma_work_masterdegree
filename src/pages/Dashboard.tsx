import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react"
import type { Screen } from "../app/routes"
import useStudyDashboard from "../app/useStudyDashboard"
import studyRecommendation from "../app/studyRecommendation"
import { useLanguage } from "../i18n/LanguageProvider"
import LearningStats from "../components/LearningStats"

export default function Dashboard({
  name,
  onNavigate,
}: {
  name: string
  onNavigate: (screen: Screen, slug?: string) => void
}) {
  const { t, language } = useLanguage()
  const { data, error, retry } = useStudyDashboard()
  const lessons =
    data?.catalog.curricula.flatMap((c) =>
      c.levels.flatMap((l) => l.units.flatMap((u) => u.lessons)),
    ) ?? []
  const completed = lessons.filter((l) => l.progress.completedAt).length
  const action = studyRecommendation(
    lessons,
    data?.reviews.ready ?? 0,
    data?.stats.mistakeLessonIds ?? [],
  )
  const actionText = {
    reviews: t("Начните с повторения слов."),
    continue: t("Продолжите начатый урок."),
    mistakes: t("Вернитесь к уроку с ошибками в тесте."),
    start: t("Пора изучить новый урок."),
    complete: t("Все опубликованные уроки завершены."),
    catalog: t("Посмотрите доступные материалы в каталоге."),
  }
  return (
    <section className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-dark-green">
          {t("Здравствуйте")}, {name}!
        </h1>
        <p className="mt-3 text-foreground/65">
          {t("Продолжайте изучать китайский шаг за шагом.")}
        </p>
      </header>
      {error ? (
        <div role="alert">
          <p>{t("Не удалось загрузить учебные данные.")}</p>
          <button className="underline" onClick={retry}>
            {t("Повторить")}
          </button>
        </div>
      ) : !data ? (
        <p role="status">{t("Загрузка…")}</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-6">
              <BookOpen className="text-primary mb-3" />
              <p>{t("Опубликовано уроков")}</p>
              <strong className="text-3xl">{lessons.length}</strong>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6">
              <CheckCircle2 className="text-primary mb-3" />
              <p>{t("Завершено")}</p>
              <strong className="text-3xl">
                {completed} / {lessons.length}
              </strong>
            </div>
          </div>
          <section
            className="bg-card border border-border rounded-2xl p-6 space-y-4"
            aria-labelledby="review-summary-title"
          >
            <h2 id="review-summary-title" className="text-xl font-semibold">
              {t("Повторение слов")}
            </h2>
            <p>
              {t("Карточек доступно сейчас")}:{" "}
              <strong className="text-3xl">{data.reviews.ready}</strong>
            </p>
            <dl className="grid sm:grid-cols-3 gap-4">
              <div>
                <dt>{t("Повторных карточек")}</dt>
                <dd className="text-xl font-semibold">
                  {data.reviews.dueReviews}
                </dd>
              </div>
              <div>
                <dt>{t("Новых карточек")}</dt>
                <dd className="text-xl font-semibold">
                  {data.reviews.availableNew}
                </dd>
              </div>
              <div>
                <dt>{t("Ответов сегодня")}</dt>
                <dd className="text-xl font-semibold">
                  {data.reviews.reviewedToday}
                </dd>
              </div>
            </dl>
            <p className="text-sm text-foreground/65">
              {t("Осталось новых карточек по дневному лимиту")}:{" "}
              {data.reviews.remainingNew} / {data.reviews.newLimit}.{" "}
              {t("Часовой пояс")}: {data.reviews.timezone}
            </p>
            {data.reviews.deferredNew > 0 && (
              <p>
                {t("Новых карточек ждут следующего дня")}:{" "}
                {data.reviews.deferredNew}
              </p>
            )}
            {data.reviews.ready === 0 && (
              <p>
                {t(
                  data.reviews.totalCards === 0
                    ? "Завершите урок, чтобы добавить слова в повторение."
                    : "Сейчас нет карточек для повторения.",
                )}
              </p>
            )}
            {data.reviews.nextReviewAt && (
              <p>
                {t("Ближайшее повторение изученных карточек")}:{" "}
                <time dateTime={data.reviews.nextReviewAt}>
                  {new Intl.DateTimeFormat(language, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: data.reviews.timezone,
                  }).format(new Date(data.reviews.nextReviewAt))}
                </time>
              </p>
            )}
            <button
              className="underline py-2"
              onClick={() => onNavigate("reviews")}
            >
              {t("Открыть повторение")}
            </button>
          </section>
          <section
            className="bg-secondary rounded-2xl p-6 sm:p-8 space-y-4"
            aria-labelledby="next-action-title"
          >
            <h2 id="next-action-title" className="text-xl font-semibold">
              {t("Следующее учебное действие")}
            </h2>
            <p>{actionText[action.kind]}</p>
            {action.lesson && (
              <p className="font-semibold">{action.lesson.title[language]}</p>
            )}
            {action.kind === "continue" && action.lesson && (
              <p>
                {action.lesson.progress.nextBlock}/{action.lesson.blockCount}{" "}
                {t("блоков")}
              </p>
            )}
            {action.kind === "mistakes" && (
              <p className="text-sm">
                {t(
                  "Учтена последняя попытка актуального теста за 30 дней. Откройте урок, чтобы разобрать ошибки и пройти тест снова.",
                )}
              </p>
            )}
            <button
              onClick={() =>
                action.kind === "reviews"
                  ? onNavigate("reviews")
                  : action.lesson
                    ? onNavigate("lesson", action.lesson.slug)
                    : onNavigate("catalog")
              }
              className="inline-flex items-center gap-3 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-semibold"
            >
              {t(
                action.kind === "reviews"
                  ? "Открыть повторение"
                  : action.kind === "continue"
                    ? "Продолжить"
                    : action.kind === "mistakes"
                      ? "Разобрать ошибки"
                      : action.kind === "start"
                        ? "Начать урок"
                        : "Курсы",
              )}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </section>
          <LearningStats data={data.stats} />
        </>
      )}
    </section>
  )
}
