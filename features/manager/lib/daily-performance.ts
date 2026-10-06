import { faNumber } from '@/features/manager/lib/format'
import { weightedPlannedPercent } from '@/features/schedule/lib/planned-progress'
import type {
ManagerBlocker,
ManagerDailyDelta,
ManagerUpcomingDeadline,
} from '@/features/manager/lib/overview-types'

const DAY_MS = 86_400_000

function dateOnly(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
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
  const windows = rows.map((r) => ({ weight: r.weight, start: r.baselineStart, finish: r.baselineFinish }))
  const plannedPercent = Math.max(
    0,
    (weightedPlannedPercent(windows, today) ?? 0) - (weightedPlannedPercent(windows, yesterday) ?? 0)
  )
  const baselineEnded = rows.every((r) => {
    const f = dateOnly(r.baselineFinish ?? r.baselineStart)
    return !f || f < today
  })

  let plannedActivities = 0
  let plannedReportedActivities = 0
  let reportedActivities = 0
  let overdueActivities = 0
  for (const row of rows) {
    const reported = (deltaOf.get(row.id) ?? 0) > 0
    if (reported) reportedActivities += 1
    const s = dateOnly(row.baselineStart)
    const f = dateOnly(row.baselineFinish ?? row.baselineStart)
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
    baselineEnded,
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

/** Unfinished leaf activities ordered by their forecast finish from today on. */
export function buildUpcomingDeadlines(rows: ScheduleTaskRow[], today: string, limit = 3): ManagerUpcomingDeadline[] {
  const items: ManagerUpcomingDeadline[] = []
  for (const row of rows) {
    if (row.isSummary || row.actualFinish || row.percent >= 100) continue
    const due = dateOnly(row.currentFinish) ?? dateOnly(row.baselineFinish)
    if (!due || due < today) continue
    items.push({ id: row.id, name: row.name, wbs: row.wbs, due, percent: row.percent })
  }
  items.sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name, 'fa'))
  return items.slice(0, limit)
}

/* ---------------------------------------------------------------- Blockers */

export interface BlockerInputs {
  blockedWorkOrders: { id: string; taskName: string; wbs?: string | null; constraints: string[]; planDate: string }[]
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
