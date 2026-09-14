export type StrokePoint = { x: number; y: number }
const distance = (a: StrokePoint, b: StrokePoint) => Math.hypot(a.x - b.x, a.y - b.y)
export function medianPoints(median: number[][]): StrokePoint[] {
  return median.map(([x, y]) => ({ x: x * 300 / 1024, y: (900 - y) * 300 / 1024 }))
}
function length(points: StrokePoint[]) {
  return points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0)
}
function sample(points: StrokePoint[], total: number) {
  const result: StrokePoint[] = []
  let index = 1, travelled = 0
  for (let i = 0; i < 24; i++) {
    const target = total * i / 23
    while (index < points.length - 1 && travelled + distance(points[index - 1], points[index]) < target) {
      travelled += distance(points[index - 1], points[index]); index++
    }
    const a = points[index - 1], b = points[index]
    const ratio = Math.min(1, Math.max(0, (target - travelled) / (distance(a, b) || 1)))
    result.push({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio })
  }
  return result
}
// Heuristic tracing aid in a fixed 300×300 coordinate system, not handwriting grading.
export function matchStroke(drawn: StrokePoint[], expected: StrokePoint[]): "accepted" | "direction" | "shape" {
  if (drawn.length < 2 || expected.length < 2 || drawn.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return "shape"
  const actualLength = length(drawn), expectedLength = length(expected)
  if (expectedLength < 1 || actualLength < expectedLength * 0.5 || actualLength > expectedLength * 1.8) return "shape"
  const actual = sample(drawn, actualLength), target = sample(expected, expectedLength)
  const matches = (candidate: StrokePoint[]) => {
    const errors = candidate.map((p, i) => distance(p, target[i]))
    return errors[0] <= 28 && errors[23] <= 28 && Math.max(...errors) <= 40 && errors.reduce((a,b)=>a+b,0) / errors.length <= 20
  }
  const reverse = [...actual].reverse()
  const forwardError = actual.reduce((sum,p,i)=>sum+distance(p,target[i]),0)
  const reverseError = reverse.reduce((sum,p,i)=>sum+distance(p,target[i]),0)
  if (reverseError + 24 < forwardError && matches(reverse)) return "direction"
  if (matches(actual)) return "accepted"
  return "shape"
}
