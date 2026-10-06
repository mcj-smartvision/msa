import { diffDaysIso, toIsoDateOnly } from '@/features/schedule/lib/dates'
import { taskBaselineDates } from '@/features/schedule/lib/leaf-activities'
import { plannedPercentInWindow } from '@/features/schedule/lib/planned-progress'
import {
getTaskScheduleStatus,
taskEffectiveFinish,
taskEffectiveStart,
todayIso,
} from '@/features/schedule/lib/task-view-date'
import { compareWbs, wbsDepth } from '@/features/schedule/lib/wbs-utils'
import type { ProjectTask } from '@/shared/types/schedule'

export type PlanComplianceCheck = 'on_track' | 'behind' | 'done' | 'not_started'

export interface PlanComplianceRow {
  taskId: string
  wbs: string | null
  name: string
  isCritical: boolean
  /** Outline depth from WBS (0 = top level) */
  depth: number
  /** MSP وزن (percent-points), null if missing */
  scheduleWeight: number | null
  /** Summary / header row from MSP */
  isSummary: boolean
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
  /** Full schedule for the progress editor, WBS hierarchy order */
  allRows: PlanComplianceRow[]
}

/** Baseline planned % for a task as of a day — the shared convention in `planned-progress.ts`. */
export function plannedPercentByDate(task: ProjectTask, asOf: string): number {
  return plannedPercentInWindow(taskBaselineDates(task as unknown as Record<string, unknown>), asOf)
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

  const weight =
    task.schedule_weight != null && Number.isFinite(Number(task.schedule_weight))
      ? Number(task.schedule_weight)
      : null

  return {
    taskId: task.id,
    wbs: task.wbs_code,
    name: task.name,
    isCritical: Boolean(task.is_critical),
    depth: wbsDepth(task.wbs_code),
    scheduleWeight: weight,
    isSummary: Boolean(task.is_summary),
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
 * List order follows WBS outline (parent, then children) — not calendar start date.
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

  const hierarchical = [...tasks].sort((a, b) => compareWbs(a.wbs_code, b.wbs_code))
  const allRows = hierarchical.map((task) => toComplianceRow(task, asOf))
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
