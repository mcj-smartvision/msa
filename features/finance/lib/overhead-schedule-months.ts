import { toGregorian } from 'jalaali-js'
import {
enumerateProjectJalaliMonths,
projectDateSpan,
type DeductedWeightMonth,
} from '@/features/schedule/lib/monthly-deducted-weight'
import type { ScheduleTreeNode } from '@/features/workshop/lib/types'

const JALALI_MONTHS_FA = [
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
] as const

const JALALI_MONTHS_EN = [
  'Farvardin',
  'Ordibehesht',
  'Khordad',
  'Tir',
  'Mordad',
  'Shahrivar',
  'Mehr',
  'Aban',
  'Azar',
  'Dey',
  'Bahman',
  'Esfand',
] as const

const MONTH_INDEX = new Map<string, number>([
  ...JALALI_MONTHS_FA.map((name, index) => [name, index + 1] as const),
  ...JALALI_MONTHS_EN.map((name, index) => [name, index + 1] as const),
])

export function parseOverheadMonthLabel(label: string): { jm: number; jy: number | null } | null {
  const parts = label.trim().split(/\s+/)
  const name = parts[0]
  if (!name) return null
  const jm = MONTH_INDEX.get(name)
  if (!jm) return null
  const yearToken = parts[1]
  const jy = yearToken && /^\d{4}$/.test(yearToken) ? Number(yearToken) : null
  return { jm, jy }
}

function flattenSchedule(nodes: ScheduleTreeNode[]): ScheduleTreeNode[] {
  const out: ScheduleTreeNode[] = []
  const walk = (list: ScheduleTreeNode[]) => {
    for (const node of list) {
      out.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return out
}

/** Jalali months covering the schedule editor dates (شروع/پایان), not a fixed Farvardin list. */
export function scheduleMonthsFromTree(nodes: ScheduleTreeNode[]): DeductedWeightMonth[] {
  const tasks = flattenSchedule(nodes).filter((node) => node.taskId)
  const editor = projectDateSpan(
    tasks.map((node) => ({
      startDate: node.startDate,
      finishDate: node.finishDate,
    }))
  )
  const span =
    editor.start && editor.finish
      ? editor
      : projectDateSpan(
          tasks.map((node) => ({
            startDate: node.task?.baseline_start ?? null,
            finishDate: node.task?.baseline_finish ?? null,
          }))
        )
  if (!span.start || !span.finish) return []
  return enumerateProjectJalaliMonths(span.start, span.finish)
}

/**
 * Place stored overhead amounts onto the schedule months.
 * A column labeled خرداد (or خرداد 1405) stays on that month; months the
 * schedule does not include are left out.
 */
export function alignAmountsToScheduleMonths(
  storedLabels: string[],
  amountsByRow: string[][],
  schedule: DeductedWeightMonth[]
): { labels: string[]; amountsByRow: string[][] } {
  const used = new Set<number>()
  const columnIndex = schedule.map(() => -1)

  const claim = (wantYear: boolean) => {
    schedule.forEach((month, scheduleIndex) => {
      if (columnIndex[scheduleIndex] >= 0) return
      const found = storedLabels.findIndex((label, index) => {
        if (used.has(index)) return false
        const parsed = parseOverheadMonthLabel(label)
        if (!parsed || parsed.jm !== month.jm) return false
        return wantYear ? parsed.jy === month.jy : parsed.jy == null
      })
      if (found < 0) return
      used.add(found)
      columnIndex[scheduleIndex] = found
    })
  }

  claim(true)
  claim(false)

  return {
    labels: schedule.map((month) => month.label),
    amountsByRow: amountsByRow.map((amounts) =>
      columnIndex.map((index) => (index >= 0 ? amounts[index] ?? '0' : '0'))
    ),
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function jalaliMonthBounds(jy: number, jm: number): { startIso: string; endIso: string } {
  const start = toGregorian(jy, jm, 1)
  const next = jm === 12 ? toGregorian(jy + 1, 1, 1) : toGregorian(jy, jm + 1, 1)
  const endUtc = Date.UTC(next.gy, next.gm - 1, next.gd) - 86_400_000
  const endDate = new Date(endUtc)
  return {
    startIso: `${start.gy}-${pad2(start.gm)}-${pad2(start.gd)}`,
    endIso: `${endDate.getUTCFullYear()}-${pad2(endDate.getUTCMonth() + 1)}-${pad2(endDate.getUTCDate())}`,
  }
}

/** A column the user named, including months outside the active schedule. */
export function deductedMonthFromLabel(
  label: string,
  index: number,
  yearFallback: number | null
): DeductedWeightMonth {
  const parsed = parseOverheadMonthLabel(label)
  const jy = parsed?.jy ?? yearFallback
  if (parsed && jy) {
    const bounds = jalaliMonthBounds(jy, parsed.jm)
    return {
      key: `${jy}-${pad2(parsed.jm)}-${index}`,
      label: label.trim() || `${JALALI_MONTHS_FA[parsed.jm - 1]} ${jy}`,
      jy,
      jm: parsed.jm,
      ...bounds,
    }
  }
  return {
    key: `custom-${index}`,
    label: label.trim() || '—',
    jy: 0,
    jm: 0,
    startIso: '',
    endIso: '',
  }
}

/** Copy stored amounts onto an explicit column list, keeping user-added months. */
export function takeAmountsForLabels(
  storedLabels: string[],
  amountsByRow: string[][],
  targetLabels: string[]
): string[][] {
  const used = new Set<number>()
  const columnIndex = targetLabels.map(() => -1)

  targetLabels.forEach((label, targetIndex) => {
    const found = storedLabels.findIndex(
      (stored, index) => !used.has(index) && stored.trim() === label.trim()
    )
    if (found < 0) return
    used.add(found)
    columnIndex[targetIndex] = found
  })

  targetLabels.forEach((label, targetIndex) => {
    if (columnIndex[targetIndex] >= 0) return
    const target = parseOverheadMonthLabel(label)
    if (!target) return
    const found = storedLabels.findIndex((stored, index) => {
      if (used.has(index)) return false
      const parsed = parseOverheadMonthLabel(stored)
      if (!parsed || parsed.jm !== target.jm) return false
      if (target.jy != null && parsed.jy != null) return parsed.jy === target.jy
      return true
    })
    if (found < 0) return
    used.add(found)
    columnIndex[targetIndex] = found
  })

  return amountsByRow.map((amounts) =>
    columnIndex.map((index) => (index >= 0 ? amounts[index] ?? '0' : '0'))
  )
}

/** Recorded overhead for each schedule month, matched by month name and year. */
export function overheadCostForScheduleMonths(
  labels: string[],
  totals: number[],
  months: DeductedWeightMonth[]
): number[] {
  const aligned = alignAmountsToScheduleMonths(
    labels,
    [totals.map((total) => String(total))],
    months
  )
  return aligned.amountsByRow[0]?.map((value) => Number(value) || 0) ?? months.map(() => 0)
}
