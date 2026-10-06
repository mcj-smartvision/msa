import { toGregorian, toJalaali } from 'jalaali-js'
import { plannedPercentAsOf, safeRatio } from '@/features/evm/lib/metrics'
import { faDigits, faNumber } from '@/features/manager/lib/format'
import { tehranDateIso, tehranMidnight, tehranParts } from '@/shared/lib/time/tehran'
import type {
ComparisonCause,
ComparisonChartPoint,
ComparisonMetric,
ComparisonPointDetail,
ComparisonValue,
ComparisonVerdict,
ComparisonWindow,
ManagerPeriod,
PeriodComparison,
} from '@/features/manager/lib/overview-types'

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

const WEEKDAYS_FROM_SATURDAY = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
const JALALI_MONTHS = [
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

/* ------------------------------------------------------------ Tehran time */

export { tehranDateIso, tehranParts }

/** 31 days for months 1–6, 30 for 7–11, 29 or 30 for Esfand. */
export function jalaaliMonthLength(jy: number, jm: number): number {
  const start = toGregorian(jy, jm, 1)
  const next = jm === 12 ? toGregorian(jy + 1, 1, 1) : toGregorian(jy, jm + 1, 1)
  return Math.round((Date.UTC(next.gy, next.gm - 1, next.gd) - Date.UTC(start.gy, start.gm - 1, start.gd)) / DAY_MS)
}

function clockLabel(ms: number): string {
  const p = tehranParts(ms)
  const h = Math.floor(p.msOfDay / HOUR_MS)
  const m = Math.floor((p.msOfDay % HOUR_MS) / 60_000)
  return faDigits(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
}

/* ---------------------------------------------------------------- Windows */

export interface WindowRange {
  start: number
  cutoff: number
  end: number
}

export interface PeriodWindows {
  period: ManagerPeriod
  unitMs: number
  current: WindowRange & { buckets: number }
  previous: WindowRange & { buckets: number }
  currentLabel: string
  previousLabel: string
}

/**
 * The current period up to `nowMs` and the previous period up to the same elapsed time:
 * yesterday at this clock time, last week on this weekday and time, or day n of last Jalali
 * month (clamped to its last day when last month is shorter).
 */
export function buildPeriodWindows(period: ManagerPeriod, nowMs: number): PeriodWindows {
  const p = tehranParts(nowMs)
  const todayStart = tehranMidnight(p.gy, p.gm, p.gd)
  const at = clockLabel(nowMs)

  if (period === 'today') {
    return {
      period,
      unitMs: HOUR_MS,
      current: { start: todayStart, cutoff: nowMs, end: todayStart + DAY_MS, buckets: 24 },
      previous: { start: todayStart - DAY_MS, cutoff: nowMs - DAY_MS, end: todayStart, buckets: 24 },
      currentLabel: `امروز تا ${at}`,
      previousLabel: `دیروز تا ${at}`,
    }
  }

  if (period === 'week') {
    const start = todayStart - p.weekday * DAY_MS
    const elapsed = nowMs - start
    const weekday = WEEKDAYS_FROM_SATURDAY[p.weekday]
    return {
      period,
      unitMs: DAY_MS,
      current: { start, cutoff: nowMs, end: start + 7 * DAY_MS, buckets: 7 },
      previous: { start: start - 7 * DAY_MS, cutoff: start - 7 * DAY_MS + elapsed, end: start, buckets: 7 },
      currentLabel: `هفتهٔ جاری تا ${weekday} ${at}`,
      previousLabel: `هفتهٔ قبل تا ${weekday} ${at}`,
    }
  }

  const { jy, jm, jd } = toJalaali(p.gy, p.gm, p.gd)
  const monthStartG = toGregorian(jy, jm, 1)
  const start = tehranMidnight(monthStartG.gy, monthStartG.gm, monthStartG.gd)
  const length = jalaaliMonthLength(jy, jm)
  const prevJy = jm === 1 ? jy - 1 : jy
  const prevJm = jm === 1 ? 12 : jm - 1
  const prevStartG = toGregorian(prevJy, prevJm, 1)
  const prevStart = tehranMidnight(prevStartG.gy, prevStartG.gm, prevStartG.gd)
  const prevLength = jalaaliMonthLength(prevJy, prevJm)
  const prevEnd = prevStart + prevLength * DAY_MS
  const prevCutoff = Math.min(prevStart + (nowMs - start), prevEnd)
  const prevDay = Math.min(jd, prevLength)
  return {
    period,
    unitMs: DAY_MS,
    current: { start, cutoff: nowMs, end: start + length * DAY_MS, buckets: length },
    previous: { start: prevStart, cutoff: prevCutoff, end: prevEnd, buckets: prevLength },
    currentLabel: `${JALALI_MONTHS[jm - 1]} تا روز ${faNumber(jd)}، ${at}`,
    previousLabel: `${JALALI_MONTHS[prevJm - 1]} تا روز ${faNumber(prevDay)}${prevDay < jd ? ' (پایان ماه)' : `، ${at}`}`,
  }
}

/* ------------------------------------------------------- Activity history */

export interface ActivityHistory {
  id: string
  name: string
  kind: 'task' | 'package'
  weight: number
  budget: number
  baselineStart: string | null
  baselineFinish: string | null
  /** Current percent — the value the EVM cards use. */
  currentPercent: number
  /** Recorded progress, ascending by time. */
  history: { at: number; percent: number }[]
}

/**
 * Percent complete at an instant. At or after `nowMs` it is the current value. A task before
 * its first report is 0 (as in the 24-hour card); a package before its first snapshot keeps
 * its current value, because package history is only recorded from migration 99 onward.
 */
export function percentAt(a: ActivityHistory, t: number, nowMs: number): number {
  if (t >= nowMs || a.history.length === 0) return a.currentPercent
  if (t < a.history[0].at) return a.kind === 'package' ? a.currentPercent : 0
  let value = a.history[0].percent
  for (const row of a.history) {
    if (row.at > t) break
    value = row.percent
  }
  return value
}

/**
 * Like `percentAt`, but a task before its first report keeps that first reported value, so a
 * window reaching back before recorded history shows no invented gain — only recorded changes.
 */
function percentFromRecords(a: ActivityHistory, t: number, nowMs: number): number {
  if (a.kind === 'task' && a.history.length > 0 && t < a.history[0].at && t < nowMs) return a.history[0].percent
  return percentAt(a, t, nowMs)
}

function physicalFromRecords(activities: ActivityHistory[], t: number, nowMs: number): number | null {
  const rows = weighted(activities)
  const total = rows.reduce((s, a) => s + a.weight, 0)
  if (total <= 0) return null
  return rows.reduce((s, a) => s + a.weight * percentFromRecords(a, t, nowMs), 0) / total
}

function weighted(activities: ActivityHistory[]): ActivityHistory[] {
  return activities.filter((a) => a.weight > 0)
}

/** Weighted approved physical progress — the «پیشرفت تجمعی» basis (`actualPercentOf`). */
export function physicalAt(activities: ActivityHistory[], t: number, nowMs: number): number | null {
  const rows = weighted(activities)
  const total = rows.reduce((s, a) => s + a.weight, 0)
  if (total <= 0) return null
  return rows.reduce((s, a) => s + a.weight * percentAt(a, t, nowMs), 0) / total
}

/**
 * Weighted baseline plan at an instant. `plannedPercentAsOf` counts whole days, so the day in
 * progress is interpolated linearly by the clock; at midnight both agree.
 */
export function plannedPhysicalAt(activities: ActivityHistory[], t: number): number | null {
  const rows = weighted(activities)
  const total = rows.reduce((s, a) => s + a.weight, 0)
  if (total <= 0) return null
  const today = tehranDateIso(t)
  const yesterday = tehranDateIso(t - DAY_MS)
  const fraction = tehranParts(t).msOfDay / DAY_MS
  let sum = 0
  for (const a of rows) {
    const before = plannedPercentAsOf(a.baselineStart, a.baselineFinish, yesterday)
    const after = plannedPercentAsOf(a.baselineStart, a.baselineFinish, today)
    sum += a.weight * (before + (after - before) * fraction)
  }
  return sum / total
}

/**
 * Earned % ÷ planned % on schedule weights (budgets when no activity is weighted) with whole-day
 * plan — identical to the SPI card at now.
 */
export function spiAt(activities: ActivityHistory[], t: number, nowMs: number): number | null {
  const asOf = tehranDateIso(t)
  const useWeights = activities.some((a) => a.weight > 0)
  let earned = 0
  let planned = 0
  for (const a of activities) {
    const w = useWeights ? a.weight : a.budget
    if (!(w > 0)) continue
    earned += w * percentAt(a, t, nowMs)
    planned += w * plannedPercentAsOf(a.baselineStart, a.baselineFinish, asOf)
  }
  return safeRatio(earned, planned)
}

function completedBetween(activities: ActivityHistory[], from: number, to: number, nowMs: number): number {
  let n = 0
  for (const a of activities) {
    if (percentAt(a, from, nowMs) < 100 && percentAt(a, to, nowMs) >= 100) n += 1
  }
  return n
}

function overdueAt(activities: ActivityHistory[], t: number, nowMs: number): number {
  const day = tehranDateIso(t)
  let n = 0
  for (const a of activities) {
    const finish = (a.baselineFinish ?? a.baselineStart)?.slice(0, 10)
    if (finish && finish < day && percentAt(a, t, nowMs) < 100) n += 1
  }
  return n
}

/** First recorded task progress report; tasks before it would read as an assumed 0%. */
export function progressHistoryStart(activities: ActivityHistory[]): number | null {
  let first: number | null = null
  for (const a of activities) {
    if (a.kind !== 'task' || a.history.length === 0) continue
    if (first == null || a.history[0].at < first) first = a.history[0].at
  }
  return first
}

export function jalaliDayLabel(ms: number): string {
  const p = tehranParts(ms)
  const { jy, jm, jd } = toJalaali(p.gy, p.gm, p.gd)
  return `${faNumber(jd)} ${JALALI_MONTHS[jm - 1]} ${faDigits(String(jy))}`
}

function reportsBetween(activities: ActivityHistory[], from: number, to: number): number {
  let n = 0
  for (const a of activities) for (const row of a.history) if (row.at > from && row.at <= to) n += 1
  return n
}

function topActivities(activities: ActivityHistory[], from: number, to: number, nowMs: number) {
  return activities
    .map((a) => ({ name: a.name, deltaPercent: percentAt(a, to, nowMs) - percentAt(a, from, nowMs), weight: a.weight }))
    .filter((a) => a.deltaPercent > 0)
    .sort((a, b) => b.deltaPercent * Math.max(b.weight, 1) - a.deltaPercent * Math.max(a.weight, 1))
    .slice(0, 3)
    .map(({ name, deltaPercent }) => ({ name, deltaPercent }))
}

/* ------------------------------------------------------------ Attendance */

export interface TransitRow {
  person: string
  at: number
}

/** Distinct people who entered between the start of the Tehran day of `to` and `to`. */
function presentOnDay(transits: TransitRow[], to: number): number {
  const p = tehranParts(to - 1)
  const dayStart = tehranMidnight(p.gy, p.gm, p.gd)
  const people = new Set<string>()
  for (const row of transits) if (row.at >= dayStart && row.at <= to) people.add(row.person)
  return people.size
}

/** Average daily headcount over the days of the window up to its cutoff. */
function averageHeadcount(transits: TransitRow[], range: WindowRange): ComparisonValue {
  const inWindow = transits.filter((r) => r.at >= range.start && r.at <= range.cutoff)
  if (inWindow.length === 0) return { state: 'not_reported', reason: 'ترددی در این بازه ثبت نشده است' }
  let total = 0
  let days = 0
  for (let dayStart = range.start; dayStart < range.cutoff; dayStart += DAY_MS) {
    total += presentOnDay(inWindow, Math.min(dayStart + DAY_MS, range.cutoff))
    days += 1
  }
  return { state: 'ok', value: days > 0 ? total / days : 0 }
}

/* ---------------------------------------------------------------- Issues */

export interface IssueEvent {
  at: number
  type: 'ncr' | 'safety' | 'stoppage'
}

export const ISSUE_TYPE_LABELS: Record<IssueEvent['type'], string> = {
  ncr: 'عدم انطباق (NCR)',
  safety: 'ایمنی (HSE)',
  stoppage: 'توقف کارگاه',
}

function issuesBetween(events: IssueEvent[], from: number, to: number): IssueEvent[] {
  return events.filter((e) => e.at > from && e.at <= to)
}

/* ------------------------------------------------------------- Comparing */

const UNIT_DECIMALS: Record<ComparisonMetric['unit'], number> = { points: 1, index: 2, people: 1, count: 0 }

export function compareValues(
  current: ComparisonValue,
  previous: ComparisonValue,
  higherIsBetter: boolean,
  unit: ComparisonMetric['unit']
): { verdict: ComparisonVerdict; changePercent: number | null } {
  if (current.state !== 'ok' || previous.state !== 'ok') return { verdict: 'neutral', changePercent: null }
  const scale = 10 ** UNIT_DECIMALS[unit]
  const c = Math.round(current.value * scale) / scale
  const p = Math.round(previous.value * scale) / scale
  const changePercent = p !== 0 ? ((c - p) / Math.abs(p)) * 100 : null
  if (c === p) return { verdict: 'same', changePercent: p !== 0 ? 0 : null }
  return { verdict: c > p === higherIsBetter ? 'better' : 'worse', changePercent }
}

function metric(
  base: Omit<ComparisonMetric, 'verdict' | 'changePercent'>
): ComparisonMetric {
  return { ...base, ...compareValues(base.current, base.previous, base.higherIsBetter, base.unit) }
}

/* ------------------------------------------------------------------ Build */

export interface SourceState {
  available: boolean
  reason: string
}

export interface PeriodComparisonInput {
  projectId: string
  period: ManagerPeriod
  nowMs: number
  activities: ActivityHistory[]
  /** Progress history could be read (task_progress_updates). */
  progressSource: SourceState
  transits: TransitRow[] | null
  issues: { events: IssueEvent[]; checked: string[] } | null
  causes: ComparisonCause[] | null
  warnings: string[]
}

const NO_REPORT = 'گزارش پیشرفتی در این بازه ثبت نشده است'

export function buildPeriodComparison(input: PeriodComparisonInput): PeriodComparison {
  const { activities, nowMs } = input
  const w = buildPeriodWindows(input.period, nowMs)
  const windowOf = (range: WindowRange, label: string): ComparisonWindow => ({
    start: new Date(range.start).toISOString(),
    cutoff: new Date(range.cutoff).toISOString(),
    end: new Date(range.end).toISOString(),
    label,
  })

  const hasWeights = activities.some((a) => a.weight > 0)
  const hasBudgets = activities.some((a) => a.budget > 0)
  const hasBaseline = activities.some((a) => a.baselineFinish || a.baselineStart)
  const reported = {
    current: reportsBetween(activities, w.current.start, w.current.cutoff) > 0,
    previous: reportsBetween(activities, w.previous.start, w.previous.cutoff) > 0,
  }
  const range = { current: w.current, previous: w.previous }

  const historyStart = progressHistoryStart(activities)
  const beforeHistory: ComparisonValue = {
    state: 'not_reported',
    reason:
      historyStart == null
        ? 'تاریخچهٔ پیشرفت هنوز ثبت نشده است'
        : `تاریخچهٔ پیشرفت از ${jalaliDayLabel(historyStart)} ثبت شده است`,
  }
  /** Levels before the first recorded report would rest on an assumed 0% — never shown. */
  const knownAt = (t: number) => t >= nowMs || (historyStart != null && t >= historyStart)

  const progressValue = (side: 'current' | 'previous', compute: () => number | null): ComparisonValue => {
    const source = input.progressSource
    if (!source.available) return { state: 'unavailable', reason: source.reason }
    if (!knownAt(range[side].start)) return beforeHistory
    if (!reported[side]) return { state: 'not_reported', reason: NO_REPORT }
    const value = compute()
    return value == null ? { state: 'unavailable', reason: 'داده کافی نیست' } : { state: 'ok', value }
  }

  const level = (side: 'current' | 'previous') =>
    knownAt(range[side].cutoff) ? physicalAt(activities, range[side].cutoff, nowMs) : null
  const gain = (side: 'current' | 'previous') => {
    const end = physicalAt(activities, range[side].cutoff, nowMs)
    const start = physicalAt(activities, range[side].start, nowMs)
    return end == null || start == null ? null : end - start
  }

  const physical = metric({
    key: 'physical',
    label: 'پیشرفت فیزیکی',
    basis: 'پیشرفت وزنی تأییدشده (وزن فیزیکی فعالیت‌ها)؛ واحد درصد افزوده‌شده در بازه',
    unit: 'points',
    higherIsBetter: true,
    current: hasWeights
      ? progressValue('current', () => gain('current'))
      : { state: 'unavailable', reason: 'وزن فیزیکی فعالیت‌ها تعریف نشده است' },
    previous: hasWeights
      ? progressValue('previous', () => gain('previous'))
      : { state: 'unavailable', reason: 'وزن فیزیکی فعالیت‌ها تعریف نشده است' },
    levels: {
      current: level('current'),
      previous: level('previous'),
      planned: plannedPhysicalAt(activities, w.current.cutoff),
    },
  })

  const spiValue = (side: 'current' | 'previous'): ComparisonValue => {
    if (!hasBudgets) return { state: 'unavailable', reason: 'بودجهٔ فعالیت‌ها تعریف نشده است' }
    if (!knownAt(range[side].cutoff)) return beforeHistory
    const value = spiAt(activities, range[side].cutoff, nowMs)
    return value == null ? { state: 'unavailable', reason: 'ارزش برنامه‌ای (PV) در این زمان صفر است' } : { state: 'ok', value }
  }
  const spi = metric({
    key: 'spi',
    label: 'SPI',
    basis: 'پیشرفت کسب‌شده ÷ پیشرفت برنامه بر اساس وزن زمان‌بندی، در لحظهٔ پایان هر بازه',
    unit: 'index',
    higherIsBetter: true,
    current: spiValue('current'),
    previous: spiValue('previous'),
  })

  const headcountValue = (side: 'current' | 'previous'): ComparisonValue =>
    input.transits == null
      ? { state: 'unavailable', reason: 'سامانهٔ تردد در دسترس نیست' }
      : input.transits.length === 0
        ? { state: 'unavailable', reason: 'هنوز ترددی برای این پروژه ثبت نشده است' }
        : averageHeadcount(input.transits, range[side])
  const headcount = metric({
    key: 'headcount',
    label: 'نفرات حاضر (میانگین روزانه)',
    basis: 'افراد یکتا با ورود موفق در گیت، میانگین روزهای بازه تا همین ساعت',
    unit: 'people',
    higherIsBetter: true,
    current: headcountValue('current'),
    previous: headcountValue('previous'),
  })

  const completed = metric({
    key: 'completed',
    label: 'فعالیت تکمیل‌شده',
    basis: 'فعالیت‌هایی که پیشرفتشان در این بازه به ۱۰۰٪ رسید',
    unit: 'count',
    higherIsBetter: true,
    scaleMax: activities.length,
    current: progressValue('current', () => completedBetween(activities, w.current.start, w.current.cutoff, nowMs)),
    previous: progressValue('previous', () => completedBetween(activities, w.previous.start, w.previous.cutoff, nowMs)),
  })

  const overdueValue = (side: 'current' | 'previous'): ComparisonValue =>
    !hasBaseline
      ? { state: 'unavailable', reason: 'برنامهٔ مبنا (baseline) ثبت نشده است' }
      : !knownAt(range[side].cutoff)
        ? beforeHistory
        : { state: 'ok', value: overdueAt(activities, range[side].cutoff, nowMs) }
  const overdue = metric({
    key: 'overdue',
    label: 'فعالیت عقب‌افتاده',
    basis: 'فعالیت‌هایی که پایان مبنایشان گذشته و هنوز به ۱۰۰٪ نرسیده‌اند، در لحظهٔ پایان بازه',
    unit: 'count',
    higherIsBetter: false,
    scaleMax: activities.length,
    current: overdueValue('current'),
    previous: overdueValue('previous'),
  })

  const issueList = (side: 'current' | 'previous') =>
    input.issues ? issuesBetween(input.issues.events, range[side].start, range[side].cutoff) : []
  const issueValue = (side: 'current' | 'previous'): ComparisonValue =>
    !input.issues || input.issues.checked.length === 0
      ? { state: 'unavailable', reason: 'هیچ منبعی برای مسائل و توقفات در دسترس نیست' }
      : { state: 'ok', value: issueList(side).length }
  const issues = metric({
    key: 'issues',
    label: 'مسائل و توقفات',
    basis: `موارد جدید در بازه؛ منابع: ${input.issues?.checked.join('، ') || '—'}`,
    unit: 'count',
    higherIsBetter: false,
    current: issueValue('current'),
    previous: issueValue('previous'),
    breakdown: input.issues
      ? (Object.keys(ISSUE_TYPE_LABELS) as IssueEvent['type'][]).map((type) => ({
          key: type,
          label: ISSUE_TYPE_LABELS[type],
          current: issueList('current').filter((e) => e.type === type).length,
          previous: issueList('previous').filter((e) => e.type === type).length,
        }))
      : undefined,
  })

  const metrics = [physical, spi, headcount, completed, overdue, issues]
  const summary = { better: 0, worse: 0, same: 0, neutral: 0 }
  for (const m of metrics) summary[m.verdict] += 1

  return {
    projectId: input.projectId,
    period: input.period,
    generatedAt: new Date(nowMs).toISOString(),
    current: windowOf(w.current, w.currentLabel),
    previous: windowOf(w.previous, w.previousLabel),
    metrics,
    summary,
    chart: buildChart(input, w),
    causes: input.causes
      ? {
          status: 'ok',
          data: {
            current: input.causes.filter((c) => inRange(c.at, w.current)),
            previous: input.causes.filter((c) => inRange(c.at, w.previous)),
          },
        }
      : { status: 'unavailable', reason: 'منابع علت در دسترس نیستند' },
    warnings: input.warnings,
  }
}

function inRange(iso: string, range: WindowRange): boolean {
  const t = Date.parse(iso)
  return t > range.start && t <= range.cutoff
}

function bucketLabel(period: ManagerPeriod, index: number, start: number): string {
  if (period === 'today') return faDigits(`${String(index + 1).padStart(2, '0')}:00`)
  if (period === 'week') return WEEKDAYS_FROM_SATURDAY[tehranParts(start).weekday]
  return faNumber(index + 1)
}

function buildChart(input: PeriodComparisonInput, w: PeriodWindows): PeriodComparison['chart'] {
  const { activities, nowMs } = input
  const source = input.progressSource
  if (!source.available) return { status: 'unavailable', reason: source.reason }
  if (!activities.some((a) => a.weight > 0)) {
    return { status: 'unavailable', reason: 'وزن فیزیکی فعالیت‌ها تعریف نشده است؛ نمودار پیشرفت وزنی قابل رسم نیست.' }
  }

  const curBase = physicalAt(activities, w.current.start, nowMs) ?? 0
  const planBase = plannedPhysicalAt(activities, w.current.start) ?? 0
  const transits = input.transits ?? []
  const events = input.issues?.events ?? []

  const detail = (from: number, to: number): ComparisonPointDetail => ({
    at: new Date(to).toISOString(),
    level: to >= nowMs || known(to) ? physicalAt(activities, to, nowMs) : null,
    headcount: input.transits && input.transits.length > 0 ? presentOnDay(transits, to) : null,
    completed: completedBetween(activities, from, to, nowMs),
    issues: issuesBetween(events, from, to).length,
    activities: topActivities(activities, from, to, nowMs),
  })

  const historyStart = progressHistoryStart(activities)
  const known = (t: number) => historyStart != null && t >= historyStart
  const currentReported = known(w.current.start) && reportsBetween(activities, w.current.start, w.current.cutoff) > 0
  const previousReported = reportsBetween(activities, w.previous.start, w.previous.end) > 0
  /** The previous period is over, so its line is drawn from recorded history whenever any exists by its end. */
  const previousDrawn = historyStart != null && historyStart <= w.previous.end
  const prevRecordBase = physicalFromRecords(activities, w.previous.start, nowMs) ?? 0
  const count = Math.max(w.current.buckets, w.previous.buckets)
  const points: ComparisonChartPoint[] = []
  let cutoffIndex = 0
  for (let i = 0; i < count; i += 1) {
    const curFrom = w.current.start + i * w.unitMs
    const curTo = curFrom + w.unitMs
    const prevFrom = w.previous.start + i * w.unitMs
    const prevTo = prevFrom + w.unitMs
    const inCurrent = i < w.current.buckets && curFrom < w.current.cutoff
    const curLive = inCurrent && currentReported
    const prevLive = i < w.previous.buckets && previousDrawn
    const curAt = Math.min(curTo, w.current.cutoff)
    if (inCurrent) cutoffIndex = i
    const planned = i < w.current.buckets ? plannedPhysicalAt(activities, curTo) : null
    points.push({
      index: i,
      label: bucketLabel(w.period, i, i < w.current.buckets ? curFrom : prevFrom),
      current: curLive ? (physicalAt(activities, curAt, nowMs) ?? curBase) - curBase : null,
      previous: prevLive ? (physicalFromRecords(activities, prevTo, nowMs) ?? prevRecordBase) - prevRecordBase : null,
      planned: planned == null ? null : planned - planBase,
      currentDetail: curLive ? detail(curFrom, curAt) : null,
      previousDetail: prevLive ? detail(prevFrom, prevTo) : null,
    })
  }
  return {
    status: 'ok',
    data: {
      points,
      cutoffIndex,
      currentReported,
      previousReported,
      previousDrawn,
      historyStart: historyStart == null ? null : new Date(historyStart).toISOString(),
    },
  }
}
