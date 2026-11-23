import { ArrowRight, LayoutPanelTop, RefreshCw } from "lucide-react"
import type { Screen } from "../app/routes"
import useStudyDashboard from "../app/useStudyDashboard"
import studyRecommendation from "../app/studyRecommendation"
import { useLanguage } from "../i18n/LanguageProvider"
import LearningStats from "../components/LearningStats"

export default function Dashboard({
  name,
  dailyGoalMinutes = 10,
  onNavigate,
}: {
  name: string
  dailyGoalMinutes?: number
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
  const todayMinutes = Math.floor((data?.stats.studyTime.todayMs ?? 0) / 60000)
  const actionText = {
    reviews: t("Начните с повторения слов."),
    continue: t("Продолжите начатый урок."),
    mistakes: t("Вернитесь к уроку с ошибками в тесте."),
    start: t("Пора изучить новый урок."),
    complete: t("Все опубликованные уроки завершены."),
    catalog: t("Посмотрите доступные материалы в каталоге."),
  }
  const actionReason = {
    reviews: t("Карточки доступны для практики — закрепите слова перед новым уроком."),
    continue: t("Ваш прогресс сохранён — вернитесь к месту остановки."),
    mistakes: t("В последнем тесте были ошибки — повторите материал урока."),
    start: t("Следующий доступный урок поможет продвинуться дальше."),
    complete: t("Можно вернуться к материалам в каталоге. Повторение появится здесь, когда будут доступны карточки."),
    catalog: t("Сейчас нет доступного следующего урока. Проверьте материалы и условия доступа в каталоге."),
  }
  return (
    <section className="space-y-6 tablet:space-y-8 break-words">
      <header>
        <p className="mb-2 text-sm uppercase tracking-wide text-muted-foreground">{t("Ваш учебный маршрут")}</p>
        <h1 className="text-3xl font-bold text-dark-green tablet:text-4xl">
          {t("Здравствуйте")}, {name}!
        </h1>
        <p className="mt-3 text-muted-foreground tablet:text-lg">
          {t("Продолжайте изучать китайский шаг за шагом.")}
        </p>
      </header>
      {error ? (
        <div role="alert" className="rounded-2xl border border-border bg-card p-5 sm:p-8 space-y-4">
          <p>{t("Не удалось загрузить учебные данные.")}</p>
          <button className="min-h-12 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" onClick={retry}>
            {t("Повторить загрузку")}
          </button>
        </div>
      ) : !data ? (
        <div role="status" aria-busy="true" className="rounded-2xl border border-border bg-secondary p-5 sm:p-8">{t("Подбираем следующее учебное действие…")}</div>
      ) : (
        <>
          {/* ПР5 home: dark "continue" card with the daily goal beside it on desktop. */}
          <div className="grid gap-4 desktop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] desktop:gap-6">
          <section
            className="bg-primary text-primary-foreground rounded-2xl p-5 tablet:p-8 space-y-4"
            aria-labelledby="next-action-title"
          >
            <h2 id="next-action-title" className="text-sm font-bold uppercase tracking-wide text-accent">
              {t("Следующее учебное действие")}
            </h2>
            <p className="text-2xl tablet:text-3xl font-bold leading-snug">{actionText[action.kind]}</p>
            <p className="text-primary-foreground/85">{actionReason[action.kind]}</p>
            {action.kind === "reviews" && (
              <p className="font-semibold break-words">
                {t("Карточек доступно сейчас")}: {data.reviews.ready}
              </p>
            )}
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
              className="inline-flex w-full tablet:w-auto min-h-14 items-center justify-center gap-3 rounded-xl bg-card text-dark-green px-6 py-3 text-lg font-bold hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent transition-colors"
            >
              {t(
                action.kind === "reviews"
                  ? "Повторить слова"
                  : action.kind === "continue"
                    ? "Продолжить урок"
                    : action.kind === "mistakes"
                      ? "Разобрать ошибки"
                      : action.kind === "start"
                        ? "Начать урок"
                        : "Открыть каталог",
              )}
              <ArrowRight size={18} className="shrink-0" aria-hidden="true" />
            </button>
          </section>
          <section aria-labelledby="today-title" className="bg-card border border-border rounded-2xl p-5 tablet:p-8 space-y-3">
            <h2 id="today-title" className="text-xl font-bold text-dark-green">{t("Сегодня")}</h2>
            <p className="text-3xl font-bold text-dark-green tabular-nums">
              {todayMinutes} / {dailyGoalMinutes} {t("мин")}
            </p>
            <p className="text-muted-foreground">{t("Ваша цель на день")}</p>
            <div aria-hidden="true" className="h-2 rounded-full bg-secondary">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((todayMinutes / Math.max(1, dailyGoalMinutes)) * 100))}%` }} />
            </div>
            {data?.stats.points && <div className="space-y-2 border-t border-border pt-3">
              <p className="flex items-baseline justify-between gap-2"><span className="text-lg font-bold text-dark-green">{t("Уровень")} {data.stats.points.level}</span>
                <span className="tabular-nums text-muted-foreground">{t("Очки")}: {data.stats.points.xp}</span></p>
              <div role="progressbar" aria-label={t("До следующего уровня")} aria-valuemin={0} aria-valuemax={data.stats.points.nextLevelXp} aria-valuenow={data.stats.points.levelXp} className="h-2 rounded-full bg-secondary">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round(data.stats.points.levelXp / data.stats.points.nextLevelXp * 100)}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">{t("Очки: 10 за верный ответ в лучшей попытке теста, 20 за зачёт, 1 за повторение карточки.")}</p>
            </div>}
          </section>
          </div>
          <section aria-labelledby="next-step-title" className="space-y-4">
            <h2 id="next-step-title" className="text-2xl font-bold text-dark-green">{t("Выберите следующий шаг")}</h2>
            <div className="grid gap-4 tablet:grid-cols-2 tablet:gap-5 desktop:gap-6">
              <article className="flex flex-col gap-3 bg-card border border-border rounded-2xl p-5 tablet:p-6">
                <LayoutPanelTop className="text-primary" aria-hidden="true" />
                <h3 className="text-xl font-bold text-dark-green">{t("Курсы")}</h3>
                <p className="text-muted-foreground">{t("Завершено")}: {completed} / {lessons.length}</p>
                <button type="button" onClick={() => onNavigate("catalog")} className="mt-auto min-h-12 rounded-xl border border-border font-bold text-dark-green hover:bg-secondary">
                  {t("Открыть каталог")}
                </button>
              </article>
              <article className="flex flex-col gap-3 bg-card border border-border rounded-2xl p-5 tablet:p-6">
                <RefreshCw className="text-primary" aria-hidden="true" />
                <h3 className="text-xl font-bold text-dark-green">{t("Повторение")}</h3>
                <p className="text-muted-foreground">{t("Карточек доступно сейчас")}: {data.reviews.ready}</p>
                <button type="button" onClick={() => onNavigate("reviews")} className="mt-auto min-h-12 rounded-xl border border-border font-bold text-dark-green hover:bg-secondary">
                  {t("Повторить слова")}
                </button>
              </article>
            </div>
          </section>
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
              {data.reviews.remainingNew} / {data.reviews.newLimit}.
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
          </section>
          <LearningStats data={data.stats} />
        </>
      )}
    </section>
  )
}
