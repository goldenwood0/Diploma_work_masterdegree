import { useEffect, useRef, useState, type PointerEvent } from "react"
import { getStrokes, hasStrokes, type StrokeData } from "../api/strokes"
import { matchStroke, medianPoints, type StrokePoint } from "../app/strokeMatching"
import { useLanguage } from "../i18n/LanguageProvider"

export default function GuidedWriting({ character }: { character: string }) {
  const { t } = useLanguage()
  const [data, setData] = useState<StrokeData | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [step, setStep] = useState(0)
  const [hint, setHint] = useState(true)
  const [drawing, setDrawing] = useState<StrokePoint[]>([])
  const [feedback, setFeedback] = useState("")
  const active = useRef<number | null>(null)
  const points = useRef<StrokePoint[]>([])
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    getStrokes(character, controller.signal).then(value => { if (!controller.signal.aborted) setData(value) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [character, attempt])
  function cancel() {
    const id = active.current
    active.current = null
    points.current = []
    setDrawing([])
    if (id !== null && svg.current?.hasPointerCapture(id)) svg.current.releasePointerCapture(id)
  }
  function point(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(300, (event.clientX-rect.left) / rect.width * 300)), y: Math.max(0, Math.min(300, (event.clientY-rect.top) / rect.height * 300)) }
  }
  if (!hasStrokes(character)) return null
  if (error) return <div role="alert"><p>{t("Не удалось загрузить порядок черт.")}</p><button className="underline py-3" onClick={() => { setError(false); setAttempt(n=>n+1) }}>{t("Повторить")}</button></div>
  if (!data) return <p role="status">{t("Загрузка порядка черт…")}</p>
  const complete = step === data.strokes.length
  const expected = complete ? [] : medianPoints(data.medians[step])
  return <section className="rounded-xl border border-border p-3 space-y-3" aria-label={t("Письмо по чертам")}>
    <h4 className="font-semibold">{t("Письмо по чертам")}: <span lang="zh-CN">{character}</span></h4>
    <p>{t("Пишите по одной черте: от круга к квадрату. После отпускания указателя тренажёр проверит текущую черту.")}</p>
    <label className="flex gap-3 items-center"><input type="checkbox" checked={hint} onChange={event=>setHint(event.target.checked)}/>{t("Подсказка текущей черты")}</label>
    <svg ref={svg} viewBox="0 0 300 300" role="img" aria-label={`${t("Письмо по чертам")}: ${character}, ${step} / ${data.strokes.length}`}
      className="w-full max-w-80 aspect-square mx-auto touch-none select-none bg-white rounded-xl border border-border"
      onPointerDown={event=>{
        if (complete || active.current !== null || !event.isPrimary || event.button !== 0) return
        event.preventDefault(); active.current=event.pointerId; event.currentTarget.setPointerCapture(event.pointerId)
        points.current=[point(event)]; setDrawing(points.current); setFeedback("")
      }}
      onPointerMove={event=>{
        if (active.current !== event.pointerId || points.current.length>=2000) return
        points.current=[...points.current,point(event)]; setDrawing(points.current)
      }}
      onPointerUp={event=>{
        if (active.current !== event.pointerId) return
        const result=matchStroke([...points.current,point(event)],expected)
        cancel()
        if (result === "accepted") {setStep(n=>n+1);setFeedback("Черта принята.")}
        else setFeedback(result === "direction" ? "Попробуйте в обратном направлении: от круга к квадрату." : "Повторите текущую черту, следуя её форме и расположению.")
      }}
      onPointerCancel={event=>{if(active.current===event.pointerId)cancel()}}
      onLostPointerCapture={cancel}>
      <path d="M150 0V300M0 150H300" stroke="#d1d5db" strokeDasharray="5 5"/>
      <g transform="scale(.29296875,-.29296875) translate(0,-900)">
        {data.strokes.map((path,index)=><path key={index} d={path} fill={index<step ? "#164934" : hint && index===step ? "#f0c6b5" : "#f3f4f6"}/>)}
      </g>
      {hint && !complete && <>
        <polyline points={expected.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#b34121" strokeWidth="2" strokeDasharray="4 3"/>
        <circle cx={expected[0].x} cy={expected[0].y} r="4" fill="white" stroke="#164934"/>
        <rect x={expected[expected.length-1].x-3} y={expected[expected.length-1].y-3} width="6" height="6" fill="white" stroke="#164934"/>
      </>}
      <polyline points={drawing.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#164934" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <p>{t("Принято черт")}: {step} / {data.strokes.length}</p>
    <p role="status">{t(complete ? "Все черты пройдены. Сравните результат с образцом." : feedback)}</p>
    <div className="flex flex-wrap gap-3">
      <button disabled={!step} className="border border-border rounded-xl px-4 py-3 disabled:opacity-40" onClick={()=>{cancel();setStep(n=>n-1);setFeedback("")}}>{t("Отменить черту")}</button>
      <button className="border border-border rounded-xl px-4 py-3" onClick={()=>{cancel();setStep(0);setFeedback("")}}>{t("Сначала")}</button>
    </div>
    <p className="text-sm text-foreground/65">{t("Подсказки приблизительные. Принятая черта заменяется образцом. Это упражнение не оценивает качество почерка; результат не сохраняется в аккаунте.")}</p>
  </section>
}
