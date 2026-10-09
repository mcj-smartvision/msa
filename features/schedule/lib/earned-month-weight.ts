export type ProgressSnapshotPoint = {
  snapshotMonth: string
  jalaliMonth: string
  cumulativePercent: number
}

export type EarnedMonthSlice = {
  jalaliMonth: string
  snapshotMonth: string
  percentThisMonth: number
  percentPreviousMonth: number
  earnedWeight: number
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

/**
 * Earned weight from reported progress only. Baseline finish is ignored.
 * For each snapshot in date order:
 *   earned = physical_weight × (this cumulative − previous cumulative) / 100
 * Previous is 0 on the first reported month. Months without a snapshot are omitted,
 * including months after baseline_finish when a report exists.
 */
export function earnedMonthlyWeights(
  physicalWeight: number | null | undefined,
  snapshots: ProgressSnapshotPoint[]
): EarnedMonthSlice[] {
  const weight =
    physicalWeight != null && Number.isFinite(Number(physicalWeight)) ? Number(physicalWeight) : 0
  if (weight === 0 || snapshots.length === 0) return []

  const ordered = [...snapshots].sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth))
  let previous = 0
  const slices: EarnedMonthSlice[] = []

  for (const snapshot of ordered) {
    const current = Math.min(100, Math.max(0, Number(snapshot.cumulativePercent) || 0))
    const delta = current - previous
    slices.push({
      jalaliMonth: snapshot.jalaliMonth,
      snapshotMonth: snapshot.snapshotMonth.slice(0, 10),
      percentThisMonth: current,
      percentPreviousMonth: previous,
      earnedWeight: round4((weight * delta) / 100),
    })
    previous = current
  }

  return slices
}

/**
 * Earned from supervisor daily reports.
 * A month with no report is null.
 * Otherwise earned = weight × (latest percent in that month − latest percent before that month) / 100.
 * The month before the first report counts as 0.
 */
export function earnedWeightsFromDailyReports(
  weight: number | null | undefined,
  entries: Array<{ reportDate: string; percentComplete: number }>,
  months: Array<{ startIso: string; endIso: string }>
): Array<number | null> {
  const factor =
    weight != null && Number.isFinite(Number(weight)) ? Number(weight) : 0
  const reports = entries
    .map((entry) => ({
      date: String(entry.reportDate ?? '').slice(0, 10),
      percent: Math.min(100, Math.max(0, Number(entry.percentComplete) || 0)),
    }))
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (factor === 0 || reports.length === 0) return months.map(() => null)

  return months.map((month) => {
    const inMonth = reports.filter((entry) => entry.date >= month.startIso && entry.date <= month.endIso)
    if (inMonth.length === 0) return null
    const current = inMonth[inMonth.length - 1]!.percent
    const earlier = reports.filter((entry) => entry.date < month.startIso)
    const previous = earlier.length > 0 ? earlier[earlier.length - 1]!.percent : 0
    return round4((factor * (current - previous)) / 100)
  })
}

/**
 * Earned weight of one activity = weight × physical progress / 100.
 * The total is spread over the months that already have planned weight,
 * in the same proportion, so the month columns still add up to that product.
 * A month with no planned weight stays empty.
 *
 * With `asOfMonthIndex` (the current month's column), only planned months up to and including
 * that column receive earned; later months are null. If none of those months has planned
 * weight, the whole earned lands in the as-of month.
 */
export function earnedWeightsFromPhysicalProgress(
  weight: number | null | undefined,
  physicalPercent: number | null | undefined,
  plannedByMonth: Array<number | null | undefined>,
  asOfMonthIndex?: number
): Array<number | null> {
  if (physicalPercent == null || !Number.isFinite(Number(physicalPercent))) {
    return plannedByMonth.map(() => null)
  }
  const factor = weight != null && Number.isFinite(Number(weight)) ? Number(weight) : 0
  const percent = Math.min(100, Math.max(0, Number(physicalPercent)))
  if (factor === 0) return plannedByMonth.map(() => null)

  const planned = plannedByMonth.map((value) =>
    value != null && Number(value) > 0 ? Number(value) : 0
  )
  const plannedSum = planned.reduce((sum, value) => sum + value, 0)
  if (plannedSum <= 0) return plannedByMonth.map(() => null)

  const target = round4((factor * percent) / 100)
  const lastIndex =
    asOfMonthIndex == null || !Number.isFinite(asOfMonthIndex)
      ? planned.length - 1
      : Math.min(planned.length - 1, Math.max(0, Math.floor(asOfMonthIndex)))
  const indexes = planned
    .map((value, index) => (value > 0 && index <= lastIndex ? index : -1))
    .filter((index) => index >= 0)
  const earned: Array<number | null> = planned.map((value, index) =>
    value > 0 && index <= lastIndex ? 0 : null
  )
  if (indexes.length === 0) {
    earned[lastIndex] = target
    return earned
  }
  const spreadSum = indexes.reduce((sum, index) => sum + planned[index]!, 0)
  let used = 0
  indexes.forEach((index, position) => {
    if (position === indexes.length - 1) {
      earned[index] = round4(target - used)
      return
    }
    const slice = round4((planned[index]! / spreadSum) * target)
    earned[index] = slice
    used = round4(used + slice)
  })
  return earned
}

/** Earned on a month grid. null means that month has no progress snapshot. */
export function earnedWeightsOnMonths(
  physicalWeight: number | null | undefined,
  snapshots: ProgressSnapshotPoint[],
  months: Array<{ startIso: string }>
): Array<number | null> {
  const slices = earnedMonthlyWeights(physicalWeight, snapshots)
  const byMonth = new Map(slices.map((slice) => [slice.snapshotMonth, slice.earnedWeight]))
  return months.map((month) => (byMonth.has(month.startIso) ? byMonth.get(month.startIso)! : null))
}
