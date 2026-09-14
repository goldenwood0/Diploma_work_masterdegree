import { test } from "node:test"
import assert from "node:assert/strict"
import { activitySummary, localDay, exerciseSummary } from "./analytics.js"

test("streak handles duplicates, yesterday grace, gaps, future dates and year boundaries", () => {
  assert.equal(activitySummary([], "2026-01-01").streak, 0)
  const days = ["2025-12-30", "2025-12-31", "2025-12-31", "2026-01-02"]
  assert.equal(activitySummary(days, "2026-01-01").streak, 2)
  assert.equal(activitySummary(days, "2026-01-04").streak, 0)
  const summary = activitySummary([...days, "2026-01-01"], "2026-01-01")
  assert.equal(summary.streak, 3)
  assert.equal(summary.activeToday, true)
  assert.equal(summary.week.length, 7)
  assert.equal(summary.week.at(-1)?.date, "2026-01-01")
})

test("local study dates respect midnight, leap days and both DST transitions", () => {
  assert.equal(
    localDay(new Date("2026-09-14T19:01:00Z"), "Asia/Qyzylorda"),
    "2026-09-15",
  )
  assert.equal(localDay(new Date("2026-09-14T19:01:00Z"), "UTC"), "2026-09-14")
  const days = [
    "2026-03-07T17:00:00Z",
    "2026-03-08T16:00:00Z",
    "2026-03-09T16:00:00Z",
  ].map((date) => localDay(new Date(date), "America/New_York"))
  assert.equal(activitySummary(days, "2026-03-09").streak, 3)
  const fall = ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"].map((date) =>
    localDay(new Date(date), "America/New_York"),
  )
  assert.equal(activitySummary(fall, "2026-11-01").streak, 1)
  assert.equal(
    activitySummary(["2024-02-28", "2024-02-29", "2024-03-01"], "2024-03-01")
      .streak,
    3,
  )
})

test("exercise statistics distinguish no data, no errors and ordered error rates", () => {
  assert.deepEqual(exerciseSummary([]), { assessedQuestions: 0, weakAreas: [] })
  const item = (kind: string, correct: boolean) => ({
    question: { kind },
    correct,
  })
  assert.deepEqual(exerciseSummary([{ items: [item("choice", true)] }]), {
    assessedQuestions: 1,
    weakAreas: [],
  })
  const summary = exerciseSummary([
    {
      items: [
        item("choice", false),
        item("choice", true),
        item("dictation", false),
      ],
    },
    { invalid: true },
  ])
  assert.equal(summary.assessedQuestions, 3)
  assert.deepEqual(
    summary.weakAreas.map((area) => area.kind),
    ["dictation", "choice"],
  )
})
