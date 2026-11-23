/// <reference types="vite/client" />
// Development-only fixture: open /scripts/writing-check.html on the Vite server.
// Uses real React rendering and handlers; synthetic pointers are NOT handwriting acceptance.
import { useState } from "react"
import { createRoot } from "react-dom/client"
import { flushSync } from "react-dom"
import CharacterPractice from "../src/components/CharacterPractice"
import manifest from "../src/api/strokeManifest.json"
import { medianPoints } from "../src/app/strokeMatching"
import "../src/index.css"

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
const wait = async (check: () => boolean) => {
  const until = Date.now() + 12000
  while (!check()) {
    if (Date.now() > until) throw new Error("Timed out waiting for component")
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
function App() {
  const [mounted, setMounted] = useState(true)
  const [key, setKey] = useState(0)
  const [result, setResult] = useState("Готово к проверке. Движения синтетические; почерк не оценивается.")
  const [running, setRunning] = useState(false)
  async function run() {
    setRunning(true)
    const passed: string[] = []
    const originalFetch = window.fetch
    try {
      const root = () => document.querySelector("#fixture")!
      const section = (name: string) => root().querySelector(`section[aria-label="${name}"]`)!
      const guided = () => section("Письмо по чертам")
      const field = () => guided().querySelector("svg")!
      const button = (parent: Element, text: string) => {
        const found = [...parent.querySelectorAll("button")].find(b => b.textContent === text)
        assert(found && !found.disabled, `Button unavailable: ${text}`)
        flushSync(() => found.click())
      }
      const select = async (index: number, ready = true) => {
        const input = root().querySelector("select")!
        flushSync(() => { input.value = String(index); input.dispatchEvent(new Event("change", { bubbles: true })) })
        if (ready && index < manifest.characters.length) await wait(() => !!guided())
      }
      const count = (n: number, total: number) => assert(field().getAttribute("aria-label")?.endsWith(`${n} / ${total}`), `Expected ${n}/${total}`)
      const draw = (svg: SVGSVGElement, points: { x: number, y: number }[], end = "pointerup") => {
        // Synthetic PointerEvents cannot obtain native capture. Only this fixture replaces it.
        const capture = new Set<number>()
        const descriptors = ["setPointerCapture", "hasPointerCapture", "releasePointerCapture"].map(k => Object.getOwnPropertyDescriptor(svg, k))
        svg.setPointerCapture = id => { capture.add(id) }
        svg.hasPointerCapture = id => capture.has(id)
        svg.releasePointerCapture = id => { capture.delete(id) }
        const rect = svg.getBoundingClientRect()
        const event = (type: string, p: {x: number, y: number}) => flushSync(() => svg.dispatchEvent(new PointerEvent(type, {
          bubbles: true, pointerId: 1, isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1,
          clientX: rect.left + p.x / 300 * rect.width, clientY: rect.top + p.y / 300 * rect.height,
        })))
        try {
          event("pointerdown", points[0])
          for (const p of points.slice(1, -1)) event("pointermove", p)
          event(end, points[points.length - 1])
        } finally {
          for (const [i, k] of ["setPointerCapture", "hasPointerCapture", "releasePointerCapture"].entries()) {
            if (descriptors[i]) Object.defineProperty(svg, k, descriptors[i]!)
            else delete (svg as unknown as Record<string, unknown>)[k]
          }
        }
      }
      flushSync(() => { setMounted(true); setKey(k => k + 1) })
      await wait(() => !!guided())
      assert(root().querySelectorAll("option").length === 15, "Unique Han characters")
      for (const [index, char] of manifest.characters.entries()) {
        await select(index)
        const data = await originalFetch(`/strokes/${char.codePointAt(0)!.toString(16)}.json`).then(r => r.json())
        const total = data.medians.length
        count(0, total)
        const first = medianPoints(data.medians[0])
        draw(field(), [...first].reverse()); count(0, total)
        assert(guided().textContent?.includes("обратном направлении"), `${char}: reverse feedback`)
        draw(field(), [{x: 0, y: 0}, {x: 1, y: 1}]); count(0, total)
        draw(field(), first, "pointercancel"); count(0, total)
        draw(field(), first, "lostpointercapture"); count(0, total)
        for (const [i, median] of data.medians.entries()) {
          draw(field(), medianPoints(median as number[][])); count(i + 1, total)
        }
        assert(guided().textContent?.includes("Все черты пройдены"), `${char}: completion message`)
        draw(field(), first); count(total, total)
        button(guided(), "Отменить черту"); count(total - 1, total)
        draw(field(), medianPoints(data.medians[total - 1])); count(total, total)
        button(guided(), "Сначала"); count(0, total)
        const hint = guided().querySelector("input")!
        flushSync(() => hint.click())
        assert(!guided().querySelector("circle"), "Hint hidden")
        draw(field(), first); count(1, total)
        passed.push(`${char}: полный цикл ${total}/${total}, ошибки, отмена, сброс, без подсказки`)
      }
      await select(14)
      assert(!guided() && root().textContent?.includes("пока не добавлен"), "Unsupported character fallback")
      const free = root().querySelector('svg[aria-label^="Поле для письма"]') as SVGSVGElement
      draw(free, [{x: 10, y: 20}, {x: 100, y: 120}])
      const line = free.querySelector('polyline')?.getAttribute('points')?.split(/[ ,]/).map(Number)
      assert(line?.length === 4 && line.every((n, i) => Math.abs(n - [10,20,100,120][i]) < .001), "Free writing must include pointerup endpoint")
      draw(free, [{x: 20, y: 30}, {x: 110, y: 130}])
      assert(free.querySelectorAll("polyline").length === 2, "Two free strokes")
      const selfCheck = root().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1]
      flushSync(() => selfCheck.click())
      assert(selfCheck.checked, "Self check enabled")
      button(root(), "Отменить черту")
      assert(free.querySelectorAll("polyline").length === 1 && !selfCheck.checked, "Undo only last stroke and clear self check")
      button(root(), "Очистить поле")
      assert(!free.querySelector("polyline"), "Free writing cleared")
      passed.push("Свободное письмо: последняя точка, отмена, самопроверка и очистка")
      // Force a network failure only for this fixture, then retry both real components.
      window.fetch = async (input, init) => {
        if (String(input).startsWith("/strokes/")) throw new Error("Fixture network failure")
        return originalFetch(input, init)
      }
      await select(0, false)
      await wait(() => root().querySelectorAll('[role="alert"]').length === 2)
      window.fetch = originalFetch
      for (const alert of [...root().querySelectorAll('[role="alert"]')]) button(alert, "Повторить")
      await wait(() => !!guided() && !!section("Порядок черт"))
      count(0, 7)
      passed.push("Ошибка сети и успешный повтор обоих компонентов")
      const order = () => section("Порядок черт")
      const orderCount = (n: number) => assert(order().querySelector("svg")?.getAttribute("aria-label") === `Черта: ${n} / 7`, "Order count")
      for (let i = 1; i <= 7; i++) { button(order(), "Следующая черта"); orderCount(i) }
      button(order(), "Предыдущая черта"); orderCount(6)
      button(order(), "Сначала"); orderCount(0)
      button(order(), "Показать по порядку")
      await wait(() => order().querySelector("svg")?.getAttribute("aria-label") === "Черта: 7 / 7")
      await wait(() => [...order().querySelectorAll("button")].some(b => b.textContent === "Показать по порядку"))
      passed.push("Порядок черт: шаги, назад, сброс, автоматическое завершение 7/7")
      flushSync(() => setMounted(false))
      assert(!root().querySelector("svg"), "Unmount")
      flushSync(() => setMounted(true))
      await wait(() => !!guided()); count(0, 7)
      passed.push("Выход и повторное открытие: прогресс сброшен")
      setResult(`PASS\n${passed.join("\n")}`)
    } catch (error) {
      setResult(`FAIL: ${String(error)}\n${passed.join("\n")}`)
    } finally {
      window.fetch = originalFetch
      setRunning(false)
    }
  }
  return <main className="max-w-3xl mx-auto p-5">
    <h1>Техническая проверка письма</h1>
    <button disabled={running} onClick={run} className="border p-3">Запустить проверки</button>
    <pre role="status" className="whitespace-pre-wrap">{result}</pre>
    <div id="fixture">{mounted && <CharacterPractice key={key} text={manifest.characters.join("") + "你龘abc"} />}</div>
  </main>
}
const root = createRoot(document.getElementById("root")!)
root.render(<App />)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
