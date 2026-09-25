import type { DeductedWeightMonth } from '@/lib/schedule/monthly-deducted-weight'
import { plannedMonthlyWeights } from '@/lib/schedule/planned-month-weight'

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/**
 * Monthly step from a cumulative series.
 * The month before the first is 0, so the first monthly value equals that month's cumulative.
 */
export function monthlyProgressFromCumulative(cumulative: number[]): number[] {
  let previous = 0
  return cumulative.map((current) => {
    const value = round4(current - previous)
    previous = current
    return value
  })
}

/** Carry the last reported cumulative forward. Months before the first report stay at 0. */
export function actualCumulativeFractions(cumulativePercentByMonth: Array<number | null>): number[] {
  let previous = 0
  return cumulativePercentByMonth.map((percent) => {
    if (percent == null) return previous
    previous = round4(clampPercent(percent) / 100)
    return previous
  })
}

/**
 * Split a month's overhead across activities.
 * When `total <= 0` the caller decides the fallback; this returns zeros so it never divides by zero.
 * The last non-zero part absorbs rounding drift so the pieces sum to `cost`.
 */
export function allocateOverhead(cost: number, parts: number[]): number[] {
  const total = parts.reduce((sum, part) => sum + part, 0)
  if (!Number.isFinite(cost) || cost === 0 || !(total > 0)) {
    return parts.map(() => 0)
  }
  const amounts = parts.map((part) => round4(cost * (part / total)))
  const drift = round4(cost - amounts.reduce((sum, amount) => sum + amount, 0))
  if (drift !== 0) {
    let index = amounts.length - 1
    for (let i = amounts.length - 1; i >= 0; i--) {
      if (parts[i] !== 0) {
        index = i
        break
      }
    }
    amounts[index] = round4((amounts[index] ?? 0) + drift)
  }
  return amounts
}

export type ActivityProgressInput = {
  activityId: string
  /** Activity weight. Monthly weight = weightFactor × monthly progress (progress is a 0–1 fraction). */
  weightFactor: number
  start: string | null
  finish: string | null
  /** Cumulative physical percent (0–100) for months that have a snapshot. */
  actualCumulativePercent: Array<number | null>
}

export type ActivityMonthValue = {
  activityId: string
  month: string
  weightFactor: number
  cumulativePlannedProgress: number
  plannedMonthlyProgress: number
  plannedWeightMonth: number
  cumulativeActualProgress: number
  actualMonthlyProgress: number
  earnedWeightMonth: number
  monthlyOverheadCost: number
  plannedActivityOverhead: number
  actualActivityOverhead: number
}

export type ProjectMonthValue = {
  month: string
  totalPlannedWeightMonth: number
  totalEarnedWeightMonth: number
  monthlyOverheadCost: number
  plannedOverhead: number
  actualOverhead: number
}

function plannedCumulativeFractions(
  weightFactor: number,
  start: string | null,
  finish: string | null,
  months: DeductedWeightMonth[]
): number[] {
  const slices = plannedMonthlyWeights(weightFactor === 0 ? 1 : weightFactor, start, finish, months)
  const shareByMonth = new Map(slices.map((slice) => [slice.snapshotMonth, slice.share]))
  let cumulative = 0
  return months.map((month) => {
    cumulative = round4(cumulative + (shareByMonth.get(month.startIso) ?? 0))
    return cumulative
  })
}

function weightsFromProgress(weightFactor: number, monthlyProgress: number[]): number[] {
  const weights = monthlyProgress.map((progress) => round4(weightFactor * progress))
  const progressSum = round4(monthlyProgress.reduce((sum, progress) => sum + progress, 0))
  if (Math.abs(progressSum - 1) > 0.0001) return weights
  const drift = round4(weightFactor - weights.reduce((sum, weight) => sum + weight, 0))
  if (drift !== 0 && weightFactor !== 0) {
    let index = weights.length - 1
    for (let i = weights.length - 1; i >= 0; i--) {
      if (monthlyProgress[i] !== 0) {
        index = i
        break
      }
    }
    weights[index] = round4((weights[index] ?? 0) + drift)
  }
  return weights
}

