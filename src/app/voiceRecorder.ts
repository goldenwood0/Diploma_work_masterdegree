export type RecordingState = {
  status: "idle" | "requesting" | "recording" | "stopping" | "ready" | "error"
  seconds: number
  url: string | null
  error: "permission" | "device" | "unsupported" | "empty" | "size" | "recording" | null
}

export interface RecordingEnvironment {
  supported: boolean
  open: () => Promise<MediaStream>
  create: (stream: MediaStream) => MediaRecorder
  createUrl: (blob: Blob) => string
  revokeUrl: (url: string) => void
  now: () => number
  every: (callback: () => void) => ReturnType<typeof setInterval>
  cancel: (timer: ReturnType<typeof setInterval>) => void
}

export function browserRecordingEnvironment(): RecordingEnvironment {
  return {
    supported:
      window.isSecureContext &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined",
    open: () =>
      navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
    create: (stream) => new MediaRecorder(stream),
    createUrl: (blob) => URL.createObjectURL(blob),
    revokeUrl: (url) => URL.revokeObjectURL(url),
    now: () => Date.now(),
    every: (callback) => setInterval(callback, 250),
    cancel: (timer) => clearInterval(timer),
  }
}

const initial = (): RecordingState => ({
  status: "idle",
  seconds: 0,
  url: null,
  error: null,
})

// Owns microphone tracks and object URLs independently of React renders.
export default class VoiceRecorder {
  state = initial()
  private generation = 0
  private disposed = false
  private stream?: MediaStream
  private recorder?: MediaRecorder
  private timer?: ReturnType<typeof setInterval>
  private started = 0

  constructor(
    private env: RecordingEnvironment,
    private changed: (state: RecordingState) => void,
  ) {}

  private update(patch: Partial<RecordingState>) {
    this.state = { ...this.state, ...patch }
    if (!this.disposed) this.changed(this.state)
  }

  private release() {
    this.generation++
    if (this.timer !== undefined) this.env.cancel(this.timer)
    this.timer = undefined
    if (this.recorder) {
      this.recorder.ondataavailable = null
      this.recorder.onstop = null
      this.recorder.onerror = null
      if (this.recorder.state !== "inactive") this.recorder.stop()
    }
    this.recorder = undefined
    this.stream?.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
    this.stream = undefined
    if (this.state.url) this.env.revokeUrl(this.state.url)
  }

  clear() {
    this.release()
    this.update(initial())
  }

  dispose() {
    this.disposed = true
    this.release()
  }

  private fail(error: RecordingState["error"]) {
    this.release()
    this.update({ ...initial(), status: "error", error })
  }

  async start() {
    if (
      this.disposed ||
      ["requesting", "recording", "stopping"].includes(this.state.status)
    )
      return
    this.clear()
    if (!this.env.supported) {
      this.fail("unsupported")
      return
    }
    const generation = this.generation
    this.update({ status: "requesting" })
    try {
      const stream = await this.env.open()
      // getUserMedia cannot be aborted; release late permission results immediately.
      if (this.disposed || generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      this.stream = stream
      this.recorder = this.env.create(stream)
      const recorder = this.recorder
      const chunks: Blob[] = []
      let size = 0
      recorder.ondataavailable = (event) => {
        if (generation !== this.generation || !event.data.size) return
        size += event.data.size
        if (size > 5 * 1024 * 1024) {
          this.fail("size")
          return
        }
        chunks.push(event.data)
      }
      recorder.onerror = () => {
        if (generation === this.generation) this.fail("recording")
      }
      recorder.onstop = () => {
        if (generation !== this.generation) return
        if (this.timer !== undefined) this.env.cancel(this.timer)
        this.timer = undefined
        stream.getTracks().forEach((track) => {
          track.onended = null
          track.stop()
        })
        this.stream = undefined
        this.recorder = undefined
        if (!size) {
          this.fail("empty")
          return
        }
        const blob = new Blob(chunks, {
          type: recorder.mimeType || chunks[0].type,
        })
        this.update({ status: "ready", url: this.env.createUrl(blob) })
      }
      recorder.start(250)
      this.started = this.env.now()
      this.update({ status: "recording" })
      stream.getTracks().forEach((track) => {
        track.onended = () => this.stop()
      })
      this.timer = this.env.every(() => {
        const seconds = Math.min(
          60,
          Math.floor((this.env.now() - this.started) / 1000),
        )
        this.update({ seconds })
        if (seconds >= 60) this.stop()
      })
    } catch (error) {
      if (generation !== this.generation || this.disposed) return
      const name = (error as { name?: string })?.name
      this.fail(
        name === "NotAllowedError" || name === "SecurityError"
          ? "permission"
          : name === "NotFoundError" || name === "NotReadableError"
            ? "device"
            : "recording",
      )
    }
  }

  stop() {
    if (this.state.status === "requesting") {
      this.clear()
      return
    }
    if (this.state.status !== "recording" || !this.recorder) return
    this.update({
      status: "stopping",
      seconds: Math.min(60, Math.floor((this.env.now() - this.started) / 1000)),
    })
    if (this.timer !== undefined) this.env.cancel(this.timer)
    this.timer = undefined
    if (this.recorder.state !== "inactive") this.recorder.stop()
    // Do not keep the microphone open while final audio data is being delivered.
    this.stream?.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
  }
}
