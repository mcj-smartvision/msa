import type { QcInspectableItem } from '@/lib/qc-engine/types'

function gridToken(item: QcInspectableItem) {
  const raw = (item.gridX || item.gridRef || '').trim().toUpperCase()
  const letter = raw.match(/[A-Z]/)?.[0]
  const number = raw.match(/\d+/)?.[0]
  return { letter, number, raw }
}

export function itemsInGridRange(items: QcInspectableItem[], from: string, to: string) {
  const start = from.trim().toUpperCase()
  const end = to.trim().toUpperCase()
  if (!start || !end) return items
  const startLetter = start.match(/[A-Z]/)?.[0]
  const endLetter = end.match(/[A-Z]/)?.[0]
  const startNum = start.match(/\d+/)?.[0]
  const endNum = end.match(/\d+/)?.[0]

  return items.filter((item) => {
    const token = gridToken(item)
    if (startLetter && endLetter && token.letter) {
      const lo = startLetter < endLetter ? startLetter : endLetter
      const hi = startLetter < endLetter ? endLetter : startLetter
      if (token.letter < lo || token.letter > hi) return false
    }
    if (startNum && endNum && token.number) {
      const a = Number(startNum)
      const b = Number(endNum)
      const n = Number(token.number)
      if (n < Math.min(a, b) || n > Math.max(a, b)) return false
    }
    return Boolean(token.letter || token.number || token.raw)
  })
}
