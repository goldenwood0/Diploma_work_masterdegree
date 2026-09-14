import { useRef, useState, type PointerEvent } from "react"
import { PenLine, Undo2, Trash2 } from "lucide-react"
import { useLanguage } from "../i18n/LanguageProvider"
import StrokeOrder from "./StrokeOrder"
import GuidedWriting from "./GuidedWriting"

type Point = {
  x: number
  y: number
}
const limit = 100

export default function CharacterPractice({ text }: { text: string }) {
  const { t } = useLanguage()
  const characters = [
    ...new Set(Array.from(text).filter((char) => /\p{Script=Han}/u.test(char))),
  ]
  const [selected, setSelected] = useState(0)
  const [guide, setGuide] = useState(true)
  const [strokes, setStrokes] = useState<Point[][]>([])
  const [current, setCurrent] = useState<Point[]>([])
  const [checked, setChecked] = useState(false)
  const pointer = useRef<number | null>(null)
  const points = useRef<Point[]>([])
  const svg = useRef<SVGSVGElement>(null)
  if (!characters.length) return null

  function finish(commit: boolean) {
    if (pointer.current === null) return
    const id = pointer.current
    pointer.current = null
    if (commit && points.current.length) {
      const stroke = points.current
      setStrokes((previous) =>
        previous.length < limit ? [...previous, stroke] : previous,
      )
    }
    points.current = []
    setCurrent([])
    if (svg.current?.hasPointerCapture(id))
      svg.current.releasePointerCapture(id)
  }
  function reset() {
    finish(false)
    setStrokes([])
    setChecked(false)
  }
  function point(event: PointerEvent<SVGSVGElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(
        0,
        Math.min(300, ((event.clientX - bounds.left) / bounds.width) * 300),
      ),
      y: Math.max(
        0,
        Math.min(300, ((event.clientY - bounds.top) / bounds.height) * 300),
      ),
    }
  }
  return (
    <section
      className="border border-border rounded-2xl p-5 space-y-4"
      aria-label={t("Практика письма")}
    >
      <h3 className="font-semibold text-lg flex gap-2 items-center">
        <PenLine aria-hidden="true" size={20} />
        {t("Практика письма")}
      </h3>
      <p>
        {t(
          "Выберите иероглиф и напишите его мышью, пальцем или стилусом. Скройте образец, чтобы писать по памяти.",
        )}
      </p>
      <label className="block space-y-2">
        <span>{t("Иероглиф для практики")}</span>
        <select
          value={selected}
          onChange={(event) => {
            reset()
            setSelected(Number(event.target.value))
          }}
          className="block rounded-xl border border-border bg-background px-4 py-2 text-2xl sc-text"
          lang="zh-CN"
        >
          {characters.map((character, index) => (
            <option key={character} value={index}>
              {character}
            </option>
          ))}
        </select>
      </label>
      <StrokeOrder key={characters[selected]} character={characters[selected]} />
      <GuidedWriting key={`guided-${characters[selected]}`} character={characters[selected]} />
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={guide}
          onChange={(event) => setGuide(event.target.checked)}
        />
        {t("Показать образец")}
      </label>
      <svg
        ref={svg}
        viewBox="0 0 300 300"
        role="img"
        aria-label={`${t("Поле для письма")}: ${characters[selected]}`}
        className="w-full max-w-80 aspect-square touch-none select-none rounded-xl border border-border bg-white text-dark-green mx-auto"
        onPointerDown={(event) => {
          if (
            pointer.current !== null ||
            !event.isPrimary ||
            event.button !== 0 ||
            strokes.length >= limit
          )
            return
          event.preventDefault()
          pointer.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          points.current = [point(event)]
          setCurrent(points.current)
          setChecked(false)
        }}
        onPointerMove={(event) => {
          if (
            pointer.current !== event.pointerId ||
            points.current.length >= 2000
          )
            return
          points.current = [...points.current, point(event)]
          setCurrent(points.current)
        }}
        onPointerUp={(event) => {
          if (pointer.current === event.pointerId) finish(true)
        }}
        onPointerCancel={(event) => {
          if (pointer.current === event.pointerId) finish(false)
        }}
        onLostPointerCapture={() => finish(false)}
      >
        <path
          d="M150 0V300M0 150H300M0 0L300 300M300 0L0 300"
          stroke="#d1d5db"
          strokeDasharray="5 5"
          fill="none"
        />
        {guide && (
          <text
            x="150"
            y="245"
            textAnchor="middle"
            fontSize="260"
            className="sc-text"
            fill="#d1d5db"
            lang="zh-CN"
          >
            {characters[selected]}
          </text>
        )}
        {[...strokes, current]
          .filter((stroke) => stroke.length)
          .map((stroke, index) =>
            stroke.length === 1 ? (
              <circle
                key={index}
                cx={stroke[0].x}
                cy={stroke[0].y}
                r="3"
                fill="currentColor"
              />
            ) : (
              <polyline
                key={index}
                points={stroke.map(({ x, y }) => `${x},${y}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ),
          )}
      </svg>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={!strokes.length}
          className="flex items-center gap-2 border border-border rounded-xl px-4 py-3 disabled:opacity-40"
          onClick={() => {
            finish(false)
            setStrokes((previous) => previous.slice(0, -1))
            setChecked(false)
          }}
        >
          <Undo2 aria-hidden="true" size={18} />
          {t("Отменить черту")}
        </button>
        <button
          disabled={!strokes.length && !current.length}
          className="flex items-center gap-2 border border-border rounded-xl px-4 py-3 disabled:opacity-40"
          onClick={reset}
        >
          <Trash2 aria-hidden="true" size={18} />
          {t("Очистить поле")}
        </button>
      </div>
      {strokes.length >= limit && (
        <p role="status">
          {t("Достигнут лимит 100 черт. Очистите поле для новой попытки.")}
        </p>
      )}
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        {t("Я сравнил форму и пропорции с образцом.")}
      </label>
      <p className="text-sm text-foreground/65">
        {t(
          "Можно также написать иероглиф на бумаге и сравнить с образцом. Рисунок и отметка не сохраняются после выхода из блока.",
        )}
      </p>
      <p className="text-sm text-foreground/65">
        {t(
          "Это свободное письмо с самопроверкой. Порядок черт и правильность написания автоматически не оцениваются.",
        )}
      </p>
    </section>
  )
}
