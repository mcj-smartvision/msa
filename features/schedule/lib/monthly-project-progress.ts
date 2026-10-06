export type MonthlyProjectProgressRow = {
  month: string
  plannedWeight: number
  earnedWeight: number | null
  plannedCumulative: number
  earnedCumulative: number | null
}

/**
 * Running totals for the S-curve.
 * planned_cumulative always sums planned_weight.
 * earned_cumulative stays null until the first month that has reported Earned,
 * then carries the running sum forward through later months.
 */
export function accumulateMonthlyProjectProgress(
  months: Array<{ month: string; plannedWeight: number; earnedWeight: number | null }>
): MonthlyProjectProgressRow[] {
  const ordered = [...months].sort((a, b) => a.month.localeCompare(b.month))
  let plannedCumulative = 0
  let earnedCumulative: number | null = null

  return ordered.map((row) => {
    const planned = Math.round((Number(row.plannedWeight) || 0) * 10000) / 10000
    plannedCumulative = Math.round((plannedCumulative + planned) * 10000) / 10000
    const earned =
      row.earnedWeight == null || !Number.isFinite(Number(row.earnedWeight))
        ? null
        : Math.round(Number(row.earnedWeight) * 10000) / 10000
    if (earned != null) {
      earnedCumulative = Math.round(((earnedCumulative ?? 0) + earned) * 10000) / 10000
    }
    return {
      month: row.month.slice(0, 10),
      plannedWeight: planned,
      earnedWeight: earned,
      plannedCumulative,
      earnedCumulative,
    }
  })
}