/**
 * Planned and earned month values plus overhead allocated by those weights.
 * Summaries must be excluded by the caller so a parent is not counted twice.
 * Actual overhead uses earned weight. When the month's earned total is 0, it
 * falls back to the planned split so the cost is still comparable. When the
 * planned total is also 0, every activity gets 0.
 */
export function buildProgressAndOverhead(
  activities: ActivityProgressInput[],
  months: DeductedWeightMonth[],
  overheadCostByMonth: Array<number | null | undefined>
): { activities: ActivityMonthValue[]; totals: ProjectMonthValue[] } {
  const plannedProgress = activities.map((activity) => {
    const cumulative = plannedCumulativeFractions(
      activity.weightFactor,
      activity.start,
      activity.finish,
      months
    )
    const monthly = monthlyProgressFromCumulative(cumulative)
    return {
      cumulative,
      monthly,
      weights: weightsFromProgress(activity.weightFactor, monthly),
    }
  })

  const actualProgress = activities.map((activity) => {
    const cumulative = actualCumulativeFractions(activity.actualCumulativePercent)
    const monthly = monthlyProgressFromCumulative(cumulative)
    return {
      cumulative,
      monthly,
      weights: weightsFromProgress(activity.weightFactor, monthly),
    }
  })

  const totals: ProjectMonthValue[] = months.map((month, index) => ({
    month: month.startIso,
    totalPlannedWeightMonth: round4(
      plannedProgress.reduce((sum, row) => sum + (row.weights[index] ?? 0), 0)
    ),
    totalEarnedWeightMonth: round4(
      actualProgress.reduce((sum, row) => sum + (row.weights[index] ?? 0), 0)
    ),
    monthlyOverheadCost: Number(overheadCostByMonth[index]) || 0,
    plannedOverhead: 0,
    actualOverhead: 0,
  }))

  const plannedOverheadByActivity = activities.map(() => [] as number[])
  const actualOverheadByActivity = activities.map(() => [] as number[])

  months.forEach((_, index) => {
    const cost = totals[index]?.monthlyOverheadCost ?? 0
    const plannedParts = plannedProgress.map((row) => row.weights[index] ?? 0)
    const earnedParts = actualProgress.map((row) => row.weights[index] ?? 0)
    const plannedSplit = allocateOverhead(cost, plannedParts)
    const earnedTotal = totals[index]?.totalEarnedWeightMonth ?? 0
    const actualSplit =
      earnedTotal > 0 ? allocateOverhead(cost, earnedParts) : plannedSplit.slice()
    plannedSplit.forEach((amount, activityIndex) => {
      plannedOverheadByActivity[activityIndex]?.push(amount)
    })
    actualSplit.forEach((amount, activityIndex) => {
      actualOverheadByActivity[activityIndex]?.push(amount)
    })
    if (totals[index]) {
      totals[index].plannedOverhead = round4(plannedSplit.reduce((sum, amount) => sum + amount, 0))
      totals[index].actualOverhead = round4(actualSplit.reduce((sum, amount) => sum + amount, 0))
    }
  })

  const rows: ActivityMonthValue[] = []
  activities.forEach((activity, activityIndex) => {
    months.forEach((month, index) => {
      rows.push({
        activityId: activity.activityId,
        month: month.startIso,
        weightFactor: activity.weightFactor,
        cumulativePlannedProgress: plannedProgress[activityIndex]?.cumulative[index] ?? 0,
        plannedMonthlyProgress: plannedProgress[activityIndex]?.monthly[index] ?? 0,
        plannedWeightMonth: plannedProgress[activityIndex]?.weights[index] ?? 0,
        cumulativeActualProgress: actualProgress[activityIndex]?.cumulative[index] ?? 0,
        actualMonthlyProgress: actualProgress[activityIndex]?.monthly[index] ?? 0,
        earnedWeightMonth: actualProgress[activityIndex]?.weights[index] ?? 0,
        monthlyOverheadCost: totals[index]?.monthlyOverheadCost ?? 0,
        plannedActivityOverhead: plannedOverheadByActivity[activityIndex]?.[index] ?? 0,
        actualActivityOverhead: actualOverheadByActivity[activityIndex]?.[index] ?? 0,
      })
    })
  })

  return { activities: rows, totals }
}
