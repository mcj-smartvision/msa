import { toGregorian, toJalaali } from 'jalaali-js'
import { inclusiveDayCount } from '@/features/schedule/lib/monthly-deducted-weight'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'

export const TOMAN_SCALE = 1_000_000

export type OverheadMonthAmount = {
  startIso: string
  endIso: string
  label: string
  amountToman: number
}

export type ContractorActivityCost = {
  id: string
  contractValue: number
  currentPercent: number
  start: string | null
  finish: string | null
  progressHistory: Array<{ date: string; percent: number }>
}

export type LiveCostBreakdownRow = {
  id: string
  kind: 'overhead-exact' | 'overhead-estimate' | 'contractor'
  title: string
  source: string
  amount: number
  note: string
}

export type LiveWorkshopCostModel = {
  asOfIso: string
  overheadExact: number
  overheadEstimated: number
  overhead: number
  contractor: number
  total: number
  breakdown: LiveCostBreakdownRow[]
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function jalaliMonthStartIso(todayIso: string): string | null {
  const day = toIsoDateOnly(todayIso)
  if (!day) return null
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return null
  const { jy, jm } = toJalaali(y, m, d)
  const start = toGregorian(jy, jm, 1)
  return `${start.gy}-${String(start.gm).padStart(2, '0')}-${String(start.gd).padStart(2, '0')}`
}

function jalaliMonthEndIso(todayIso: string): string | null {
  const day = toIsoDateOnly(todayIso)
  if (!day) return null
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return null
  const { jy, jm } = toJalaali(y, m, d)
  const next = jm === 12 ? toGregorian(jy + 1, 1, 1) : toGregorian(jy, jm + 1, 1)
  const endUtc = Date.UTC(next.gy, next.gm - 1, next.gd) - 86_400_000
  const end = new Date(endUtc)
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`
}

/** Overhead months that ended before the current Jalali month began, oldest first. */
function closedOverheadMonths(
  months: OverheadMonthAmount[],
  todayIso: string
): OverheadMonthAmount[] {
  const currentStart = jalaliMonthStartIso(todayIso)
  if (!currentStart) return []
  return months
    .filter((month) => month.endIso && month.endIso < currentStart)
    .sort((a, b) => a.endIso.localeCompare(b.endIso))
}

/** Amount of the most recent closed month that has a non-zero overhead (used as the estimate basis). */
export function lastClosedOverheadAmount(
  months: OverheadMonthAmount[],
  todayIso: string
): number {
  const closed = closedOverheadMonths(months, todayIso)
  for (let i = closed.length - 1; i >= 0; i -= 1) {
    if (closed[i]!.amountToman > 0) return closed[i]!.amountToman
  }
  return 0
}

function currentMonthTitle(todayIso: string): string {
  const day = toIsoDateOnly(todayIso)
  if (!day) return ''
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return ''
  const { jy, jm } = toJalaali(y, m, d)
  const names = [
    'فروردین',
    'اردیبهشت',
    'خرداد',
    'تیر',
    'مرداد',
    'شهریور',
    'مهر',
    'آبان',
    'آذر',
    'دی',
    'بهمن',
    'اسفند',
  ]
  return `${names[jm - 1] ?? ''} ${jy}`.trim()
}

/** Closed months in full; open month = last closed month × elapsed/days. */
export function accrueOverheadAsOf(
  months: OverheadMonthAmount[],
  asOfIso: string,
  todayIso: string
): { exact: number; estimated: number } {
  const asOf = toIsoDateOnly(asOfIso)
  const today = toIsoDateOnly(todayIso)
  if (!asOf || !today) return { exact: 0, estimated: 0 }
  const currentStart = jalaliMonthStartIso(today)
  const currentEnd = jalaliMonthEndIso(today)
  if (!currentStart || !currentEnd) return { exact: 0, estimated: 0 }

  const exact = months.reduce((sum, month) => {
    if (!month.endIso || month.endIso >= currentStart) return sum
    return asOf >= month.endIso ? sum + month.amountToman : sum
  }, 0)

  if (asOf < currentStart) return { exact: roundMoney(exact), estimated: 0 }

  // The current month has no recorded amount yet, so estimate it pro rata from the last closed month.
  const elapsed = inclusiveDayCount(currentStart, asOf < today ? asOf : today)
  const length = inclusiveDayCount(currentStart, currentEnd)
  const fraction = length > 0 ? Math.min(1, elapsed / length) : 0
  const estimated = lastClosedOverheadAmount(months, today) * fraction
  return { exact: roundMoney(exact), estimated: roundMoney(estimated) }
}

/**
 * An activity's physical progress on a given date. Prefers the last recorded progress point on or
 * before that date; with no history, interpolates linearly from 0% at the start date to today's percent.
 */
export function progressPercentAsOf(
  activity: ContractorActivityCost,
  asOfIso: string,
  todayIso: string
): number {
  const asOf = toIsoDateOnly(asOfIso)
  const today = toIsoDateOnly(todayIso)
  if (!asOf || !today) return 0
  const start = toIsoDateOnly(activity.start)
  if (start && asOf < start) return 0

  const history = activity.progressHistory
    .map((point) => ({
      date: toIsoDateOnly(point.date) ?? '',
      percent: clampPercent(point.percent),
    }))
    .filter((point) => point.date && point.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (history.length > 0) return history[history.length - 1]!.percent

  const current = clampPercent(activity.currentPercent)
  if (asOf >= today) return current
  if (!start) return current
  const span = inclusiveDayCount(start, today)
  const done = inclusiveDayCount(start, asOf)
  if (span <= 0) return current
  return clampPercent(current * (done / span))
}

/** Value of contractor work done by a date: Σ contract value × progress on that date. */
export function contractorExecutedAsOf(
  activities: ContractorActivityCost[],
  asOfIso: string,
  todayIso: string
): number {
  return roundMoney(
    activities.reduce((sum, activity) => {
      const pct = progressPercentAsOf(activity, asOfIso, todayIso)
      return sum + activity.contractValue * (pct / 100)
    }, 0)
  )
}

export function buildLiveCostBreakdown(
  months: OverheadMonthAmount[],
  todayIso: string,
  contractor: number,
  activityCount: number
): LiveCostBreakdownRow[] {
  const today = toIsoDateOnly(todayIso) ?? todayIso
  const accrued = accrueOverheadAsOf(months, today, today)
  const currentStart = jalaliMonthStartIso(today)
  const currentEnd = jalaliMonthEndIso(today)
  const closed = closedOverheadMonths(months, today)
  const lastClosed = [...closed].reverse().find((month) => month.amountToman > 0)
  const rows: LiveCostBreakdownRow[] = closed.map((month) => ({
    id: `oh-${month.startIso}`,
    kind: 'overhead-exact',
    title: `بالاسری ${month.label}`,
    source: 'جدول هزینه بالاسری کارگاه',
    amount: month.amountToman,
    note: 'ماه بسته — مبلغ ثبت‌شده همان ماه',
  }))
  if (accrued.estimated > 0 && currentStart && currentEnd) {
    const elapsed = inclusiveDayCount(currentStart, today)
    const length = inclusiveDayCount(currentStart, currentEnd)
    rows.push({
      id: 'oh-estimate',
      kind: 'overhead-estimate',
      title: `بالاسری ${currentMonthTitle(today)} (برآورد)`,
      source: 'نسبت از آخرین ماه بسته',
      amount: accrued.estimated,
      note: lastClosed
        ? `${elapsed} روز از ${length} روز × ${lastClosed.label} (${Math.round(lastClosed.amountToman).toLocaleString('en-US')})`
        : `${elapsed} روز از ${length} روز این ماه`,
    })
  }
  rows.push({
    id: 'contractor',
    kind: 'contractor',
    title: 'کارکرد پیمانکاران',
    source: 'مقدار × قیمت واحد × پیشرفت فیزیکی',
    amount: contractor,
    note:
      activityCount > 0
        ? `${activityCount} فعالیت برگ — از گزارش پیشرفت سرپرست`
        : 'فعالیت قیمت‌دار ثبت نشده است',
  })
  return rows
}

/** Today's live workshop cost = accrued overhead (exact + estimated) + executed contractor work. */
export function buildLiveWorkshopCostModel(input: {
  overheadMonths: OverheadMonthAmount[]
  activities: ContractorActivityCost[]
  todayIso: string
}): LiveWorkshopCostModel {
  const todayIso = toIsoDateOnly(input.todayIso) ?? input.todayIso
  const overhead = accrueOverheadAsOf(input.overheadMonths, todayIso, todayIso)
  const contractor = contractorExecutedAsOf(input.activities, todayIso, todayIso)
  const total = roundMoney(overhead.exact + overhead.estimated + contractor)
  return {
    asOfIso: todayIso,
    overheadExact: overhead.exact,
    overheadEstimated: overhead.estimated,
    overhead: roundMoney(overhead.exact + overhead.estimated),
    contractor,
    total,
    breakdown: buildLiveCostBreakdown(
      input.overheadMonths,
      todayIso,
      contractor,
      input.activities.length
    ),
  }
}
