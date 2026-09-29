import { plannedPercentAsOf } from '@/lib/evm/metrics'
import { faNumber } from '@/lib/manager/format'
import type {
  ManagerBlocker,
  ManagerCriticalDelay,
  ManagerCriticalDelays,
  ManagerDailyDelta,
} from '@/lib/manager/overview-types'

const DAY_MS = 86_400_000

function dateOnly(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DAY_MS)
}

/* ------------------------------------------------------------ Daily delta */

export interface ProgressUpdateRow {
  taskId: string
  percent: number
  createdAt: string
}

/** A leaf schedule activity with its physical weight and both planned date windows. */
export interface DailyScheduleRow {
  id: string
  weight: number
  percent: number
  baselineStart: string | null
  baselineFinish: string | null
  currentStart: string | null
  currentFinish: string | null
}

function plannedWeightedAt(
  rows: DailyScheduleRow[],
  totalWeight: number,
  pick: (row: DailyScheduleRow) => { start: string | null; finish: string | null },
  asOf: string
): number {
  if (totalWeight <= 0) return 0
  let done = 0
  for (const row of rows) {
    const { start, finish } = pick(row)
    done += row.weight * plannedPercentAsOf(start, finish, asOf)
  }
  return done / totalWeight
}

/**
 * Rolling 24-hour performance on the schedule's physical weights: the plan's increment for one
 * day against the progress recorded in `task_progress_updates` during the last 24 hours.
 */
export function buildDailyDelta(input: {
  rows: DailyScheduleRow[]
  today: string
  nowMs: number
  updates: ProgressUpdateRow[]
  lastDailyReport: { date: string; approved: boolean } | null
}): ManagerDailyDelta {
  const { today, nowMs } = input
  const rows = input.rows.filter((r) => r.weight > 0)
  const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0)
  const windowStartMs = nowMs - DAY_MS

  const byTask = new Map<string, ProgressUpdateRow[]>()
  let lastProgressAt: string | null = null
  for (const row of input.updates) {
    const list = byTask.get(row.taskId) ?? []
    list.push(row)
    byTask.set(row.taskId, list)
    if (!lastProgressAt || row.createdAt > lastProgressAt) lastProgressAt = row.createdAt
  }

  const deltaOf = new Map<string, number>()
  for (const [taskId, list] of byTask) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    let before = 0
    let after: number | null = null
    for (const row of list) {
      const t = Date.parse(row.createdAt)
      if (t < windowStartMs) before = row.percent
      else if (t <= nowMs) after = row.percent
    }
    if (after != null) deltaOf.set(taskId, after - before)
  }

  let actualPercent = 0
  if (totalWeight > 0) {
    for (const row of rows) actualPercent += row.weight * (deltaOf.get(row.id) ?? 0)
    actualPercent /= totalWeight
  }

  const yesterday = addDays(today, -1)
  const baselineOf = (r: DailyScheduleRow) => ({ start: r.baselineStart, finish: r.baselineFinish })
  const currentOf = (r: DailyScheduleRow) => ({ start: r.currentStart, finish: r.currentFinish })
  const increment = (pick: typeof baselineOf) =>
    Math.max(0, plannedWeightedAt(rows, totalWeight, pick, today) - plannedWeightedAt(rows, totalWeight, pick, yesterday))

  // Once the baseline window has passed it allots nothing to today; the updated schedule then
  // carries today's target.
  const baselinePlanned = increment(baselineOf)
  const currentPlanned = baselinePlanned > 0.0001 ? 0 : increment(currentOf)
  const planBasis: ManagerDailyDelta['planBasis'] = currentPlanned > 0.0001 ? 'current' : 'baseline'
  const plannedPercent = planBasis === 'current' ? currentPlanned : baselinePlanned
  const windowOf = planBasis === 'current' ? currentOf : baselineOf

  let plannedActivities = 0
  let plannedReportedActivities = 0
  let reportedActivities = 0
  let overdueActivities = 0
  for (const row of rows) {
    const reported = (deltaOf.get(row.id) ?? 0) > 0
    if (reported) reportedActivities += 1
    const { start, finish } = windowOf(row)
    const s = dateOnly(start)
    const f = dateOnly(finish ?? start)
    if (s && f && s <= today && today <= f) {
      plannedActivities += 1
      if (reported) plannedReportedActivities += 1
    }
    const baselineFinish = dateOnly(row.baselineFinish ?? row.baselineStart)
    if (baselineFinish && baselineFinish < today && row.percent < 100) overdueActivities += 1
  }

  return {
    windowStart: new Date(windowStartMs).toISOString(),
    plannedPercent,
    actualPercent,
    deltaPercent: actualPercent - plannedPercent,
    fulfillmentPercent: plannedPercent > 0.0001 ? (actualPercent / plannedPercent) * 100 : null,
    planBasis,
    overdueActivities,
    plannedActivities,
    plannedReportedActivities,
    reportedActivities,
    lastProgressAt,
    lastDailyReport: input.lastDailyReport,
  }
}

/* -------------------------------------------------------- Critical delays */

export interface ScheduleTaskRow {
  id: string
  name: string
  wbs: string | null
  isCritical: boolean
  isSummary: boolean
  totalFloatDays: number | null
  baselineFinish: string | null
  currentFinish: string | null
  actualFinish: string | null
  percent: number
}

