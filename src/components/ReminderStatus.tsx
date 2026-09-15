import { useEffect, useState } from "react"
import { z } from "zod"
import { request } from "../api/client"
import { useLanguage } from "../i18n/LanguageProvider"

const schema = z.object({ available: z.boolean(), latest: z.object({ status: z.enum(["SENDING", "SENT", "FAILED", "CANCELLED", "SKIPPED_GOAL"]), attemptedAt: z.iso.datetime() }).nullable() })
const labels = {
  SENDING: "Напоминание передаётся почтовому сервису. После сбоя этот статус может остаться без подтверждения.",
  SENT: "Последнее напоминание передано почтовому сервису.",
  FAILED: "Отправку последнего напоминания не удалось подтвердить. Повтор в этот день не выполняется.",
  CANCELLED: "Последнее напоминание отменено после изменения настроек.",
  SKIPPED_GOAL: "Последнее напоминание пропущено: дневная цель выполнена.",
}
export default function ReminderStatus() {
  const { t } = useLanguage()
  const [value, setValue] = useState<z.infer<typeof schema> | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    request("/profile/reminders", { signal: controller.signal }).then(raw => {
      const data = schema.parse(raw)
      if (!controller.signal.aborted) { setValue(data); setFailed(false) }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [attempt])
  return <div className="text-sm text-muted-foreground space-y-2" role="status">
    {failed ? <p>{t("Не удалось проверить доступность напоминаний.")}</p> : !value ? <p>{t("Загрузка…")}</p> : <>
      <p>{t(value.available ? "Сервис напоминаний включён. Вы можете отключить письма настройкой выше." : "Напоминания временно недоступны. Ваши настройки будут сохранены.")}</p>
      {value.latest && <p>{t(labels[value.latest.status])}</p>}
    </>}
    <button type="button" className="underline" onClick={() => setAttempt(n => n + 1)}>{t("Обновить статус напоминаний")}</button>
  </div>
}
