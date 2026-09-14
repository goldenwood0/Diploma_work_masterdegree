import { z } from "zod"
import manifest from "../../public/strokes/manifest.json"

export const strokeSchema = z.object({
  strokes: z.array(z.string().min(1).max(30000).regex(/^[MmZzLlHhVvCcSsQqTtAa\d\s.,+\-]+$/)).min(1).max(64),
  medians: z.array(z.array(z.tuple([z.number().finite(), z.number().finite()])).min(2).max(1000)).min(1).max(64),
}).refine((value) => value.strokes.length === value.medians.length)
export type StrokeData = z.infer<typeof strokeSchema>
export function hasStrokes(character: string) {
  return manifest.characters.includes(character)
}
export async function getStrokes(character: string, signal: AbortSignal) {
  if (!hasStrokes(character)) return null
  const response = await fetch(`/strokes/${character.codePointAt(0)!.toString(16)}.json`, { signal })
  if (!response.ok) throw new Error("Stroke data unavailable")
  return strokeSchema.parse(await response.json())
}
