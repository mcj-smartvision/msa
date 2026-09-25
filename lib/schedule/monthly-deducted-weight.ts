import { toGregorian, toJalaali } from 'jalaali-js'
import { toIsoDateOnly } from '@/lib/schedule/dates'

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

export type DeductedWeightMonth = {
  key: string
  label: string
  jy: number
  jm: number
  startIso: string
  endIso: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isoParts(iso: string): { y: number; m: number; d: number } | null {
  const normalized = toIsoDateOnly(iso)
  if (!normalized) return null
  const [y, m, d] = normalized.split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

function isoToUtcDay(iso: string): number | null {
  const p = isoParts(iso)
  if (!p) return null
  return Date.UTC(p.y, p.m - 1, p.d)
}

export function inclusiveDayCount(startIso: string, finishIso: string): number {
  const a = isoToUtcDay(startIso)
  const b = isoToUtcDay(finishIso)
  if (a == null || b == null || b < a) return 0
  return Math.floor((b - a) / 86_400_000) + 1
}

function overlapInclusiveDays(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): number {
  const as = isoToUtcDay(aStart)
  const ae = isoToUtcDay(aEnd)
  const bs = isoToUtcDay(bStart)
  const be = isoToUtcDay(bEnd)
  if (as == null || ae == null || bs == null || be == null) return 0
  const start = Math.max(as, bs)
  const end = Math.min(ae, be)
  if (end < start) return 0
  return Math.floor((end - start) / 86_400_000) + 1
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

export function enumerateProjectJalaliMonths(
  projectStartIso: string | null | undefined,
  projectFinishIso: string | null | undefined
): DeductedWeightMonth[] {
  const startIso = toIsoDateOnly(projectStartIso)
  const finishIso = toIsoDateOnly(projectFinishIso)
  if (!startIso || !finishIso) return []

  const startParts = isoParts(startIso)
  const finishParts = isoParts(finishIso)
  if (!startParts || !finishParts) return []

  const startJ = toJalaali(startParts.y, startParts.m, startParts.d)
  const finishJ = toJalaali(finishParts.y, finishParts.m, finishParts.d)

  const out: DeductedWeightMonth[] = []
  let jy = startJ.jy
  let jm = startJ.jm

  for (let i = 0; i < 240; i++) {
    const { startIso: mStart, endIso: mEnd } = jalaliMonthBounds(jy, jm)
    out.push({
      key: `${jy}-${pad2(jm)}`,
      label: `${JALALI_MONTHS_FA[jm - 1]} ${jy}`,
      jy,
      jm,
      startIso: mStart,
      endIso: mEnd,
    })
    if (jy > finishJ.jy || (jy === finishJ.jy && jm >= finishJ.jm)) break
    if (jm === 12) {
      jy += 1
      jm = 1
    } else {
      jm += 1
    }
  }

  return out
}

export function monthlyDeductedWeights(
  weight: number | null | undefined,
  activityStartIso: string | null | undefined,
  activityFinishIso: string | null | undefined,
  months: DeductedWeightMonth[]
): number[] {
  const w = weight != null && Number.isFinite(Number(weight)) ? Number(weight) : 0
  const start = toIsoDateOnly(activityStartIso)
  const finish = toIsoDateOnly(activityFinishIso)
  if (w <= 0 || !start || !finish || months.length === 0) {
    return months.map(() => 0)
  }

  const duration = inclusiveDayCount(start, finish)
  if (duration <= 0) return months.map(() => 0)

  return months.map((month) => {
    const overlap = overlapInclusiveDays(start, finish, month.startIso, month.endIso)
    if (overlap <= 0) return 0
    return Math.round(((w * overlap) / duration) * 100) / 100
  })
}

export function projectDateSpan(
  rows: Array<{ startDate: string | null; finishDate: string | null }>
): { start: string | null; finish: string | null } {
  let start: string | null = null
  let finish: string | null = null
  for (const row of rows) {
    const s = toIsoDateOnly(row.startDate)
    const f = toIsoDateOnly(row.finishDate)
    if (s && (!start || s < start)) start = s
    if (f && (!finish || f > finish)) finish = f
  }
  return { start, finish }
}

export function formatDeductedWeight(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '—'
  return String(Math.round(value * 100) / 100)
}
