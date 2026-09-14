import { useEffect, useRef, useState } from "react"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { completeBlock, getLesson, type LessonData } from "../api/learning"
import { ApiError } from "../api/client"
import type { Screen } from "../app/routes"
import { useLanguage } from "../i18n/LanguageProvider"
import LessonAudio from "../components/LessonAudio"
import QuizPanel from '../components/QuizPanel'
import CharacterPractice from "../components/CharacterPractice"

export default function Lesson({
  slug,
  onNavigate,
}: {
  slug: string
  onNavigate: (screen: Screen) => void
}) {
  const { t, language, explanationLanguage } = useLanguage()
  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const lifetime = useRef<AbortController | null>(null)
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    setLesson(null)
    setError("")
    setSaving(false)
    pending.current = false
    getLesson(slug, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setLesson(value)
          setIndex(Math.min(value.progress.nextBlock, value.blocks.length - 1))
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof ApiError
              ? err.message
              : "Не удалось загрузить учебные данные.",
          )
      })
    return () => controller.abort()
  }, [slug, attempt])
  async function advance() {
    if (!lesson || pending.current || !lifetime.current) return
    const signal = lifetime.current.signal
    if (index < lesson.progress.nextBlock) {
      setIndex((i) => Math.min(i + 1, lesson.blocks.length - 1))
      return
    }
    pending.current = true
    setSaving(true)
    setError("")
    try {
      const progress = await completeBlock(
        lesson,
        lesson.blocks[index].id,
        signal,
      )
      if (!signal.aborted) {
        setLesson({ ...lesson, progress })
        setIndex(Math.min(progress.nextBlock, lesson.blocks.length - 1))
      }
    } catch (err) {
      if (!signal.aborted)
        setError(
          err instanceof ApiError
            ? err.message
            : "Не удалось сохранить прогресс.",
        )
    } finally {
      if (!signal.aborted) {
        pending.current = false
        setSaving(false)
      }
    }
  }
  const block = lesson?.blocks[index]
  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <button
        className="flex items-center gap-2 text-primary"
        onClick={() => onNavigate("catalog")}
      >
        <ArrowLeft size={18} />
        {t("Курсы")}
      </button>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-border p-4 space-y-2"
        >
          <p>{t(error)}</p>
          <button
            disabled={saving}
            className="underline"
            onClick={() => setAttempt((a) => a + 1)}
          >
            {t("Обновить урок")}
          </button>
        </div>
      )}
      {!lesson && !error && <p role="status">{t("Загрузка…")}</p>}
      {lesson && block && (
        <>
          <h1 className="text-3xl font-bold text-dark-green">
            {lesson.title[language]}
          </h1>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>{t("Прогресс сохранён в аккаунте")}</span>
              <span>
                {lesson.progress.nextBlock}/{lesson.blocks.length}
              </span>
            </div>
            <progress
              aria-label={t("Прогресс урока")}
              value={lesson.progress.nextBlock}
              max={lesson.blocks.length}
              className="w-full h-2 accent-primary"
            />
          </div>
          {lesson.progress.completedAt && (
            <p role="status" className="flex items-center gap-2 text-primary">
              <CheckCircle2 size={22} />
              {t("Урок завершён. Можно повторить материал.")}
            </p>
          )}
          <div
            role="group"
            aria-label={t("Блоки урока")}
            className="flex flex-wrap gap-2"
          >
            {lesson.blocks.map((b, i) => (
              <button
                key={b.id}
                aria-current={i === index ? "step" : undefined}
                disabled={saving || i > lesson.progress.nextBlock}
                onClick={() => setIndex(i)}
                className={`size-10 rounded-full border border-border disabled:opacity-40 ${
                  index === i ? "bg-primary text-primary-foreground" : "bg-card"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <article
            className="bg-card border border-border rounded-2xl p-5 sm:p-8 space-y-6"
            key={block.id}
          >
            <h2 className="text-xl font-bold">
              {block.content.title[explanationLanguage]}
            </h2>
            {block.kind === "vocabulary" && (
              <div className="grid sm:grid-cols-2 gap-4">
                {block.content.words.map((word) => (
                  <div key={word.hanzi} className="bg-secondary rounded-xl p-5">
                    <p lang="zh-CN" className="text-4xl sc-text">
                      {word.hanzi}
                    </p>
                    <p className="text-primary text-lg my-2">{word.pinyin}</p>
                    <p>{word.translation[explanationLanguage]}</p>
                  </div>
                ))}
              </div>
            )}
            {block.kind === "reading" && (
              <>
                <p className="leading-relaxed">
                  {block.content.text[explanationLanguage]}
                </p>
                <div className="bg-secondary rounded-xl p-5 space-y-3">
                  <p
                    lang="zh-CN"
                    className="text-3xl sc-text whitespace-pre-line leading-relaxed"
                  >
                    {block.content.hanzi}
                  </p>
                  <p className="text-primary whitespace-pre-line">
                    {block.content.pinyin}
                  </p>
                  <p className="whitespace-pre-line">
                    {block.content.translation[explanationLanguage]}
                  </p>
                </div>
              </>
            )}
            {block.kind === "audio" && <LessonAudio content={block.content} />}
            {block.kind === "vocabulary" && <CharacterPractice text={block.content.words.map((word) => word.hanzi).join("")} />}
          </article>
          {lesson.quiz && lesson.progress.nextBlock === lesson.blocks.length && index === lesson.blocks.length - 1 && <QuizPanel key={`${lesson.id}-${lesson.revision}`} slug={slug} onPassed={at => setLesson(current => current ? { ...current, progress: { ...current.progress, completedAt: current.progress.completedAt ?? at } } : current)} />}
          <div className="flex justify-between gap-3">
            <button
              disabled={index === 0 || saving}
              className="px-4 py-3 rounded-xl border border-border disabled:opacity-40"
              onClick={() => setIndex((i) => i - 1)}
            >
              {t("Назад")}
            </button>
            {(lesson.progress.completedAt || (lesson.quiz && lesson.progress.nextBlock === lesson.blocks.length)) &&
            index === lesson.blocks.length - 1 ? (
              <button
                className="bg-primary text-primary-foreground rounded-xl px-5 py-3"
                onClick={() => onNavigate("catalog")}
              >
                {t("Курсы")}
              </button>
            ) : (
              <button
                disabled={saving}
                className="bg-primary text-primary-foreground rounded-xl px-5 py-3 disabled:opacity-50"
                onClick={() => void advance()}
              >
                {t(
                  saving
                    ? "Сохранение…"
                    : index === lesson.blocks.length - 1
                      ? lesson.quiz ? "К тесту" : "Завершить урок"
                      : "Продолжить",
                )}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
