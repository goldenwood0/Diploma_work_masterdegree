import { z } from "zod"

export const topics = ["greetings", "introductions", "courtesy"] as const
export const skills = ["vocabulary", "grammar", "reading", "listening", "writing"] as const

export function accuracySummary(results: unknown[]) {
  const topicAccuracy = topics.map(key => ({ key, correct: 0, total: 0 }))
  const skillAccuracy = skills.map(key => ({ key, correct: 0, total: 0 }))
  let unclassifiedTopics = 0, unclassifiedSkills = 0
  const schema = z.object({ items: z.array(z.object({ correct: z.boolean(), question: z.object({ topic: z.unknown().optional(), skill: z.unknown().optional() }) })) })
  for (const value of results) {
    const parsed = schema.safeParse(value)
    if (!parsed.success) continue
    for (const item of parsed.data.items) {
      const topic = topicAccuracy.find(row => row.key === item.question.topic)
      const skill = skillAccuracy.find(row => row.key === item.question.skill)
      if (topic) { topic.total++; if (item.correct) topic.correct++ }
      else unclassifiedTopics++
      if (skill) { skill.total++; if (item.correct) skill.correct++ }
      else unclassifiedSkills++
    }
  }
  return { topicAccuracy, skillAccuracy, unclassifiedTopics, unclassifiedSkills }
}

export const exerciseKinds = [
  "choice",
  "match",
  "order",
  "gap",
  "input",
  "dictation",
] as const
const resultSchema = z.object({
  items: z.array(
    z.object({
      question: z.object({ kind: z.enum(exerciseKinds) }),
      correct: z.boolean(),
    }),
  ),
})

export function localDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value
  return `${value("year")}-${value("month")}-${value("day")}`
}

// Arithmetic on calendar labels, not elapsed 24-hour periods in a DST timezone.
export function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function activitySummary(days: string[], today: string) {
  const active = new Set(days.filter((day) => day <= today))
  let cursor = active.has(today) ? today : shiftDay(today, -1)
  let streak = 0
  while (active.has(cursor)) {
    streak++
    cursor = shiftDay(cursor, -1)
  }
  return {
    streak,
    activeToday: active.has(today),
    week: Array.from({ length: 7 }, (_, i) => {
      const date = shiftDay(today, i - 6)
      return { date, active: active.has(date) }
    }),
  }
}

export function exerciseSummary(results: unknown[]) {
  const totals = new Map(
    exerciseKinds.map((kind) => [kind, { kind, total: 0, incorrect: 0 }]),
  )
  for (const result of results) {
    const parsed = resultSchema.safeParse(result)
    if (!parsed.success) continue
    for (const item of parsed.data.items) {
      const entry = totals.get(item.question.kind)!
      entry.total++
      if (!item.correct) entry.incorrect++
    }
  }
  const assessedQuestions = [...totals.values()].reduce(
    (sum, entry) => sum + entry.total,
    0,
  )
  const weakAreas = [...totals.values()]
    .filter((entry) => entry.incorrect > 0)
    .sort(
      (a, b) =>
        b.incorrect / b.total - a.incorrect / a.total ||
        b.incorrect - a.incorrect ||
        a.kind.localeCompare(b.kind),
    )
  return { assessedQuestions, weakAreas }
}
