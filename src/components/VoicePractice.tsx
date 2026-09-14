import { useEffect, useRef, useState, type RefObject } from "react"
import { Mic, Square, Trash2 } from "lucide-react"
import VoiceRecorder, {
  browserRecordingEnvironment,
  type RecordingState,
} from "../app/voiceRecorder"
import { useLanguage } from "../i18n/LanguageProvider"

const errors = {
  permission:
    "Доступ к микрофону не разрешён. Разрешите его в настройках сайта и попробуйте снова.",
  device: "Микрофон не найден или занят другим приложением.",
  unsupported:
    "Запись недоступна в этом браузере. Откройте сайт через HTTPS или localhost в браузере с поддержкой записи.",
  empty: "Звук не записан. Попробуйте ещё раз.",
  size: "Запись превысила 5 МБ. Попробуйте записать более короткую фразу.",
  recording: "Не удалось записать звук. Проверьте микрофон и попробуйте снова.",
}

export default function VoicePractice({
  reference,
  onCaptureChange,
}: {
  reference: RefObject<HTMLAudioElement | null>
  onCaptureChange: (active: boolean) => void
}) {
  const { t } = useLanguage()
  const recorder = useRef<VoiceRecorder | null>(null)
  const player = useRef<HTMLAudioElement>(null)
  const [state, setState] = useState<RecordingState>({
    status: "idle",
    seconds: 0,
    url: null,
    error: null,
  })
  const [supported, setSupported] = useState(true)
  const [checks, setChecks] = useState<boolean[]>([false, false, false])
  const [playbackError, setPlaybackError] = useState(false)
  useEffect(() => {
    const env = browserRecordingEnvironment()
    setSupported(env.supported)
    const capture = new VoiceRecorder(env, (value) => {
      setState(value)
      onCaptureChange(
        ["requesting", "recording", "stopping"].includes(value.status),
      )
    })
    recorder.current = capture
    const hide = () => {
      if (document.hidden) capture.stop()
    }
    const leave = () => capture.clear()
    const referenceAudio = reference.current
    const pausePlayback = () => player.current?.pause()
    referenceAudio?.addEventListener("play", pausePlayback)
    document.addEventListener("visibilitychange", hide)
    window.addEventListener("pagehide", leave)
    return () => {
      capture.dispose()
      recorder.current = null
      onCaptureChange(false)
      document.removeEventListener("visibilitychange", hide)
      window.removeEventListener("pagehide", leave)
      referenceAudio?.removeEventListener("play", pausePlayback)
    }
  }, [onCaptureChange, reference])
  const busy = ["requesting", "recording", "stopping"].includes(state.status)
  function reset() {
    player.current?.pause()
    setChecks([false, false, false])
    setPlaybackError(false)
  }
  return (
    <section
      className="rounded-2xl border border-border bg-secondary/40 p-5 space-y-4"
      aria-label={t("Практика произношения")}
    >
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Mic aria-hidden="true" size={20} />
        {t("Практика произношения")}
      </h3>
      <p>
        {t(
          "Прослушайте образец выше, запишите ту же фразу и сравните произношение.",
        )}
      </p>
      <p className="text-sm text-foreground/65">
        {t(
          "До 60 секунд. Запись остаётся только в этой вкладке и удаляется при выходе из блока или обновлении страницы. На сервер она не отправляется.",
        )}
      </p>
      {!supported ? (
        <p role="status">{t(errors.unsupported)}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {!busy && (
            <button
              className="rounded-xl bg-primary text-primary-foreground px-4 py-3"
              onClick={() => {
                reference.current?.pause()
                reset()
                void recorder.current?.start()
              }}
            >
              {t(
                state.url ? "Записать заново" : "Разрешить микрофон и записать",
              )}
            </button>
          )}
          {(state.status === "requesting" || state.status === "recording") && (
            <button
              className="rounded-xl border border-border px-4 py-3 flex items-center gap-2"
              onClick={() => recorder.current?.stop()}
            >
              <Square aria-hidden="true" size={16} />
              {t(
                state.status === "requesting"
                  ? "Отменить запрос"
                  : "Остановить запись",
              )}
            </button>
          )}
          {state.url && (
            <button
              className="rounded-xl border border-border px-4 py-3 flex items-center gap-2"
              onClick={() => {
                reset()
                recorder.current?.clear()
              }}
            >
              <Trash2 aria-hidden="true" size={16} />
              {t("Удалить запись")}
            </button>
          )}
        </div>
      )}
      <p role="status">
        {state.status === "requesting"
          ? t("Ожидание разрешения на микрофон…")
          : state.status === "recording"
            ? t("Идёт запись")
            : state.status === "stopping"
              ? t("Обработка записи…")
              : state.status === "ready"
                ? t("Запись готова к прослушиванию.")
                : ""}
      </p>
      {(state.status === "recording" || state.status === "ready") && (
        <p className="tabular-nums">
          {state.seconds} / 60 {t("сек")}
        </p>
      )}
      {state.error && <p role="alert">{t(errors[state.error])}</p>}
      {state.url && (
        <>
          <audio
            ref={player}
            controls
            src={state.url}
            className="w-full"
            aria-label={t("Моя запись")}
            onPlay={() => reference.current?.pause()}
            onError={() => setPlaybackError(true)}
          />
          {playbackError && (
            <p role="alert">
              {t(
                "Браузер не смог воспроизвести запись. Попробуйте записать снова.",
              )}
            </p>
          )}
          <fieldset className="space-y-3">
            <legend className="font-semibold mb-2">
              {t("Самопроверка после прослушивания")}
            </legend>
            {[
              "Тоны и их изменения похожи на образец.",
              "Все слоги произнесены отчётливо.",
              "Ритм и паузы похожи на образец.",
            ].map((label, index) => (
              <label key={label} className="flex gap-3 items-start">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checks[index]}
                  onChange={(event) =>
                    setChecks((previous) =>
                      previous.map((value, i) =>
                        i === index ? event.target.checked : value,
                      ),
                    )
                  }
                />
                {t(label)}
              </label>
            ))}
          </fieldset>
          <p className="text-sm text-foreground/65">
            {t(
              "Это самопроверка: автоматическая оценка речи и тонов пока не подключена.",
            )}
          </p>
        </>
      )}
    </section>
  )
}
