import { useEffect, useState } from "react"
import { z } from "zod"
import { request, ApiError } from "../api/client"
import StudyTimer, { type TimeWindow } from "../app/studyTimer"
import { useLanguage } from "../i18n/LanguageProvider"

export default function StudyTimeTracker({
  source,
  lessonSlug = null,
}: {
  source: "lesson" | "reviews"
  lessonSlug?: string | null
}) {
  const { t } = useLanguage()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    const controller = new AbortController()
    const report = (failed: boolean) => {
      if (!disposed) setFailed(failed)
    }
    request("/learning/time", { signal: controller.signal })
      .then((value) => {
        if (disposed) return
        const { serverNow, accountId } = z
          .object({ serverNow: z.iso.datetime(), accountId: z.string() })
          .parse(value)
        const timer = new StudyTimer(Date.parse(serverNow), performance.now())
        // A small in-memory retry buffer; nothing is replayed into a later account session.
        const queue: Array<TimeWindow & { requestId: string }> = []
        let sending = false
        const drain = async () => {
          if (sending) return
          sending = true
          try {
            while (queue.length) {
              const entry = queue[0]
              try {
                await request("/learning/time", {
                  method: "POST",
                  keepalive: true,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...entry,
                    accountId,
                    source,
                    lessonSlug,
                  }),
                })
                queue.shift()
                report(false)
              } catch (error) {
                report(true)
                if (
                  error instanceof ApiError &&
                  error.status >= 400 &&
                  error.status < 500
                )
                  queue.shift()
                break
              }
            }
          } finally {
            sending = false
          }
        }
        const save = (window: TimeWindow | null) => {
          if (window) {
            queue.push({ ...window, requestId: crypto.randomUUID() })
            if (queue.length > 6) {
              queue.pop()
              report(true)
            }
          }
          void drain()
        }
        const visible = () =>
          document.visibilityState === "visible" && document.hasFocus()
        const visibility = () =>
          save(timer.visibility(performance.now(), visible()))
        // Activity updates do not send every pointer event; the periodic tick sends intervals.
        const action = () => timer.activity(performance.now())
        const tick = window.setInterval(
          () => save(timer.tick(performance.now())),
          15000,
        )
        const hide = () => save(timer.visibility(performance.now(), false))
        document.addEventListener("visibilitychange", visibility)
        window.addEventListener("focus", visibility)
        window.addEventListener("blur", hide)
        window.addEventListener("pagehide", hide)
        for (const event of ["pointerdown", "keydown", "scroll", "pointermove"])
          window.addEventListener(event, action, { passive: true })
        visibility()
        cleanup = () => {
          save(timer.visibility(performance.now(), false))
          window.clearInterval(tick)
          document.removeEventListener("visibilitychange", visibility)
          window.removeEventListener("focus", visibility)
          window.removeEventListener("blur", hide)
          window.removeEventListener("pagehide", hide)
          for (const event of [
            "pointerdown",
            "keydown",
            "scroll",
            "pointermove",
          ])
            window.removeEventListener(event, action)
        }
        report(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) report(true)
      })
    return () => {
      disposed = true
      controller.abort()
      cleanup()
    }
  }, [source, lessonSlug, attempt])
  return (
    <p
      className="text-xs text-foreground/65"
      role={failed ? "status" : undefined}
    >
      {t(
        failed
          ? "Время занятия не сохранено. Проверьте соединение."
          : "Время учитывается в активной вкладке. Пауза после минуты без действий.",
      )}
      {failed && (
        <button
          className="underline ml-2"
          onClick={() => setAttempt((value) => value + 1)}
        >
          {t("Повторить")}
        </button>
      )}
    </p>
  )
}
