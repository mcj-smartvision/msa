/** Format MSP schedule_weight for display (percent-points, e.g. 0.06 or 1.85). */
export function formatScheduleWeightDisplay(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const v = Number(value)
  if (v <= 0) return '0'
  return `${v.toFixed(2).replace(/\.?0+$/, '')}%`
}

const PACKAGE_WEIGHT_NOTE_TAG = '\u001eSPW:'

/** Persist package weight in note when weight_percent column is missing in DB. */
export function encodePackageWeightInNote(
  note: string | null | undefined,
  weight: number | null | undefined
): string | null {
  const base = stripPackageWeightFromNote(note)
  if (weight == null || !Number.isFinite(weight)) return base || null
  const tag = `${PACKAGE_WEIGHT_NOTE_TAG}${weight}\u001e`
  return base ? `${base}${tag}` : tag
}

export function stripPackageWeightFromNote(note: string | null | undefined): string {
  if (!note) return ''
  return note.replace(/\u001eSPW:[\d.]+\u001e/g, '').trim()
}

export function decodePackageWeightFromNote(note: string | null | undefined): number | null {
  if (!note) return null
  const match = note.match(/\u001eSPW:([\d.]+)\u001e/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

export function resolvePackageWeight(row: Record<string, unknown>): number | null {
  if (row.weight_percent != null && Number.isFinite(Number(row.weight_percent))) {
    return Number(row.weight_percent)
  }
  return decodePackageWeightFromNote(row.note as string | null | undefined)
}
