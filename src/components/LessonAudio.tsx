import { useRef, useState } from "react"
import type { AudioContent } from "../api/learning"
import { useLanguage } from "../i18n/LanguageProvider"

export default function LessonAudio({ content }: { content: AudioContent }) {
  const { t, explanationLanguage } = useLanguage()
  const ref = useRef<HTMLAudioElement>(null)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)
  const [transcript, setTranscript] = useState(true)
  const [translation, setTranslation] = useState(false)
  const [error, setError] = useState(false)
  return (
    <div className="space-y-5">
      <audio
        ref={ref}
        controls
        preload="none"
        loop={loop}
        src={content.audioUrl}
        className="w-full"
        aria-label={content.title[explanationLanguage]}
        onError={() => setError(true)}
        onLoadedMetadata={() => {
          setError(false)
          if (ref.current) ref.current.playbackRate = speed
        }}
      />
      {error && (
        <div role="alert">
          <p>{t("Аудио недоступно. Проверьте соединение и повторите.")}</p>
          <button className="underline" onClick={() => ref.current?.load()}>
            {t("Повторить")}
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-4 items-center">
        <label>
          {t("Скорость")}{" "}
          <select
            className="border border-border rounded-lg p-2 bg-background"
            value={speed}
            onChange={(e) => {
              const value = Number(e.target.value)
              setSpeed(value)
              if (ref.current) ref.current.playbackRate = value
            }}
          >
            <option value={0.75}>0.75×</option>
            <option value={1}>1×</option>
            <option value={1.25}>1.25×</option>
          </select>
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
          />
          {t("Повторять аудио")}
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={transcript}
            onChange={(e) => setTranscript(e.target.checked)}
          />
          {t("Транскрипт")}
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={translation}
            onChange={(e) => setTranslation(e.target.checked)}
          />
          {t("Перевод")}
        </label>
      </div>
      {transcript && (
        <div>
          <p lang="zh-CN" className="text-4xl sc-text">
            {content.hanzi}
          </p>
          <p className="text-lg mt-2">{content.pinyin}</p>
        </div>
      )}
      {translation && <p>{content.translation[explanationLanguage]}</p>}
      <p className="text-xs text-foreground/60">
        <a
          className="underline"
          target="_blank"
          rel="noreferrer"
          href={content.sourceUrl}
        >
          {content.author} · Wikimedia Commons
        </a>{" "}
        ·{" "}
        <a
          className="underline"
          target="_blank"
          rel="noreferrer"
          href={content.licenseUrl}
        >
          {content.license}
        </a>{" "}
        · {t("Запись без изменений")}
      </p>
    </div>
  )
}
