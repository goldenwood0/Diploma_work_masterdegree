export type TimeWindow = {
  startAt: string
  endAt: string
}
// Monotonic clock: system-clock changes and delayed background timers cannot add time.
export default class StudyTimer {
  private cursor: number
  private lastAction: number
  private active = false
  constructor(
    private serverTime: number,
    private origin: number,
  ) {
    this.cursor = origin
    this.lastAction = origin
  }
  tick(now: number): TimeWindow | null {
    const start = this.cursor
    this.cursor = now
    const end = Math.min(now, this.lastAction + 60000)
    if (!this.active || end <= start || now - start > 30000) return null
    return {
      startAt: new Date(this.serverTime + start - this.origin).toISOString(),
      endAt: new Date(this.serverTime + end - this.origin).toISOString(),
    }
  }
  activity(now: number) {
    // Resuming after idle must never backfill the preceding idle interval.
    if (now > this.lastAction + 60000) this.cursor = now
    this.lastAction = now
  }
  visibility(now: number, active: boolean) {
    const window = this.tick(now)
    this.active = active
    if (active) this.lastAction = now
    return window
  }
}
