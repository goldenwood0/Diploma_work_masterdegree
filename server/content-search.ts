// Explicit public learning fields only: never stringify arbitrary editor JSON.
export function searchableContent(blocks: Array<{ kind: string; content: unknown }>) {
  const values: string[] = []
  const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const add = (value: unknown) => { if (typeof value === "string") values.push(value) }
  const localized = (value: unknown) => { const fields = object(value); for (const language of ["ru", "kk", "en"]) add(fields[language]) }
  const phrase = (value: unknown) => {
    const fields = object(value)
    add(fields.hanzi); add(fields.pinyin); localized(fields.translation)
    // Remove only tone marks in pinyin; preserve ü and distinctions in ru/kk text.
    if (typeof fields.pinyin === "string") add(fields.pinyin.normalize("NFD").replace(/[\u0300\u0301\u0304\u030c]/g, "").normalize("NFC"))
  }
  for (const block of blocks) {
    if (!["vocabulary", "reading", "audio"].includes(block.kind)) continue
    const fields = object(block.content)
    localized(fields.title)
    if (block.kind === "vocabulary") {
      if (Array.isArray(fields.words)) fields.words.forEach(phrase)
    } else { phrase(fields); if (block.kind === "reading") localized(fields.text) }
  }
  return values.join("\n")
}
