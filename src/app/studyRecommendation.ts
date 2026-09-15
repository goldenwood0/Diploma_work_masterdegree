import type { CatalogData } from "../api/learning"

type Lesson = CatalogData["curricula"][number]["levels"][number]["units"][number]["lessons"][number]
export default function studyRecommendation(
  lessons: Lesson[],
  ready: number,
  mistakeLessonIds: string[],
) {
  if (ready > 0) return { kind: "reviews" as const, lesson: null }
  const accessible = lessons.filter((lesson) => !lesson.locked)
  const started = accessible.find(
    (lesson) => !lesson.progress.completedAt && lesson.progress.nextBlock > 0,
  )
  if (started) return { kind: "continue" as const, lesson: started }
  const mistake = accessible.find((lesson) =>
    mistakeLessonIds.includes(lesson.id),
  )
  if (mistake) return { kind: "mistakes" as const, lesson: mistake }
  const next = accessible.find((lesson) => !lesson.progress.completedAt)
  if (next) return { kind: "start" as const, lesson: next }
  return {
    kind:
      lessons.length && lessons.every((lesson) => lesson.progress.completedAt)
        ? "complete" as const
        : "catalog" as const,
    lesson: null,
  }
}
