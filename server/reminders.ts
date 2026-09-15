import { localDay } from "./analytics.js"

export function reminderDate(now: Date, timezone: string, time: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(now)
  const number = (key: string) => Number(parts.find(part => part.type === key)!.value)
  const [hour, minute] = time.split(":").map(Number)
  const late = number("hour") * 60 + number("minute") - hour * 60 - minute
  return late >= 0 && late < 60 ? localDay(now, timezone) : null
}

export function reminderMessage(language: string, origin: string) {
  const messages = {
    ru: { subject: "Время для китайского — ZhPath", text: "Дневная цель ещё не достигнута. Продолжите урок или повторите слова.", open: "Продолжить обучение", settings: "Изменить время или отключить напоминания в профиле" },
    kk: { subject: "Қытай тілін үйренетін уақыт — ZhPath", text: "Күндік мақсатқа әлі жеткен жоқсыз. Сабақты жалғастырыңыз немесе сөздерді қайталаңыз.", open: "Оқуды жалғастыру", settings: "Профильде уақытты өзгерту немесе еске салуды өшіру" },
    en: { subject: "Time for Chinese — ZhPath", text: "Your daily goal is still ahead. Continue a lesson or review some words.", open: "Continue learning", settings: "Change the time or turn off reminders in your profile" },
  }
  const message = messages[language as keyof typeof messages] ?? messages.ru
  return { subject: message.subject, text: `${message.text}\n\n${message.open}: ${origin}/#/\n\n${message.settings}: ${origin}/#/profile` }
}
