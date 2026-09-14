import { useEffect, useState } from "react"
import { getStrokes, hasStrokes, type StrokeData } from "../api/strokes"
import { useLanguage } from "../i18n/LanguageProvider"

export default function StrokeOrder({ character }: { character: string }) {
  const { t } = useLanguage()
  const [data, setData] = useState<StrokeData | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    getStrokes(character, controller.signal).then((value) => {
      if (!controller.signal.aborted) setData(value)
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [character, attempt])
  useEffect(() => {
    if (!playing || !data) return
    const timer = window.setTimeout(() => {
      if (step >= data.strokes.length) setPlaying(false)
      else setStep((value) => value + 1)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [playing, step, data])
  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener("visibilitychange", pause)
    return () => document.removeEventListener("visibilitychange", pause)
  }, [])
  const button = "rounded-xl border border-border px-4 py-3 disabled:opacity-40"
  if (!hasStrokes(character)) return <p className="text-sm">{t("Порядок черт для этого иероглифа пока не добавлен. Используйте свободное письмо ниже.")}</p>
  if (error) return <div role="alert"><p>{t("Не удалось загрузить порядок черт.")}</p><button className={button} onClick={() => { setError(false); setAttempt((value) => value + 1) }}>{t("Повторить")}</button></div>
  if (!data) return <p role="status">{t("Загрузка порядка черт…")}</p>
  const median = step ? data.medians[step - 1] : null
  return <section className="rounded-xl bg-secondary/50 p-3 space-y-3" aria-label={t("Порядок черт")}>
    <h4 className="font-semibold">{t("Порядок черт")}: <span lang="zh-CN">{character}</span></h4>
    <svg viewBox="0 0 1024 1024" className="w-full max-w-80 mx-auto bg-white rounded-xl border border-border" role="img" aria-label={`${t("Черта")}: ${step} / ${data.strokes.length}`}>
      <path d="M512 0V1024M0 512H1024" stroke="#d1d5db" strokeDasharray="16 16"/>
      <g transform="scale(1,-1) translate(0,-900)">
        {data.strokes.map((path, index) => <path key={index} d={path} fill={index === step - 1 ? "#b34121" : index < step ? "#164934" : "#e5e7eb"}/>)}
        {median && <>
          <polyline points={median.map((point) => point.join(",")).join(" ")} fill="none" stroke="white" strokeWidth="7" strokeDasharray="12 9"/>
          <circle cx={median[0][0]} cy={median[0][1]} r="16" fill="white" stroke="#164934" strokeWidth="6"/>
          <rect x={median[median.length - 1][0] - 12} y={median[median.length - 1][1] - 12} width="24" height="24" fill="white" stroke="#164934" strokeWidth="6"/>
        </>}
      </g>
    </svg>
    <p role="status">{t("Черта")}: {step} / {data.strokes.length}</p>
    <p className="text-sm">{t("Текущая черта выделена. Круг — начало, квадрат — конец. Пунктир показывает направление движения.")}</p>
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={!step} onClick={() => { setPlaying(false); setStep((value) => value - 1) }}>{t("Предыдущая черта")}</button>
      <button className={button} disabled={step === data.strokes.length} onClick={() => { setPlaying(false); setStep((value) => value + 1) }}>{t("Следующая черта")}</button>
      <button className={button} onClick={() => {
        if (playing) setPlaying(false)
        else { if (step === data.strokes.length) setStep(0); setPlaying(true) }
      }}>{t(playing ? "Пауза показа" : "Показать по порядку")}</button>
      <button className={button} disabled={!step && !playing} onClick={() => { setPlaying(false); setStep(0) }}>{t("Сначала")}</button>
    </div>
    <p className="text-xs text-foreground/65">Hanzi Writer Data / Make Me a Hanzi · © 1999 Arphic Technology, © 2016 Shaunak Kishore · <a className="underline" href="/strokes/NOTICE.txt" target="_blank" rel="noreferrer">{t("Источник и лицензия")}</a></p>
  </section>
}
