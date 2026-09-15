import { useEffect, useState } from "react"
import { getCatalog } from "../api/learning"
import { getStats } from "../api/stats"
import { loadReviewSummary } from "../api/reviews"

async function load(signal: AbortSignal) {
  const [catalog, stats, reviews] = await Promise.all([
    getCatalog(signal),
    getStats(signal),
    loadReviewSummary(signal),
  ])
  return { catalog, stats, reviews }
}
export default function useStudyDashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof load>> | null>(
    null,
  )
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let controller: AbortController | undefined
    const refresh = () => {
      controller?.abort()
      const current = new AbortController()
      controller = current
      load(current.signal)
        .then((value) => {
          if (!current.signal.aborted) {
            setData(value)
            setError(false)
          }
        })
        .catch(() => {
          if (!current.signal.aborted) setError(true)
        })
    }
    refresh()
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener("focus", refresh)
    return () => {
      controller?.abort()
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [attempt])
  return {
    data,
    error,
    retry: () => {
      setData(null)
      setError(false)
      setAttempt((a) => a + 1)
    },
  }
}