/**
 * Unfinished activities on (or at zero/negative float next to) the critical path whose forecast
 * finish slips past the baseline. An overdue activity is forecast to finish no earlier than today.
 */
export function buildCriticalDelays(rows: ScheduleTaskRow[], today: string, limit = 5): ManagerCriticalDelays {
  const items: ManagerCriticalDelay[] = []
  for (const row of rows) {
    if (row.isSummary || row.actualFinish || row.percent >= 100) continue
    const onPath = row.isCritical || (row.totalFloatDays != null && row.totalFloatDays <= 0)
    const baseline = dateOnly(row.baselineFinish)
    const current = dateOnly(row.currentFinish)
    if (!onPath || !baseline || !current) continue
    const overdue = current < today
    const forecast = overdue ? today : current
    const delayDays = dayDiff(forecast, baseline)
    if (delayDays <= 0) continue
    items.push({
      id: row.id,
      name: row.name,
      wbs: row.wbs,
      delayDays,
      totalFloatDays: row.totalFloatDays,
      importance:
        row.totalFloatDays != null && row.totalFloatDays < 0 ? 'negative_float' : row.isCritical ? 'critical' : 'zero_float',
      percent: row.percent,
      baselineFinish: baseline,
      forecastFinish: forecast,
      overdue,
    })
  }
  items.sort((a, b) => b.delayDays - a.delayDays || a.percent - b.percent)
  return { items: items.slice(0, limit), total: items.length }
}

/* ---------------------------------------------------------------- Blockers */

export interface BlockerInputs {
  blockedWorkOrders: { id: string; taskName: string; constraints: string[]; planDate: string }[]
  constraintNotes: { id: string; note: string; createdAt: string }[]
  stock: { id: string; name: string; current: number; min: number; unit: string | null; updatedAt: string | null }[]
  criticalNcrs: { id: string; label: string; createdAt: string | null }[]
  openAlerts: { id: string; type: string; severity: string; message: string; taskName: string | null; createdAt: string }[]
  owners: { materials: string | null; quality: string | null; site: string | null }
}

const ALERT_IMPACT: Record<string, string> = {
  delay_risk: 'ریسک تأخیر در شروع یا پایان فعالیت',
  material_purchase: 'تأمین به‌موقع مصالح فعالیت در خطر است',
  milestone_risk: 'تاریخ مایل‌استون در خطر است',
  critical_path: 'روی مسیر بحرانی اثر مستقیم دارد',
}

/** Active site blockers, most severe and oldest first. */
export function buildBlockers(input: BlockerInputs): ManagerBlocker[] {
  const items: ManagerBlocker[] = []

  for (const wo of input.blockedWorkOrders) {
    items.push({
      id: `wo-${wo.id}`,
      category: 'site',
      level: 'critical',
      title: wo.taskName,
      impact: wo.constraints.length ? `محدودیت: ${wo.constraints.join('، ')}` : 'این جبهه در برنامهٔ روزانه «متوقف» ثبت شده است',
      owner: input.owners.site,
      since: wo.planDate,
    })
  }

  for (const note of input.constraintNotes) {
    items.push({
      id: `constraint-${note.id}`,
      category: 'site',
      level: 'warning',
      title: note.note,
      impact: 'محدودیت ثبت‌شده در برنامهٔ روزانهٔ کارگاه',
      owner: input.owners.site,
      since: note.createdAt,
    })
  }

  for (const item of input.stock) {
    if (!(item.min > 0) || item.current > item.min) continue
    const empty = item.current <= 0
    items.push({
      id: `stock-${item.id}`,
      category: 'materials',
      level: empty ? 'critical' : 'warning',
      title: empty ? `کسری ${item.name}` : `${item.name} زیر حداقل موجودی`,
      impact: empty
        ? 'موجودی صفر است؛ فعالیت‌های وابسته به این مصالح متوقف می‌شوند'
        : `موجودی ${faNumber(item.current)}${item.unit ? ` ${item.unit}` : ''} از حداقل ${faNumber(item.min)}؛ در خطر توقف`,
      owner: input.owners.materials,
      since: item.updatedAt,
    })
  }

  for (const ncr of input.criticalNcrs) {
    items.push({
      id: `ncr-${ncr.id}`,
      category: 'quality',
      level: 'critical',
      title: `عدم انطباق بحرانی ${ncr.label}`,
      impact: 'کار در محدودهٔ NCR تا اقدام اصلاحی و بازرسی مجدد متوقف است',
      owner: input.owners.quality,
      since: ncr.createdAt,
    })
  }

  for (const alert of input.openAlerts) {
    items.push({
      id: `alert-${alert.id}`,
      category: 'schedule',
      level: alert.severity === 'critical' ? 'critical' : 'warning',
      title: alert.taskName ? `${alert.taskName}: ${alert.message}` : alert.message,
      impact: ALERT_IMPACT[alert.type] ?? 'هشدار باز برنامه‌ریزی',
      owner: null,
      since: alert.createdAt,
    })
  }

  return items.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'critical' ? -1 : 1
    return (a.since ?? '9999').localeCompare(b.since ?? '9999')
  })
}
