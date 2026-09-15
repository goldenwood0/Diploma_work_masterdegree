import { localDay } from "./analytics.js"

export type Segment = [number, number]
// Subtract the union of existing intervals, including requests from other devices.
export function uncovered(
  start: number,
  end: number,
  existing: Segment[],
): Segment[] {
  const result: Segment[] = []
  let cursor = start
  for (const [left, right] of [...existing].sort((a, b) => a[0] - b[0])) {
    if (left > cursor) result.push([cursor, Math.min(left, end)])
    cursor = Math.max(cursor, right)
    if (cursor >= end) break
  }
  if (cursor < end) result.push([cursor, end])
  return result.filter(([left, right]) => right > left)
}

// Each interval is at most 30 seconds; split at local midnight (including DST).
export function timeByDay(segments: Segment[], timezone: string) {
  const totals = new Map<string, number>()
  const add = (day: string, ms: number) =>
    totals.set(day, (totals.get(day) ?? 0) + ms)
  for (const [start, end] of segments) {
    const day = localDay(new Date(start), timezone)
    const lastDay = localDay(new Date(end - 1), timezone)
    if (day === lastDay) {
      add(day, end - start)
      continue
    }
    let left = start,
      right = end
    while (right - left > 1) {
      const mid = Math.floor((left + right) / 2)
      if (localDay(new Date(mid), timezone) === day) left = mid
      else right = mid
    }
    add(day, right - start)
    add(lastDay, end - right)
  }
  return totals
}
