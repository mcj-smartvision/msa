import type { DeductedWeightMonth } from '@/lib/schedule/monthly-deducted-weight'
import { toIsoDateOnly } from '@/lib/schedule/dates'

const DAY_MS = 86_400_000

function dayIndex(iso: string): number | null {
  const normalized = toIsoDateOnly(iso)
  if (!normalized) return null
  const [y, m, d] = normalized.split('-').map(Number)
  if (!y || !m || !d) return null
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}

/** Exclusive end of a Jalali month column (day after endIso). */
function monthEndExclusive(month: DeductedWeightMonth): number | null {
  const end = dayIndex(month.endIso)
  if (end == null) return null
  return end + 1
}

export type PlannedMonthSlice = {
  jalaliMonth: string
  snapshotMonth: string
  overlapDays: number
  share: number
  plannedWeight: number
}

/**
 * Planned weight from the activity's start and finish in the schedule editor.
 * Both dates count: a finish of Mordad 10 includes that day.
 * Each Jalali month gets weight × (days of the activity in that month ÷ total days).
 * A same-day span is one day.
 */
export function plannedMonthlyWeights(
  physicalWeight: number | null | undefined,
  baselineStart: string | null | undefined,
  baselineFinish: string | null | undefined,
  months: DeductedWeightMonth[]
): PlannedMonthSlice[] {
  const weight =
    physicalWeight != null && Number.isFinite(Number(physicalWeight))
      ? Number(physicalWeight)
      : 0
  const start = dayIndex(baselineStart ?? '')
  const finish = dayIndex(baselineFinish ?? '')
  if (start == null || finish == null || finish < start || weight === 0 || months.length === 0) {
    return []
  }

  const spanEnd = finish + 1
  const totalDays = spanEnd - start
  if (totalDays <= 0) return []

  const slices: PlannedMonthSlice[] = []
  for (const month of months) {
    const monthStart = dayIndex(month.startIso)
    const monthEnd = monthEndExclusive(month)
    if (monthStart == null || monthEnd == null) continue
    const overlap = Math.min(spanEnd, monthEnd) - Math.max(start, monthStart)
    if (overlap <= 0) continue
    const share = overlap / totalDays
    slices.push({
      jalaliMonth: `${month.jy}-${String(month.jm).padStart(2, '0')}-01`,
      snapshotMonth: month.startIso,
      overlapDays: overlap,
      share,
      plannedWeight: weight * share,
    })
  }

  if (slices.length === 0) return []

  const rounded = slices.map((slice) => ({
    ...slice,
    plannedWeight: Math.round(slice.plannedWeight * 10000) / 10000,
  }))
  const roundedSum = rounded.reduce((sum, slice) => sum + slice.plannedWeight, 0)
  const drift = Math.round((weight - roundedSum) * 10000) / 10000
  if (drift !== 0) {
    const last = rounded[rounded.length - 1]!
    last.plannedWeight = Math.round((last.plannedWeight + drift) * 10000) / 10000
  }
  return rounded
}

/** Align planned slices onto a fixed month column list (missing months are 0). */
export function plannedWeightsOnMonths(
  physicalWeight: number | null | undefined,
  baselineStart: string | null | undefined,
  baselineFinish: string | null | undefined,
  months: DeductedWeightMonth[]
): number[] {
  const slices = plannedMonthlyWeights(physicalWeight, baselineStart, baselineFinish, months)
  const byKey = new Map(slices.map((slice) => [slice.snapshotMonth, slice.plannedWeight]))
  return months.map((month) => byKey.get(month.startIso) ?? 0)
}
