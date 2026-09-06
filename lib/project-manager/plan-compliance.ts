import { diffDaysIso, toIsoDateOnly } from '@/lib/schedule/dates'
import {
  compareTasksByScheduleDate,
  getTaskScheduleStatus,
  taskEffectiveFinish,
  taskEffectiveStart,
  todayIso,
} from '@/lib/schedule/task-view-date'
import type { ProjectTask } from '@/types/schedule'

export type PlanComplianceCheck = 'on_track' | 'behind' | 'done' | 'not_started'

export interface PlanComplianceRow {
  taskId: string
  wbs: string | null
  name: string
  isCritical: boolean
  start: string | null
  finish: string | null
  /** Expected % complete by as-of date (linear time-phased) */
  plannedPercent: number
  actualPercent: number
  check: PlanComplianceCheck
  /** Remaining work % */
  remainingPercent: number
  daysLate: number
  scheduleStatus: ReturnType<typeof getTaskScheduleStatus>
}

export interface PlanComplianceSummary {
  asOfDate: string
  actualStart: string | null
  /** True when actual start exists and is on/before as-of (checklist should show) */
  shouldShowChecklist: boolean
  hasSchedule: boolean
  totalDue: number
  onTrack: number
  behind: number
  done: number
  notStarted: number
  avgPlanned: number
  avgActual: number
  variance: number
  /** Due by as-of (started on/before today) — KPIs and “yes, on plan” */
  rows: PlanComplianceRow[]
  /** Full schedule for the progress editor, chronological */
  allRows: PlanComplianceRow[]
}

/** Linear planned % for a task as of a calendar day. */
export function plannedPercentByDate(task: ProjectTask, asOf: string): number {
  const start = taskEffectiveStart(task)
  const finish = taskEffectiveFinish(task)
  if (!start) return 0
  if (asOf < start) return 0
  if (!finish || finish <= start) {
    return asOf >= start ? 100 : 0
  }
  if (asOf >= finish) return 100
  const total = diffDaysIso(start, finish)
  if (total <= 0) return asOf >= start ? 100 : 0
  const elapsed = diffDaysIso(start, asOf)
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}

function classifyCheck(planned: number, actual: number): PlanComplianceCheck {
  if (actual >= 100) return 'done'
  if (actual <= 0 && planned > 0) return 'not_started'
  // 5% tolerance for "on track"
  if (actual + 5 >= planned) return 'on_track'
  return 'behind'
}

function toComplianceRow(task: ProjectTask, asOf: string): PlanComplianceRow {
  const start = taskEffectiveStart(task)
  const finish = taskEffectiveFinish(task)
  const plannedPercent = plannedPercentByDate(task, asOf)
  const actualPercent = Math.min(100, Math.max(0, Math.round(Number(task.percent_complete) || 0)))
  const check = classifyCheck(plannedPercent, actualPercent)
  const scheduleStatus = getTaskScheduleStatus(task, asOf)
  let daysLate = 0
  if (finish && asOf > finish && actualPercent < 100) {
    daysLate = diffDaysIso(finish, asOf)
  } else if (plannedPercent > actualPercent + 5 && start) {
    const duration = finish && start ? Math.max(1, diffDaysIso(start, finish)) : 1
    daysLate = Math.max(0, Math.round(((plannedPercent - actualPercent) / 100) * duration))
  }

  return {
    taskId: task.id,
    wbs: task.wbs_code,
    name: task.name,
    isCritical: Boolean(task.is_critical),
    start,
    finish,
    plannedPercent,
    actualPercent,
    check,
    remainingPercent: Math.max(0, 100 - actualPercent),
    daysLate,
    scheduleStatus,
  }
}

/**
 * Tasks that were supposed to be underway or finished by asOf,
 * with planned-vs-actual checkmarks for PM control.
 */
export function buildPlanCompliance(
  tasks: ProjectTask[],
  options: {
    asOfDate?: string
    actualStart?: string | null
  } = {}
): PlanComplianceSummary {
  const asOf = options.asOfDate ?? todayIso()
  const actualStart = options.actualStart ? toIsoDateOnly(options.actualStart) : null
  const hasSchedule = tasks.length > 0
  const shouldShowChecklist = Boolean(actualStart && actualStart <= asOf && hasSchedule)

  const chronological = [...tasks].sort(compareTasksByScheduleDate)
  const allRows = chronological.map((task) => toComplianceRow(task, asOf))
  const rows = allRows.filter((row) => Boolean(row.start && row.start <= asOf))

  const onTrack = rows.filter((r) => r.check === 'on_track').length
  const behind = rows.filter((r) => r.check === 'behind').length
  const done = rows.filter((r) => r.check === 'done').length
  const notStarted = rows.filter((r) => r.check === 'not_started').length
  const avgPlanned =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((s, r) => s + r.plannedPercent, 0) / rows.length)
  const avgActual =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((s, r) => s + r.actualPercent, 0) / rows.length)

  return {
    asOfDate: asOf,
    actualStart,
    shouldShowChecklist,
    hasSchedule,
    totalDue: rows.length,
    onTrack,
    behind,
    done,
    notStarted,
    avgPlanned,
    avgActual,
    variance: avgActual - avgPlanned,
    rows,
    allRows,
  }
}
