import { z } from "zod"
import { request } from "./client"

const count = z.number().int().nonnegative()
const accuracy = z.object({ key: z.string(), correct: count, total: count }).refine(row => row.correct <= row.total)
const statsSchema = z.object({
  timezone: z.string(),
  serverNow: z.iso.datetime(),
  since: z.iso.datetime(),
  streak: count,
  activeToday: z.boolean(),
  week: z
    .array(z.object({ date: z.iso.date(), active: z.boolean() }))
    .length(7),
  assessedQuestions: count,
  topicAccuracy: z.array(accuracy),
  skillAccuracy: z.array(accuracy),
  unclassifiedTopics: count,
  unclassifiedSkills: count,
  studyTime: z.object({ todayMs: count, weekMs: count, totalMs: count }),
  mistakeLessonIds: z.array(z.string()),
  weakAreas: z.array(
    z
      .object({
        kind: z.enum(["choice", "match", "order", "gap", "input", "dictation"]),
        total: z.number().int().positive(),
        incorrect: z.number().int().positive(),
      })
      .refine((area) => area.incorrect <= area.total),
  ),
})
export type LearningStats = z.infer<typeof statsSchema>
export async function getStats(signal: AbortSignal) {
  return statsSchema.parse(await request("/learning/stats", { signal }))
}
